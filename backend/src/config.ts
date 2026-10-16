import 'dotenv/config';

/**
 * Resolves the Supabase project URL. Prefers an explicit SUPABASE_URL,
 * otherwise derives it from DATABASE_URL so existing setups keep working.
 */
function deriveSupabaseUrl(): string | undefined {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return undefined;

  // Direct connection: postgresql://postgres:pw@db.<ref>.supabase.co:5432/postgres
  const direct = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (direct) return `https://${direct[1]}.supabase.co`;

  // Pooler connection: postgresql://postgres.<ref>:pw@aws-0-<region>.pooler.supabase.com:6543/postgres
  const pooler = dbUrl.match(/\/\/postgres\.([a-z0-9]+):[^@]*@[^/]*\.supabase\.com/i);
  if (pooler) return `https://${pooler[1]}.supabase.co`;

  return undefined;
}

export const SUPABASE_URL = (process.env.SUPABASE_URL || deriveSupabaseUrl() || '').replace(/\/+$/, '');

/** Optional: only needed when the project uses the legacy symmetric signing key. */
export const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const CORS_ORIGINS = (
  process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const IS_PROD = process.env.NODE_ENV === 'production';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
