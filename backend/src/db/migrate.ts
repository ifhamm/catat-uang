import 'dotenv/config';
import { pool } from './index';

export async function runMigrations() {
  console.log('Running Supabase database migrations...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Table: profiles
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
        locale TEXT NOT NULL DEFAULT 'id-ID',
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Table: operations (Idempotensi: FR05, FR11, Bagian 8 & 10)
    await client.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        operation_id UUID NOT NULL,
        action TEXT NOT NULL,
        payload_hash TEXT,
        result_id UUID,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_user_operation UNIQUE (user_id, operation_id)
      );
    `);

    // 3. Table: transactions (FR05, FR06, FR08, Bagian 10)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
        amount_idr BIGINT NOT NULL CHECK (amount_idr > 0 AND amount_idr <= 1000000000000),
        currency TEXT NOT NULL DEFAULT 'IDR',
        occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
        category TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('voice', 'text', 'manual')),
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);

    // Indexes (PRD baris 312)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, occurred_on DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions (user_id, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_operations_lookup ON operations (user_id, operation_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Supabase database migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// If run directly via node/tsx
if (require.main === module || process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
