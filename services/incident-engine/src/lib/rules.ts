/**
 * Rule Evaluation Engine
 *
 * Implements detection rules for incident triggering:
 * - Error Spike: count_5m >= 30 AND >= 3x baseline_60m
 * - Signup Drop: count_15m <= 10 AND baseline_60m >= 40
 */

import { EventEnvelope, fingerprint, METRICS } from '@signals/shared-types';
import { getCountLastNMinutes, getBaselineAverage } from './buckets.js';

export type RuleType = 'error_spike' | 'signup_drop';

export interface RuleResult {
  triggered: boolean;
  ruleType: RuleType;
  fingerprint: string;
  currentCount: number;
  baseline: number;
  severity: 'warn' | 'error' | 'critical';
  title: string;
}

/**
 * Evaluate error spike rule.
 * Triggers when: count_5m >= 30 AND count_5m >= 3 * baseline_60m
 */
export async function evaluateErrorSpikeRule(
  event: EventEnvelope
): Promise<RuleResult | null> {
  if (event.event_type !== 'error') {
    return null;
  }

  const fp = fingerprint(event);
  const now = new Date();

  // Get count for last 5 minutes
  const count5m = await getCountLastNMinutes({
    projectId: event.project_id,
    environment: event.environment,
    metricName: METRICS.ERROR_COUNT,
    fingerprint: fp,
    minutes: 5,
    referenceTime: now,
  });

  // Threshold check: at least 30 errors in 5 minutes
  if (count5m < 30) {
    return {
      triggered: false,
      ruleType: 'error_spike',
      fingerprint: fp,
      currentCount: count5m,
      baseline: 0,
      severity: 'warn',
      title: '',
    };
  }

  // Get baseline: average per 5-minute window over the last 60 minutes
  const baseline = await getBaselineAverage({
    projectId: event.project_id,
    environment: event.environment,
    metricName: METRICS.ERROR_COUNT,
    fingerprint: fp,
    baselineMinutes: 60,
    windowMinutes: 5,
    referenceTime: now,
  });

  // Spike check: current >= 3x baseline (or baseline is 0)
  const isSpike = baseline === 0 || count5m >= 3 * baseline;

  // Determine severity based on spike magnitude
  let severity: 'warn' | 'error' | 'critical' = 'error';
  if (baseline > 0) {
    const ratio = count5m / baseline;
    if (ratio >= 10) {
      severity = 'critical';
    } else if (ratio >= 5) {
      severity = 'error';
    } else {
      severity = 'warn';
    }
  }

  const errorCode = (event.attributes.error_code as string) ?? 'Unknown';
  const route = (event.attributes.route as string) ?? 'unknown';

  return {
    triggered: isSpike,
    ruleType: 'error_spike',
    fingerprint: fp,
    currentCount: count5m,
    baseline,
    severity,
    title: `Error spike: ${errorCode} on ${route}`,
  };
}

/**
 * Evaluate signup drop rule.
 * Triggers when: count_15m <= 10 AND baseline_60m >= 40
 */
export async function evaluateSignupDropRule(
  event: EventEnvelope
): Promise<RuleResult | null> {
  if (event.event_type !== 'signup') {
    return null;
  }

  const fp = fingerprint(event);
  const now = new Date();

  // Get baseline first: total signups in last 60 minutes
  const baseline60m = await getCountLastNMinutes({
    projectId: event.project_id,
    environment: event.environment,
    metricName: METRICS.SIGNUP_COUNT,
    fingerprint: fp,
    minutes: 60,
    referenceTime: now,
  });

  // Baseline check: need at least 40 signups in last hour to detect drop
  if (baseline60m < 40) {
    return {
      triggered: false,
      ruleType: 'signup_drop',
      fingerprint: fp,
      currentCount: 0,
      baseline: baseline60m,
      severity: 'warn',
      title: '',
    };
  }

  // Get count for last 15 minutes
  const count15m = await getCountLastNMinutes({
    projectId: event.project_id,
    environment: event.environment,
    metricName: METRICS.SIGNUP_COUNT,
    fingerprint: fp,
    minutes: 15,
    referenceTime: now,
  });

  // Drop check: 10 or fewer signups in 15 minutes when baseline is high
  const isDrop = count15m <= 10;

  // Determine severity based on drop magnitude
  const expectedPer15m = baseline60m / 4; // Expected signups per 15 min
  let severity: 'warn' | 'error' | 'critical' = 'warn';
  if (expectedPer15m > 0) {
    const ratio = count15m / expectedPer15m;
    if (ratio <= 0.1) {
      severity = 'critical';
    } else if (ratio <= 0.25) {
      severity = 'error';
    }
  }

  return {
    triggered: isDrop,
    ruleType: 'signup_drop',
    fingerprint: fp,
    currentCount: count15m,
    baseline: baseline60m,
    severity,
    title: `Signup drop detected in ${event.environment}`,
  };
}

/**
 * Evaluate all applicable rules for an event.
 * Returns the first triggered rule result, or null if no rules trigger.
 */
export async function evaluateRules(
  event: EventEnvelope
): Promise<RuleResult | null> {
  // Evaluate error spike rule
  const errorResult = await evaluateErrorSpikeRule(event);
  if (errorResult?.triggered) {
    return errorResult;
  }

  // Evaluate signup drop rule
  const signupResult = await evaluateSignupDropRule(event);
  if (signupResult?.triggered) {
    return signupResult;
  }

  return null;
}
