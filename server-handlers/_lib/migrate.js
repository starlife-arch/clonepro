import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from './postgres.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const filenames = (await readdir(migrationsDir))
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();

  const { rows } = await query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));

  for (const filename of filenames) {
    if (applied.has(filename)) continue;

    console.log(`[db] applying migration ${filename}`);
    const sql = await readFile(join(migrationsDir, filename), 'utf8');
    await query(sql);
    await query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename]);
  }
}
