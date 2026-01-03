/**
 * HTTP Client for sending events to ingest-api
 */

import type { TrafficGenConfig } from './config.js';
import type { RawEventInput } from '@signals/shared-types';

export class IngestClient {
  private config: TrafficGenConfig;
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 10;

  constructor(config: TrafficGenConfig) {
    this.config = config;
  }

  async sendEvent(event: Omit<RawEventInput, 'environment'>): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ingestApiUrl}/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          ...event,
          environment: this.config.environment,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to send event: ${response.status} ${text}`);
        this.consecutiveErrors++;
        return false;
      }

      this.consecutiveErrors = 0;
      return true;
    } catch (err) {
      console.error('Network error sending event:', err);
      this.consecutiveErrors++;
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ingestApiUrl}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  }

  isHealthy(): boolean {
    return this.consecutiveErrors < this.MAX_CONSECUTIVE_ERRORS;
  }
}
