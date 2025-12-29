/**
 * Database Seeder
 *
 * Run with: npm run seed --workspace=db
 *
 * Creates initial development data:
 * - Demo organization
 * - Demo project
 * - Development API key
 */

import { createHash } from 'crypto';
import { db, closeDb, orgs, projects, projectApiKeys } from './index.js';

/**
 * Hash an API key for storage.
 * In production, use a proper password hashing algorithm like bcrypt.
 * For simplicity in MVP, we use SHA-256.
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function seed() {
  console.log('Seeding database...');

  try {
    // Create demo organization
    const orgId = 'org_demo';
    await db.insert(orgs).values({
      id: orgId,
      name: 'Demo Organization',
    }).onConflictDoNothing();
    console.log('Created organization:', orgId);

    // Create demo project
    const projectId = 'proj_demo';
    await db.insert(projects).values({
      id: projectId,
      org_id: orgId,
      name: 'Demo Project',
    }).onConflictDoNothing();
    console.log('Created project:', projectId);

    // Create development API key
    // The plaintext key is: dev-api-key-12345
    // Users will send this key in the X-API-Key header
    const devApiKey = 'dev-api-key-12345';
    const keyHash = hashApiKey(devApiKey);

    await db.insert(projectApiKeys).values({
      project_id: projectId,
      key_hash: keyHash,
    }).onConflictDoNothing();
    console.log('Created API key for project');
    console.log('');
    console.log('==============================================');
    console.log('Development API Key: ' + devApiKey);
    console.log('Use this in the X-API-Key header');
    console.log('==============================================');

    console.log('');
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

seed();
