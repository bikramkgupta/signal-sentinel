/**
 * Event Generator - Creates realistic traffic patterns
 */

import type {
  EventType,
  Severity,
  EventAttributes,
} from '@signals/shared-types';

interface GeneratedEvent {
  event_type: EventType;
  occurred_at: string;
  message: string;
  severity: Severity;
  attributes: EventAttributes;
}

interface WeightedItem {
  weight: number;
}

// Realistic routes for HTTP requests
const ROUTES: Array<{ path: string; method: string; weight: number }> = [
  { path: '/api/products', method: 'GET', weight: 30 },
  { path: '/api/products/:id', method: 'GET', weight: 20 },
  { path: '/api/cart', method: 'GET', weight: 15 },
  { path: '/api/cart', method: 'POST', weight: 10 },
  { path: '/api/checkout', method: 'POST', weight: 5 },
  { path: '/api/users/me', method: 'GET', weight: 10 },
  { path: '/api/search', method: 'GET', weight: 10 },
];

// Error scenarios for incident generation
const ERROR_SCENARIOS = [
  {
    code: 'DB_TIMEOUT',
    message: 'Database connection timeout',
    route: '/api/users',
    severity: 'error' as Severity,
  },
  {
    code: 'PAYMENT_FAILED',
    message: 'Payment processing failed: gateway timeout',
    route: '/api/checkout',
    severity: 'error' as Severity,
  },
  {
    code: 'AUTH_SERVICE_DOWN',
    message: 'Authentication service unavailable',
    route: '/api/auth/verify',
    severity: 'critical' as Severity,
  },
  {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded for API key',
    route: '/api/search',
    severity: 'warn' as Severity,
  },
  {
    code: 'OOM_WORKER',
    message: 'Worker process terminated: out of memory',
    route: '/api/reports/generate',
    severity: 'critical' as Severity,
  },
];

// Signup methods
const SIGNUP_METHODS = ['email', 'google', 'github', 'apple'];

function now(): string {
  return new Date().toISOString();
}

function weightedRandom<T extends WeightedItem>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[0];
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateHttpRequest(): GeneratedEvent {
  const route = weightedRandom(ROUTES);
  const statusCode =
    Math.random() < 0.02 ? 500 : Math.random() < 0.05 ? 404 : 200;

  return {
    event_type: 'http_request',
    occurred_at: now(),
    message: `${route.method} ${route.path}`,
    severity: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    attributes: {
      route: route.path,
      method: route.method,
      status_code: statusCode,
      response_time_ms: Math.floor(50 + Math.random() * 200),
    },
  };
}

export function generateSignup(): GeneratedEvent {
  const method = randomChoice(SIGNUP_METHODS);

  return {
    event_type: 'signup',
    occurred_at: now(),
    message: `User signed up via ${method}`,
    severity: 'info',
    attributes: {
      method,
      referrer:
        Math.random() < 0.3
          ? 'google'
          : Math.random() < 0.5
            ? 'direct'
            : 'social',
    },
  };
}

export function generateDeploy(): GeneratedEvent {
  const version = `v${Math.floor(2 + Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`;

  return {
    event_type: 'deploy',
    occurred_at: now(),
    message: `Deployed version ${version}`,
    severity: 'info',
    attributes: {
      release: version,
      environment: 'prod',
      deployer: 'ci-pipeline',
    },
  };
}

export function generateError(): GeneratedEvent {
  const scenario = randomChoice(ERROR_SCENARIOS);

  return {
    event_type: 'error',
    occurred_at: now(),
    message: scenario.message,
    severity: scenario.severity,
    attributes: {
      error_code: scenario.code,
      route: scenario.route,
      status_code: 500,
    },
  };
}

/**
 * Generate a normal traffic event (weighted random selection)
 */
export function generateNormalEvent(): GeneratedEvent {
  const rand = Math.random();

  if (rand < 0.7) {
    return generateHttpRequest();
  } else if (rand < 0.9) {
    return generateSignup();
  } else {
    // Occasional feedback or other event
    return {
      event_type: 'feedback',
      occurred_at: now(),
      message: 'User submitted feedback',
      severity: 'info',
      attributes: {
        rating: Math.floor(3 + Math.random() * 3), // 3-5 rating
        category: randomChoice(['bug', 'feature', 'general']),
      },
    };
  }
}
