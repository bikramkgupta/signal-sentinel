/**
 * Kafka Producer for publishing events
 */

import { Producer } from 'kafkajs';
import {
  createKafkaClient,
  TOPICS,
  kafkaKey,
  type EventEnvelope,
} from '@signals/shared-types';

let producer: Producer | null = null;

/**
 * Initialize the Kafka producer.
 * Call this on server startup.
 */
export async function initKafkaProducer(): Promise<void> {
  if (producer) {
    return;
  }

  const kafka = createKafkaClient('ingest-api');
  producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  });

  await producer.connect();
  console.log('Kafka producer connected');
}

/**
 * Publish a single event to Kafka.
 */
export async function publishEvent(event: EventEnvelope): Promise<void> {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }

  await producer.send({
    topic: TOPICS.RAW_EVENTS,
    messages: [
      {
        key: kafkaKey(event),
        value: JSON.stringify(event),
        headers: {
          'event-type': event.event_type,
          'schema-version': event.schema_version,
        },
      },
    ],
  });
}

/**
 * Publish multiple events to Kafka in a batch.
 */
export async function publishEvents(events: EventEnvelope[]): Promise<void> {
  if (!producer) {
    throw new Error('Kafka producer not initialized');
  }

  await producer.send({
    topic: TOPICS.RAW_EVENTS,
    messages: events.map((event) => ({
      key: kafkaKey(event),
      value: JSON.stringify(event),
      headers: {
        'event-type': event.event_type,
        'schema-version': event.schema_version,
      },
    })),
  });
}

/**
 * Disconnect the Kafka producer.
 * Call this on server shutdown.
 */
export async function disconnectKafkaProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log('Kafka producer disconnected');
  }
}
