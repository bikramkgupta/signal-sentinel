/**
 * Kafka consumer for the indexer service.
 * Consumes events from signals.raw.v1 and sends them to the bulk indexer.
 */

import { Consumer, EachBatchPayload } from 'kafkajs';
import {
  createKafkaClient,
  CONSUMER_GROUPS,
  TOPICS,
  EventEnvelope,
} from '@signals/shared-types';
import { BulkIndexer } from './opensearch.js';

export interface ConsumerConfig {
  bulkIndexer: BulkIndexer;
}

let consumer: Consumer | null = null;

/**
 * Start the Kafka consumer.
 * Uses batch processing for efficiency.
 */
export async function startConsumer(config: ConsumerConfig): Promise<void> {
  const kafka = createKafkaClient('indexer');

  consumer = kafka.consumer({
    groupId: CONSUMER_GROUPS.INDEXER,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();
  console.log('Indexer consumer connected to Kafka');

  await consumer.subscribe({
    topic: TOPICS.RAW_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    eachBatchAutoResolve: true,
    eachBatch: async (payload: EachBatchPayload) => {
      const { batch, heartbeat } = payload;

      for (const message of batch.messages) {
        if (!message.value) continue;

        try {
          const event: EventEnvelope = JSON.parse(message.value.toString());
          config.bulkIndexer.add(event);
        } catch (err) {
          console.error('Failed to parse event:', err);
        }

        // Heartbeat periodically to prevent session timeout
        await heartbeat();
      }

      // Flush after processing batch
      await config.bulkIndexer.flush();
    },
  });

  console.log(`Indexer consumer subscribed to topic: ${TOPICS.RAW_EVENTS}`);
}

/**
 * Stop the Kafka consumer gracefully.
 */
export async function stopConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log('Indexer consumer disconnected');
  }
}
