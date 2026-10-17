import pg from 'pg';
const { Pool, types } = pg;

// Return DATE columns (OID 1082) as plain 'YYYY-MM-DD' strings. pg otherwise
// parses them into a Date at *local* midnight, which shifts the day when it is
// later serialized to UTC (e.g. 2026-10-17 became 2026-10-16 in Asia/Jakarta).
types.setTypeParser(1082, (value) => value);

// Supabase PostgreSQL Pool
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

/** Creates the profile row for a user on first sight. Safe to call repeatedly. */
export async function ensureProfile(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO profiles (user_id, timezone, locale)
     VALUES ($1, 'Asia/Jakarta', 'id-ID')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}
