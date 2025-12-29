/**
 * Incident Lifecycle Management
 *
 * Handles incident creation, updates, and resolution.
 * Links events to incidents via incident_events table.
 */

import { db, incidents, incidentEvents, Incident } from '@signals/db';
import { eq, and, sql } from 'drizzle-orm';
import { EventEnvelope } from '@signals/shared-types';
import { RuleResult } from './rules.js';

export interface IncidentAction {
  type: 'created' | 'updated' | 'none';
  incident: Incident | null;
  isNew: boolean;
}

/**
 * Find an open incident by fingerprint.
 */
export async function findOpenIncident(params: {
  projectId: string;
  environment: string;
  fingerprint: string;
}): Promise<Incident | null> {
  const result = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.project_id, params.projectId),
        eq(incidents.environment, params.environment),
        eq(incidents.fingerprint, params.fingerprint),
        eq(incidents.status, 'open')
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Create a new incident.
 */
export async function createIncident(params: {
  event: EventEnvelope;
  ruleResult: RuleResult;
}): Promise<Incident> {
  const { event, ruleResult } = params;

  const result = await db
    .insert(incidents)
    .values({
      org_id: event.org_id,
      project_id: event.project_id,
      environment: event.environment,
      fingerprint: ruleResult.fingerprint,
      status: 'open',
      severity: ruleResult.severity,
      title: ruleResult.title,
      opened_at: new Date(),
      last_seen_at: new Date(),
    })
    .returning();

  console.log(`Created incident: ${result[0].id} - ${ruleResult.title}`);
  return result[0];
}

/**
 * Update an existing incident (bump last_seen_at, potentially upgrade severity).
 */
export async function updateIncident(params: {
  incident: Incident;
  event: EventEnvelope;
  ruleResult: RuleResult;
}): Promise<Incident> {
  const { incident, ruleResult } = params;

  // Only upgrade severity, never downgrade
  const severityOrder = { warn: 0, error: 1, critical: 2 };
  const currentSeverity = incident.severity as keyof typeof severityOrder;
  const newSeverity = ruleResult.severity;
  const shouldUpgrade = severityOrder[newSeverity] > severityOrder[currentSeverity];

  const result = await db
    .update(incidents)
    .set({
      last_seen_at: new Date(),
      ...(shouldUpgrade ? { severity: newSeverity } : {}),
    })
    .where(eq(incidents.id, incident.id))
    .returning();

  return result[0];
}

/**
 * Link an event to an incident.
 */
export async function linkEventToIncident(params: {
  incidentId: string;
  event: EventEnvelope;
}): Promise<void> {
  await db.insert(incidentEvents).values({
    incident_id: params.incidentId,
    event_id: params.event.event_id,
    occurred_at: new Date(params.event.occurred_at),
    event_type: params.event.event_type,
    severity: params.event.severity,
    attributes_json: params.event.attributes,
  });
}

/**
 * Process an event that triggered a rule.
 * Either creates a new incident or updates an existing one.
 */
export async function processTriggeredEvent(params: {
  event: EventEnvelope;
  ruleResult: RuleResult;
}): Promise<IncidentAction> {
  const { event, ruleResult } = params;

  // Check for existing open incident
  const existingIncident = await findOpenIncident({
    projectId: event.project_id,
    environment: event.environment,
    fingerprint: ruleResult.fingerprint,
  });

  let incident: Incident;
  let isNew = false;

  if (existingIncident) {
    // Update existing incident
    incident = await updateIncident({
      incident: existingIncident,
      event,
      ruleResult,
    });
  } else {
    // Create new incident
    incident = await createIncident({ event, ruleResult });
    isNew = true;
  }

  // Link event to incident
  await linkEventToIncident({
    incidentId: incident.id,
    event,
  });

  return {
    type: isNew ? 'created' : 'updated',
    incident,
    isNew,
  };
}

/**
 * Resolve an incident.
 */
export async function resolveIncident(incidentId: string): Promise<void> {
  await db
    .update(incidents)
    .set({
      status: 'resolved',
      resolved_at: new Date(),
    })
    .where(eq(incidents.id, incidentId));

  console.log(`Resolved incident: ${incidentId}`);
}

/**
 * Find stale open incidents that should be auto-resolved.
 * An incident is stale if it hasn't been seen in the specified duration.
 */
export async function findStaleIncidents(
  staleAfterMinutes: number
): Promise<Incident[]> {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

  return db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.status, 'open'),
        sql`${incidents.last_seen_at} < ${cutoff}`
      )
    );
}
