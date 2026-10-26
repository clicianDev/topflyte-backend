import { dropIndexIfExists, type Migration } from './types.ts';

/**
 * Phase 1 data model: indexes for users, projects and the activity log.
 * Must match the index declarations on the Mongoose schemas — tests/migrations.test.ts
 * fails if they drift apart.
 */
const migration: Migration = {
  id: '0001-initial-indexes',
  description: 'Create users, projects and activitylogs indexes',

  async up(db) {
    await db.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { 'stats.lastActivityAt': 1 } },
    ]);
    await db.collection('projects').createIndexes([{ key: { owner: 1, createdAt: -1 } }]);
    await db.collection('activitylogs').createIndexes([
      { key: { user: 1, createdAt: -1 } },
      { key: { action: 1, createdAt: -1 } },
      { key: { project: 1 }, sparse: true },
    ]);
  },

  async down(db) {
    for (const name of ['email_1', 'status_1', 'stats.lastActivityAt_1']) await dropIndexIfExists(db, 'users', name);
    await dropIndexIfExists(db, 'projects', 'owner_1_createdAt_-1');
    for (const name of ['user_1_createdAt_-1', 'action_1_createdAt_-1', 'project_1']) {
      await dropIndexIfExists(db, 'activitylogs', name);
    }
  },
};

export default migration;
