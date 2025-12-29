/**
 * AI Worker - Job Processor
 *
 * Processes AI jobs by:
 * 1. Polling Postgres for available jobs (with Kafka notifications for wakeup)
 * 2. Acquiring lease on job
 * 3. Fetching incident context
 * 4. Calling Gradient AI
 * 5. Storing output
 * 6. Handling failures with retry
 */

import { Consumer } from 'kafkajs';
import { db, aiOutputs } from '@signals/db';
import {
  createKafkaClient,
  CONSUMER_GROUPS,
  TOPICS,
} from '@signals/shared-types';
import { createGradientClient, GradientClient } from './gradient.js';
import { acquireJob, completeJob, failJob } from './lease.js';
import {
  fetchIncidentContext,
  buildPromptMessages,
  parseAIResponse,
} from './prompt.js';

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const PROCESS_TIMEOUT_MS = 90000; // 90 second timeout for AI calls

let consumer: Consumer | null = null;
let gradientClient: GradientClient | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let isProcessing = false;

/**
 * Process a single job.
 */
async function processJob(): Promise<boolean> {
  if (!gradientClient) {
    console.error('Gradient client not initialized');
    return false;
  }

  // Try to acquire a job
  const job = await acquireJob();
  if (!job) {
    return false; // No jobs available
  }

  console.log(`Processing job: ${job.id} for incident: ${job.incident_id}`);

  try {
    // Fetch incident context
    const context = await fetchIncidentContext(job.incident_id);
    if (!context) {
      throw new Error(`Incident not found: ${job.incident_id}`);
    }

    // Build prompt
    const messages = buildPromptMessages(context.incident, context.events);

    // Call Gradient AI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROCESS_TIMEOUT_MS);

    let response: string;
    try {
      response = await gradientClient.chat(messages, {
        maxTokens: 1024,
        temperature: 0.7,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Parse response
    const summary = parseAIResponse(response);

    // Store output
    await db.insert(aiOutputs).values({
      incident_id: job.incident_id,
      output_type: 'summary',
      model: process.env.GRADIENT_MODEL || 'unknown',
      content_json: summary,
    });

    // Mark job as completed
    await completeJob(job.id);
    console.log(`Job succeeded: ${job.id}`);

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Job failed: ${job.id} - ${errorMessage}`);

    // Mark job as failed (will retry if attempts remain)
    await failJob(job.id, errorMessage, job.attempt_count, job.max_attempts);

    return false;
  }
}

/**
 * Poll for jobs and process them.
 */
async function pollAndProcess(): Promise<void> {
  if (isProcessing || !isRunning) return;

  isProcessing = true;
  try {
    // Keep processing while jobs are available
    let processed = true;
    while (processed && isRunning) {
      processed = await processJob();
    }
  } catch (err) {
    console.error('Error in poll loop:', err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the worker.
 */
export async function startWorker(): Promise<void> {
  console.log('Starting AI worker...');

  // Initialize Gradient client
  gradientClient = createGradientClient();
  console.log('Gradient client initialized');

  // Start Kafka consumer for job notifications (optional wakeup)
  const kafka = createKafkaClient('ai-worker');
  consumer = kafka.consumer({
    groupId: CONSUMER_GROUPS.AI_WORKER,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();
  console.log('AI worker consumer connected to Kafka');

  await consumer.subscribe({
    topic: TOPICS.AI_JOBS,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async () => {
      // Kafka message is just a wakeup signal - trigger immediate poll
      if (!isProcessing) {
        pollAndProcess().catch((err) => {
          console.error('Error processing after Kafka wakeup:', err);
        });
      }
    },
  });

  console.log(`AI worker subscribed to topic: ${TOPICS.AI_JOBS}`);

  // Start polling timer
  isRunning = true;
  pollTimer = setInterval(() => {
    pollAndProcess().catch((err) => {
      console.error('Error in poll timer:', err);
    });
  }, POLL_INTERVAL_MS);

  // Initial poll
  pollAndProcess().catch((err) => {
    console.error('Error in initial poll:', err);
  });

  console.log('AI worker started');
}

/**
 * Stop the worker gracefully.
 */
export async function stopWorker(): Promise<void> {
  console.log('Stopping AI worker...');

  isRunning = false;

  // Stop poll timer
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // Wait for current processing to complete
  while (isProcessing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Disconnect Kafka consumer
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }

  console.log('AI worker stopped');
}
