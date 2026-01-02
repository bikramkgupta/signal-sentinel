/**
 * Load Generator - Generates test events for different scenarios
 *
 * Usage:
 *   npm run loadgen -- --scenario=normal
 *   npm run loadgen -- --scenario=spike_errors
 *   npm run loadgen -- --scenario=drop_signups
 *   npm run loadgen -- --scenario=deploy_then_spike
 */

const API_URL = process.env.INGEST_API_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'dev-api-key-12345'

interface Event {
  event_type: string
  occurred_at: string
  message: string
  severity?: string
  attributes?: Record<string, unknown>
}

async function sendEvent(event: Event): Promise<void> {
  const response = await fetch(`${API_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to send event: ${response.status} ${text}`)
  }
}

async function sendBatch(events: Event[]): Promise<void> {
  const response = await fetch(`${API_URL}/v1/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ events }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to send batch: ${response.status} ${text}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function now(): string {
  return new Date().toISOString()
}

// Scenarios

async function normalTraffic(durationSec: number = 60): Promise<void> {
  console.log(`Running normal traffic for ${durationSec}s...`)
  const endTime = Date.now() + durationSec * 1000

  while (Date.now() < endTime) {
    // Mix of signups and HTTP requests
    const events: Event[] = []

    // 2-3 signups per second
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      events.push({
        event_type: 'signup',
        occurred_at: now(),
        message: 'User signed up',
        attributes: { method: 'email' },
      })
    }

    // 5-10 HTTP requests per second
    for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
      events.push({
        event_type: 'http_request',
        occurred_at: now(),
        message: 'GET /api/products',
        attributes: { route: '/api/products', method: 'GET', status_code: 200 },
      })
    }

    // Occasional error (1% chance per batch)
    if (Math.random() < 0.01) {
      events.push({
        event_type: 'error',
        occurred_at: now(),
        message: 'Database connection timeout',
        severity: 'error',
        attributes: { error_code: 'DB_TIMEOUT', route: '/api/users' },
      })
    }

    await sendBatch(events)
    await sleep(1000)
  }

  console.log('Normal traffic complete')
}

async function spikeErrors(count: number = 50): Promise<void> {
  console.log(`Generating error spike (${count} errors)...`)

  const events: Event[] = []
  for (let i = 0; i < count; i++) {
    events.push({
      event_type: 'error',
      occurred_at: now(),
      message: 'Payment processing failed',
      severity: 'error',
      attributes: {
        error_code: 'PAYMENT_FAILED',
        route: '/api/checkout',
        status_code: 500,
      },
    })
  }

  // Send in batches of 100
  for (let i = 0; i < events.length; i += 100) {
    await sendBatch(events.slice(i, i + 100))
  }

  console.log('Error spike complete')
}

async function dropSignups(normalSec: number = 30, dropSec: number = 60): Promise<void> {
  console.log(`Generating signup drop scenario...`)

  // First, establish baseline with normal signups
  console.log(`Phase 1: Normal signups for ${normalSec}s`)
  const endNormal = Date.now() + normalSec * 1000

  while (Date.now() < endNormal) {
    const events: Event[] = []
    for (let i = 0; i < 3; i++) {
      events.push({
        event_type: 'signup',
        occurred_at: now(),
        message: 'User signed up',
        attributes: { method: 'email' },
      })
    }
    await sendBatch(events)
    await sleep(1000)
  }

  // Then drop to near-zero
  console.log(`Phase 2: Signup drop for ${dropSec}s`)
  const endDrop = Date.now() + dropSec * 1000

  while (Date.now() < endDrop) {
    // Only occasional signup (10% chance)
    if (Math.random() < 0.1) {
      await sendEvent({
        event_type: 'signup',
        occurred_at: now(),
        message: 'User signed up',
        attributes: { method: 'email' },
      })
    }
    await sleep(1000)
  }

  console.log('Signup drop scenario complete')
}

async function deployThenSpike(): Promise<void> {
  console.log('Generating deploy-then-spike scenario...')

  // Deploy event
  console.log('Sending deploy event...')
  await sendEvent({
    event_type: 'deploy',
    occurred_at: now(),
    message: 'Deployed version 2.5.0',
    attributes: { release: 'v2.5.0', environment: 'prod' },
  })

  // Wait a bit
  await sleep(2000)

  // Then spike errors
  console.log('Generating post-deploy error spike...')
  await spikeErrors(40)

  console.log('Deploy-then-spike scenario complete')
}

// Argument parsing helper
function getArg(args: string[], name: string, defaultValue: string): string {
  // Support both --name=value and --name value formats
  const eqArg = args.find((a) => a.startsWith(`--${name}=`))
  if (eqArg) return eqArg.split('=')[1]

  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]

  return defaultValue
}

// Main

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse arguments - support both --scenario and --mode
  const scenario = getArg(args, 'scenario', '') || getArg(args, 'mode', 'normal')
  const duration = parseInt(getArg(args, 'duration', '60'), 10)
  const rate = parseInt(getArg(args, 'rate', '50'), 10)

  console.log(`Load Generator - Scenario: ${scenario}`)
  console.log(`API URL: ${API_URL}`)
  console.log(`Duration: ${duration}s, Rate: ${rate}`)

  switch (scenario) {
    case 'normal':
      await normalTraffic(duration)
      break
    case 'spike_errors':
      await spikeErrors(rate)
      break
    case 'drop_signups':
      await dropSignups(Math.floor(duration / 3), Math.floor(duration * 2 / 3))
      break
    case 'deploy_then_spike':
      await deployThenSpike()
      break
    default:
      console.error(`Unknown scenario: ${scenario}`)
      console.log('Available: normal, spike_errors, drop_signups, deploy_then_spike')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
