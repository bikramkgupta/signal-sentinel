/**
 * OpenSearch bulk indexer with batching and idempotent writes.
 *
 * Uses event_id as the document ID for idempotency.
 * Batches documents and flushes on size threshold or explicit flush call.
 */

import { Client } from '@opensearch-project/opensearch';
import {
  createOpenSearchClient,
  ensureIndex,
  OPENSEARCH_INDEX,
  EventEnvelope,
} from '@signals/shared-types';

export interface BulkIndexerConfig {
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface BulkIndexer {
  add(event: EventEnvelope): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Create a bulk indexer instance.
 */
export function createBulkIndexer(config: BulkIndexerConfig = {}): BulkIndexer {
  const batchSize = config.batchSize ?? 100;
  const flushIntervalMs = config.flushIntervalMs ?? 5000;

  let client: Client | null = null;
  const buffer: EventEnvelope[] = [];
  let flushTimer: NodeJS.Timeout | null = null;
  let isClosed = false;

  /**
   * Get or create the OpenSearch client.
   */
  function getClient(): Client {
    if (!client) {
      client = createOpenSearchClient();
    }
    return client;
  }

  /**
   * Start the auto-flush timer.
   */
  function startFlushTimer(): void {
    if (flushTimer || isClosed) return;

    flushTimer = setInterval(async () => {
      if (buffer.length > 0) {
        await flush();
      }
    }, flushIntervalMs);
  }

  /**
   * Stop the auto-flush timer.
   */
  function stopFlushTimer(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * Convert an event to an OpenSearch document.
   * Uses event_id as document ID for idempotency.
   */
  function eventToDocument(event: EventEnvelope): object {
    return {
      event_id: event.event_id,
      org_id: event.org_id,
      project_id: event.project_id,
      environment: event.environment,
      event_type: event.event_type,
      severity: event.severity,
      occurred_at: event.occurred_at,
      received_at: event.received_at,
      message: event.message,
      attributes: event.attributes,
      fingerprint: (event as EventEnvelope & { fingerprint?: string }).fingerprint,
    };
  }

  /**
   * Flush the buffer to OpenSearch.
   */
  async function flush(): Promise<void> {
    if (buffer.length === 0) return;

    const events = buffer.splice(0, buffer.length);
    const osClient = getClient();

    // Build bulk request body
    const body: object[] = [];
    for (const event of events) {
      // Index action with document ID for idempotency
      body.push({
        index: {
          _index: OPENSEARCH_INDEX,
          _id: event.event_id,
        },
      });
      body.push(eventToDocument(event));
    }

    try {
      const response = await osClient.bulk({ body });

      if (response.body.errors) {
        // Log failed items but don't throw - idempotent writes may fail on version conflicts
        const failedItems = response.body.items.filter(
          (item: { index?: { error?: unknown } }) => item.index?.error
        );
        if (failedItems.length > 0) {
          console.warn(`Bulk index had ${failedItems.length} errors (may be duplicates)`);
        }
      }

      console.log(`Indexed ${events.length} events to OpenSearch`);
    } catch (err) {
      console.error('Bulk index failed:', err);
      // Re-add events to buffer for retry on next flush
      buffer.unshift(...events);
      throw err;
    }
  }

  /**
   * Add an event to the buffer.
   * Triggers flush if buffer exceeds batch size.
   */
  function add(event: EventEnvelope): void {
    if (isClosed) {
      throw new Error('BulkIndexer is closed');
    }

    buffer.push(event);
    startFlushTimer();

    if (buffer.length >= batchSize) {
      // Don't await - let it flush asynchronously
      flush().catch((err) => {
        console.error('Auto-flush failed:', err);
      });
    }
  }

  /**
   * Close the indexer, flushing remaining events.
   */
  async function close(): Promise<void> {
    if (isClosed) return;

    isClosed = true;
    stopFlushTimer();

    // Flush remaining events
    if (buffer.length > 0) {
      await flush();
    }

    if (client) {
      await client.close();
      client = null;
    }

    console.log('BulkIndexer closed');
  }

  return { add, flush, close };
}

/**
 * Initialize OpenSearch index mapping.
 * Safe to call multiple times - idempotent.
 */
export async function initializeIndex(): Promise<void> {
  const client = createOpenSearchClient();

  try {
    await ensureIndex(client);
  } finally {
    await client.close();
  }
}
