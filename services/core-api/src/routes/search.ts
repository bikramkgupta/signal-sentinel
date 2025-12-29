/**
 * Search Routes
 *
 * GET /v1/search/events - Proxy search to OpenSearch
 */

import { FastifyInstance } from 'fastify';
import {
  createOpenSearchClient,
  OPENSEARCH_INDEX,
} from '@signals/shared-types';

interface SearchQuerystring {
  q?: string;
  project_id?: string;
  environment?: string;
  event_type?: string;
  severity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

let osClient: ReturnType<typeof createOpenSearchClient> | null = null;

function getClient() {
  if (!osClient) {
    osClient = createOpenSearchClient();
  }
  return osClient;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/search/events
   * Search events in OpenSearch with filters
   */
  app.get<{ Querystring: SearchQuerystring }>(
    '/v1/search/events',
    async (request, reply) => {
      const {
        q,
        project_id,
        environment,
        event_type,
        severity,
        from,
        to,
        limit = 50,
        offset = 0,
      } = request.query;

      // Build query
      const must: object[] = [];
      const filter: object[] = [];

      // Full-text search on message
      if (q) {
        must.push({
          match: {
            message: {
              query: q,
              fuzziness: 'AUTO',
            },
          },
        });
      }

      // Filters
      if (project_id) {
        filter.push({ term: { project_id } });
      }
      if (environment) {
        filter.push({ term: { environment } });
      }
      if (event_type) {
        filter.push({ term: { event_type } });
      }
      if (severity) {
        filter.push({ term: { severity } });
      }

      // Time range
      if (from || to) {
        const range: { gte?: string; lte?: string } = {};
        if (from) range.gte = from;
        if (to) range.lte = to;
        filter.push({ range: { occurred_at: range } });
      }

      const query = {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      };

      try {
        const client = getClient();
        const response = await client.search({
          index: OPENSEARCH_INDEX,
          body: {
            query,
            sort: [{ occurred_at: { order: 'desc' } }],
            from: offset,
            size: Math.min(limit, 100),
          },
        });

        const hits = response.body.hits.hits.map((hit: { _id: string; _source: object }) => ({
          id: hit._id,
          ...hit._source,
        }));

        const total = typeof response.body.hits.total === 'number'
          ? response.body.hits.total
          : response.body.hits.total?.value ?? 0;

        return reply.send({
          events: hits,
          pagination: {
            total,
            limit: Math.min(limit, 100),
            offset,
            has_more: offset + hits.length < total,
          },
        });
      } catch (err) {
        console.error('OpenSearch query failed:', err);
        return reply.status(500).send({ error: 'Search failed' });
      }
    }
  );
}

/**
 * Close the OpenSearch client.
 */
export async function closeSearchClient(): Promise<void> {
  if (osClient) {
    await osClient.close();
    osClient = null;
  }
}
