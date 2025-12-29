/**
 * Prompt Builder for Incident Summaries
 *
 * Constructs prompts for the AI to generate incident summaries.
 */

import { db, incidents, incidentEvents, Incident, IncidentEvent } from '@signals/db';
import { eq, desc } from 'drizzle-orm';
import type { ChatMessage } from './gradient.js';

const SYSTEM_PROMPT = `You are an expert incident analyst for a software monitoring system. Your job is to analyze incident data and provide concise, actionable summaries.

When analyzing an incident, provide:
1. A brief title (max 10 words)
2. Impact assessment (who/what is affected)
3. Likely root causes (based on error patterns)
4. Key evidence from the events
5. Recommended next steps

Respond in valid JSON format with this structure:
{
  "title": "Brief incident title",
  "impact": "Description of business/user impact",
  "likely_causes": ["cause1", "cause2"],
  "evidence": ["evidence1", "evidence2"],
  "next_steps": ["step1", "step2"],
  "confidence": 0.85
}

Be concise and focus on actionable insights.`;

/**
 * Fetch incident details and recent events for prompt building.
 */
export async function fetchIncidentContext(incidentId: string): Promise<{
  incident: Incident;
  events: IncidentEvent[];
} | null> {
  // Fetch incident
  const incidentResult = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (incidentResult.length === 0) {
    return null;
  }

  const incident = incidentResult[0];

  // Fetch recent events (limit to 50 for context window)
  const events = await db
    .select()
    .from(incidentEvents)
    .where(eq(incidentEvents.incident_id, incidentId))
    .orderBy(desc(incidentEvents.occurred_at))
    .limit(50);

  return { incident, events };
}

/**
 * Build the prompt messages for incident summary generation.
 */
export function buildPromptMessages(
  incident: Incident,
  events: IncidentEvent[]
): ChatMessage[] {
  // Format events for the prompt
  const eventSummaries = events.map((e) => {
    const attrs = e.attributes_json as Record<string, unknown> | null;
    return {
      time: e.occurred_at.toISOString(),
      type: e.event_type,
      severity: e.severity,
      error_code: attrs?.error_code ?? null,
      route: attrs?.route ?? null,
      status_code: attrs?.status_code ?? null,
    };
  });

  // Group by error code for pattern analysis
  const errorCodeCounts: Record<string, number> = {};
  for (const e of eventSummaries) {
    if (e.error_code) {
      const code = String(e.error_code);
      errorCodeCounts[code] = (errorCodeCounts[code] || 0) + 1;
    }
  }

  // Group by route
  const routeCounts: Record<string, number> = {};
  for (const e of eventSummaries) {
    if (e.route) {
      const route = String(e.route);
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    }
  }

  const userPrompt = `Analyze this incident and provide a summary:

## Incident Details
- ID: ${incident.id}
- Title: ${incident.title}
- Status: ${incident.status}
- Severity: ${incident.severity}
- Environment: ${incident.environment}
- Fingerprint: ${incident.fingerprint}
- Opened: ${incident.opened_at.toISOString()}
- Last Seen: ${incident.last_seen_at.toISOString()}

## Event Statistics
- Total Events: ${events.length}
- Time Range: ${events.length > 0 ? `${events[events.length - 1].occurred_at.toISOString()} to ${events[0].occurred_at.toISOString()}` : 'N/A'}

## Error Code Distribution
${Object.entries(errorCodeCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([code, count]) => `- ${code}: ${count} occurrences`)
  .join('\n') || '- No error codes found'}

## Route Distribution
${Object.entries(routeCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([route, count]) => `- ${route}: ${count} occurrences`)
  .join('\n') || '- No routes found'}

## Sample Events (most recent 10)
${JSON.stringify(eventSummaries.slice(0, 10), null, 2)}

Provide your analysis in the required JSON format.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Parse the AI response into structured output.
 */
export interface AISummaryOutput {
  title: string;
  impact: string;
  likely_causes: string[];
  evidence: string[];
  next_steps: string[];
  confidence: number;
}

export function parseAIResponse(response: string): AISummaryOutput {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Invalid AI response: missing title');
  }

  return {
    title: parsed.title,
    impact: parsed.impact || 'Unknown impact',
    likely_causes: Array.isArray(parsed.likely_causes) ? parsed.likely_causes : [],
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
  };
}
