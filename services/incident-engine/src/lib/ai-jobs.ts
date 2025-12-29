/**
 * AI Job Enqueueing
 *
 * Creates AI jobs for new incidents and notifies via Kafka.
 */

import { Producer } from 'kafkajs';
import { db, aiJobs } from '@signals/db';
import { TOPICS, createKafkaClient } from '@signals/shared-types';

let producer: Producer | null = null;

/**
 * Initialize the Kafka producer for AI job notifications.
 */
export async function initProducer(): Promise<void> {
  const kafka = createKafkaClient('incident-engine');
  producer = kafka.producer();
  await producer.connect();
  console.log('AI jobs producer connected to Kafka');
}

/**
 * Disconnect the Kafka producer.
 */
export async function closeProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log('AI jobs producer disconnected');
  }
}

/**
 * Enqueue an AI job for an incident.
 * Creates a job record in the database and publishes a notification to Kafka.
 */
export async function enqueueAiJob(incidentId: string): Promise<string> {
  // Create the job in the database
  const result = await db
    .insert(aiJobs)
    .values({
      incident_id: incidentId,
      job_type: 'incident_summary',
      status: 'queued',
      attempt_count: 0,
      max_attempts: 3,
      run_after: new Date(),
    })
    .returning();

  const job = result[0];
  console.log(`Enqueued AI job: ${job.id} for incident: ${incidentId}`);

  // Publish notification to Kafka if producer is available
  if (producer) {
    try {
      await producer.send({
        topic: TOPICS.AI_JOBS,
        messages: [
          {
            key: incidentId,
            value: JSON.stringify({
              job_id: job.id,
              incident_id: incidentId,
              job_type: 'incident_summary',
              created_at: job.created_at,
            }),
          },
        ],
      });
    } catch (err) {
      // Log but don't fail - the ai-worker can poll the database
      console.warn('Failed to publish AI job notification:', err);
    }
  }

  return job.id;
}
