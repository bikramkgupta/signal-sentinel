/**
 * Auto-Resolve Ticker
 *
 * Periodically checks for stale incidents and resolves them.
 * An incident is considered stale if it hasn't been seen in 15 minutes.
 */

import { findStaleIncidents, resolveIncident } from './incidents.js';

const TICKER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_AFTER_MINUTES = 15; // Resolve incidents not seen in 15 min

let tickerInterval: NodeJS.Timeout | null = null;

/**
 * Run a single auto-resolve check.
 */
async function runAutoResolve(): Promise<void> {
  try {
    const staleIncidents = await findStaleIncidents(STALE_AFTER_MINUTES);

    if (staleIncidents.length > 0) {
      console.log(`Auto-resolving ${staleIncidents.length} stale incidents...`);

      for (const incident of staleIncidents) {
        try {
          await resolveIncident(incident.id);
        } catch (err) {
          console.error(`Failed to resolve incident ${incident.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Auto-resolve check failed:', err);
  }
}

/**
 * Start the auto-resolve ticker.
 * Runs immediately and then every 5 minutes.
 */
export function startAutoResolveTicker(): void {
  if (tickerInterval) {
    console.warn('Auto-resolve ticker already running');
    return;
  }

  console.log('Starting auto-resolve ticker (every 5 minutes)');

  // Run immediately on startup
  runAutoResolve().catch((err) => {
    console.error('Initial auto-resolve failed:', err);
  });

  // Then run every 5 minutes
  tickerInterval = setInterval(() => {
    runAutoResolve().catch((err) => {
      console.error('Auto-resolve tick failed:', err);
    });
  }, TICKER_INTERVAL_MS);
}

/**
 * Stop the auto-resolve ticker.
 */
export function stopAutoResolveTicker(): void {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
    console.log('Auto-resolve ticker stopped');
  }
}
