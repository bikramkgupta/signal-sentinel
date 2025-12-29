/**
 * API Key Authentication
 *
 * Validates API keys against hashed keys stored in the database.
 * Returns the associated org_id and project_id for canonicalization.
 */

import { createHash } from 'crypto';
import { db, projectApiKeys, projects } from '@signals/db';
import { eq, isNull, and } from 'drizzle-orm';
import type { CanonicalizationContext } from '@signals/shared-types';

/**
 * Hash an API key for comparison.
 * Uses SHA-256 for simplicity in MVP.
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface AuthResult {
  valid: boolean;
  context?: CanonicalizationContext;
  error?: string;
}

/**
 * Validate an API key and return the associated context.
 *
 * @param apiKey - The raw API key from the X-API-Key header
 * @returns AuthResult with context if valid, or error message if invalid
 */
export async function validateApiKey(apiKey: string | undefined): Promise<AuthResult> {
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }

  const keyHash = hashApiKey(apiKey);

  try {
    // Find the API key and join with project to get org_id
    const result = await db
      .select({
        project_id: projectApiKeys.project_id,
        org_id: projects.org_id,
      })
      .from(projectApiKeys)
      .innerJoin(projects, eq(projectApiKeys.project_id, projects.id))
      .where(
        and(
          eq(projectApiKeys.key_hash, keyHash),
          isNull(projectApiKeys.revoked_at)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Update last_used_at (fire and forget)
    db.update(projectApiKeys)
      .set({ last_used_at: new Date() })
      .where(eq(projectApiKeys.key_hash, keyHash))
      .execute()
      .catch((err) => console.error('Failed to update last_used_at:', err));

    return {
      valid: true,
      context: {
        org_id: result[0].org_id,
        project_id: result[0].project_id,
      },
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Internal error during authentication' };
  }
}
