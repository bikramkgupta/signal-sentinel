/**
 * Kafka Consumer for Incident Engine
 *
 * Consumes events from signals.raw.v1, updates buckets, evaluates rules,
 * and manages incident lifecycle.
 */

import { Consumer, EachMessagePayload } from 'kafkajs';
import {
  createKafkaClient,
  CONSUMER_GROUPS,
  TOPICS,
  EventEnvelope,
} from '@signals/shared-types';
import { upsertBucket } from './buckets.js';
import { evaluateRules } from './rules.js';
import { processTriggeredEvent } from './incidents.js';
import { enqueueAiJob } from './ai-jobs.js';

let consumer: Consumer | null = null;

/**
 * Process a single event.
 * 1. Upsert bucket (atomic increment)
 * 2. Evaluate rules
 * 3. If triggered, process incident (create/update)
 * 4. If new incident, enqueue AI job
 */
async function processEvent(event: EventEnvelope): Promise<void> {
  try {
    // Step 1: Upsert bucket for metrics aggregation
    await upsertBucket(event);

    // Step 2: Evaluate rules
    const ruleResult = await evaluateRules(event);

    // Step 3: Process incident if rule triggered
    if (ruleResult?.triggered) {
      const action = await processTriggeredEvent({ event, ruleResult });

      // Step 4: Enqueue AI job for new incidents
      if (action.isNew && action.incident) {
        await enqueueAiJob(action.incident.id);
      }
    }
  } catch (err) {
    console.error(`Error processing event ${event.event_id}:`, err);
    // Don't rethrow - we want to continue processing other events
  }
}

/**
 * Start the Kafka consumer.
 */
export async function startConsumer(): Promise<void> {
  const kafka = createKafkaClient('incident-engine');

  consumer = kafka.consumer({
    groupId: CONSUMER_GROUPS.INCIDENT_ENGINE,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();
  console.log('Incident engine consumer connected to Kafka');

  await consumer.subscribe({
    topic: TOPICS.RAW_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message } = payload;

      if (!message.value) return;

      try {
        const event: EventEnvelope = JSON.parse(message.value.toString());
        await processEvent(event);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    },
  });

  console.log(`Incident engine consumer subscribed to topic: ${TOPICS.RAW_EVENTS}`);
}

/**
 * Stop the Kafka consumer gracefully.
 */
export async function stopConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('Incident engine consumer disconnected');
  }
}
