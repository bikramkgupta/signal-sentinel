/**
 * Replay Tool - Replays NDJSON event fixtures
 *
 * Usage:
 *   npm run replay -- fixtures/scenarios/spike.ndjson
 *   npm run replay -- fixtures/scenarios/spike.ndjson --speed=2
 */

import * as fs from 'fs'
import * as readline from 'readline'

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
  // Update occurred_at to now
  const updatedEvent = {
    ...event,
    occurred_at: new Date().toISOString(),
  }

  const response = await fetch(`${API_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(updatedEvent),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to send event: ${response.status} ${text}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function replayFile(filePath: string, speed: number = 1): Promise<void> {
  console.log(`Replaying: ${filePath}`)
  console.log(`Speed: ${speed}x`)
  console.log(`API URL: ${API_URL}`)

  const fileStream = fs.createReadStream(filePath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let lineNum = 0
  let lastTimestamp: Date | null = null

  for await (const line of rl) {
    lineNum++
    if (!line.trim()) continue

    try {
      const event = JSON.parse(line) as Event

      // Calculate delay based on timestamps if available
      if (event.occurred_at && lastTimestamp) {
        const currentTime = new Date(event.occurred_at)
        const delayMs = (currentTime.getTime() - lastTimestamp.getTime()) / speed
        if (delayMs > 0 && delayMs < 60000) {
          await sleep(delayMs)
        }
      }

      await sendEvent(event)
      console.log(`Sent event ${lineNum}: ${event.event_type}`)

      if (event.occurred_at) {
        lastTimestamp = new Date(event.occurred_at)
      }
    } catch (err) {
      console.error(`Error parsing line ${lineNum}:`, err)
    }
  }

  console.log(`Replay complete. Sent ${lineNum} events.`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const filePath = args.find((a) => !a.startsWith('--'))
  const speedArg = args.find((a) => a.startsWith('--speed='))
  const speed = speedArg ? parseFloat(speedArg.split('=')[1]) : 1

  if (!filePath) {
    console.error('Usage: npm run replay -- <file.ndjson> [--speed=N]')
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  await replayFile(filePath, speed)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
