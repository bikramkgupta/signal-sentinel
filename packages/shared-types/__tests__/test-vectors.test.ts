/**
 * Test vectors for shared-types
 *
 * These tests ensure that canonicalize(), fingerprint(), and kafkaKey()
 * produce deterministic, expected outputs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canonicalize,
  fingerprint,
  kafkaKey,
  alignToMinuteBucket,
  getMetricName,
  validateRawEvent,
  safeValidateRawEvent,
  type RawEventInput,
  type EventEnvelope,
} from '../src/index.js';

describe('canonicalize', () => {
  const context = { org_id: 'org_123', project_id: 'proj_456' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  it('should fill in defaults for minimal input', () => {
    const input: RawEventInput = {
      event_type: 'error',
      occurred_at: '2025-01-15T11:59:00Z',
      message: 'Connection timeout',
    };

    const result = canonicalize(input, context);

    expect(result.schema_version).toBe('1.0');
    expect(result.org_id).toBe('org_123');
    expect(result.project_id).toBe('proj_456');
    expect(result.environment).toBe('dev'); // default
    expect(result.severity).toBe('info'); // default
    expect(result.event_id).toBeDefined(); // generated
    expect(result.received_at).toBe('2025-01-15T12:00:00.000Z');
    expect(result.attributes).toEqual({});
    expect(result.payload).toEqual({});
  });

  it('should preserve provided values', () => {
    const input: RawEventInput = {
      event_type: 'error',
      occurred_at: '2025-01-15T11:59:00Z',
      message: 'Connection timeout',
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      environment: 'prod',
      severity: 'critical',
      attributes: { error_code: 'TIMEOUT', route: '/api/checkout' },
      payload: { user_id: 'user_123' },
    };

    const result = canonicalize(input, context);

    expect(result.event_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.environment).toBe('prod');
    expect(result.severity).toBe('critical');
    expect(result.attributes).toEqual({ error_code: 'TIMEOUT', route: '/api/checkout' });
    expect(result.payload).toEqual({ user_id: 'user_123' });
  });
});

describe('fingerprint', () => {
  const baseEvent: EventEnvelope = {
    schema_version: '1.0',
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    occurred_at: '2025-01-15T11:59:00Z',
    received_at: '2025-01-15T12:00:00Z',
    org_id: 'org_123',
    project_id: 'proj_456',
    environment: 'prod',
    event_type: 'error',
    severity: 'error',
    message: 'Connection timeout',
    attributes: {},
    payload: {},
  };

  it('should generate error fingerprint with error_code and route', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'error',
      attributes: { error_code: 'TIMEOUT', route: '/api/checkout' },
    };

    expect(fingerprint(event)).toBe('TIMEOUT|/api/checkout|prod');
  });

  it('should use "unknown" for missing error attributes', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'error',
      attributes: {},
    };

    expect(fingerprint(event)).toBe('unknown|unknown|prod');
  });

  it('should generate signup fingerprint', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'signup',
    };

    expect(fingerprint(event)).toBe('signup|prod');
  });

  it('should generate default fingerprint for other event types', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'deploy',
    };

    expect(fingerprint(event)).toBe('deploy|prod');
  });

  it('should vary by environment', () => {
    const prodEvent = { ...baseEvent, environment: 'prod' as const };
    const stagingEvent = { ...baseEvent, environment: 'staging' as const };

    expect(fingerprint(prodEvent)).not.toBe(fingerprint(stagingEvent));
  });
});

describe('kafkaKey', () => {
  const baseEvent: EventEnvelope = {
    schema_version: '1.0',
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    occurred_at: '2025-01-15T11:59:00Z',
    received_at: '2025-01-15T12:00:00Z',
    org_id: 'org_123',
    project_id: 'proj_456',
    environment: 'prod',
    event_type: 'error',
    severity: 'error',
    message: 'Connection timeout',
    attributes: {},
    payload: {},
  };

  it('should generate error key with error_code and route', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'error',
      attributes: { error_code: 'TIMEOUT', route: '/api/checkout' },
    };

    expect(kafkaKey(event)).toBe('org_123|proj_456|TIMEOUT|/api/checkout');
  });

  it('should generate default key for non-error events', () => {
    const event: EventEnvelope = {
      ...baseEvent,
      event_type: 'signup',
    };

    expect(kafkaKey(event)).toBe('org_123|proj_456|signup');
  });
});

describe('alignToMinuteBucket', () => {
  it('should align to start of minute', () => {
    const timestamp = new Date('2025-01-15T12:34:56.789Z');
    const aligned = alignToMinuteBucket(timestamp);

    expect(aligned.toISOString()).toBe('2025-01-15T12:34:00.000Z');
  });

  it('should handle string timestamps', () => {
    const aligned = alignToMinuteBucket('2025-01-15T12:34:56.789Z');

    expect(aligned.toISOString()).toBe('2025-01-15T12:34:00.000Z');
  });

  it('should return same value for already aligned timestamps', () => {
    const timestamp = new Date('2025-01-15T12:34:00.000Z');
    const aligned = alignToMinuteBucket(timestamp);

    expect(aligned.toISOString()).toBe('2025-01-15T12:34:00.000Z');
  });
});

describe('getMetricName', () => {
  const baseEvent: EventEnvelope = {
    schema_version: '1.0',
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    occurred_at: '2025-01-15T11:59:00Z',
    received_at: '2025-01-15T12:00:00Z',
    org_id: 'org_123',
    project_id: 'proj_456',
    environment: 'prod',
    event_type: 'error',
    severity: 'error',
    message: 'Test',
    attributes: {},
    payload: {},
  };

  it('should return error_count for error events', () => {
    expect(getMetricName({ ...baseEvent, event_type: 'error' })).toBe('error_count');
  });

  it('should return signup_count for signup events', () => {
    expect(getMetricName({ ...baseEvent, event_type: 'signup' })).toBe('signup_count');
  });

  it('should return null for other event types', () => {
    expect(getMetricName({ ...baseEvent, event_type: 'deploy' })).toBeNull();
    expect(getMetricName({ ...baseEvent, event_type: 'http_request' })).toBeNull();
  });
});

describe('validation', () => {
  it('should validate correct raw event input', () => {
    const input = {
      event_type: 'error',
      occurred_at: '2025-01-15T12:00:00Z',
      message: 'Test error',
    };

    const result = validateRawEvent(input);
    expect(result.event_type).toBe('error');
    expect(result.message).toBe('Test error');
  });

  it('should reject invalid event type', () => {
    const input = {
      event_type: 'invalid_type',
      occurred_at: '2025-01-15T12:00:00Z',
      message: 'Test',
    };

    const result = safeValidateRawEvent(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const input = {
      event_type: 'error',
      // missing occurred_at and message
    };

    const result = safeValidateRawEvent(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid timestamp format', () => {
    const input = {
      event_type: 'error',
      occurred_at: 'not-a-timestamp',
      message: 'Test',
    };

    const result = safeValidateRawEvent(input);
    expect(result.success).toBe(false);
  });
});
