import { fileURLToPath } from 'node:url';
import { getDb } from '../server-handlers/_lib/firebase.js';
import { query } from '../server-handlers/_lib/postgres.js';

/**
 * One-time role migration: mirror Firestore administrators into PostgreSQL.
 */
export async function migrateAdminRoles() {
  const snapshot = await getDb().collection('users').where('role', '==', 'admin').get();
  let updated = 0;

  for (const user of snapshot.docs) {
    const { rowCount } = await query('UPDATE users SET role = $2 WHERE id = $1', [user.id, 'admin']);
    updated += rowCount;
  }

  const report = { firestoreAdmins: snapshot.size, updated };
  console.log('[migration] admin roles complete', report);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateAdminRoles().catch((error) => {
    console.error('[migration] admin roles failed', error);
    process.exitCode = 1;
  });
}
