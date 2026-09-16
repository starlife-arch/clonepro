import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL is not configured');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const connectionCheck = pool.query('SELECT 1')
  .then(() => console.log('[db] PostgreSQL connection established'))
  .catch((error) => console.error('[db] PostgreSQL connection failed', error));

export async function query(sql, params = []) {
  await connectionCheck;
  return pool.query(sql, params);
}

export { pool };
