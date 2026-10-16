import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { ensureProfile } from '../db';

/**
 * Requests that have passed through `requireAuth` always carry a `userId`.
 * Handlers under `/api` are only reachable behind that middleware.
 */
export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * Reads the authenticated user id out of a request. Handlers only run behind
 * `requireAuth`, so a missing value is a programming error.
 */
export function userIdOf(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (!userId) {
    throw new Error('Missing authenticated user — requireAuth must run before this handler.');
  }
  return userId;
}

type AuthMode = 'asymmetric' | 'symmetric';

const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;

let mode: AuthMode = 'symmetric';
let client: ReturnType<typeof jwksClient> | null = null;

const knownProfiles = new Set<string>();

/**
 * Decides how bearer tokens will be verified. Asymmetric projects expose public
 * keys we can verify against directly; legacy symmetric projects require the
 * Supabase Auth server instead. Runs once at boot so requests stay fast.
 */
export async function initAuth(): Promise<void> {
  if (!SUPABASE_URL) {
    throw new Error(
      'SUPABASE_URL is not configured. Set SUPABASE_URL (or DATABASE_URL) in the environment.'
    );
  }

  try {
    const res = await fetch(JWKS_URI, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = (await res.json()) as { keys?: unknown[] };
    const keyCount = Array.isArray(body.keys) ? body.keys.length : 0;

    if (keyCount > 0) {
      mode = 'asymmetric';
      client = jwksClient({
        jwksUri: JWKS_URI,
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 10_000,
      });
      console.log(
        `Auth ready: asymmetric signing keys detected (${keyCount} key${keyCount === 1 ? '' : 's'}) — verifying locally via JWKS.`
      );
      return;
    }

    mode = 'symmetric';
    console.warn(
      'Auth ready: no asymmetric signing keys found — falling back to Supabase Auth server validation.'
    );
  } catch (err) {
    mode = 'symmetric';
    console.warn(
      `Auth ready: JWKS preflight failed (${(err as Error).message}) — falling back to Supabase Auth server validation.`
    );
  }
}

async function verifyViaJwks(token: string): Promise<string | undefined> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') throw new Error('Malformed token');

  const kid = decoded.header.kid;
  const signingKey = await client!.getSigningKey(kid);
  const payload = jwt.verify(token, signingKey.getPublicKey(), {
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
    issuer: ISSUER,
    audience: 'authenticated',
  }) as jwt.JwtPayload;

  return typeof payload.sub === 'string' ? payload.sub : undefined;
}

async function verifyViaAuthServer(token: string): Promise<string | undefined> {
  const res = await fetch(`${ISSUER}/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Auth server rejected token (HTTP ${res.status})`);

  const user = (await res.json()) as { id?: string };
  return user.id;
}

/** Requires a valid Supabase access token and exposes the user id on the request. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token autentikasi tidak ditemukan.' });
    return;
  }

  try {
    const userId =
      mode === 'asymmetric' && client
        ? await verifyViaJwks(token)
        : await verifyViaAuthServer(token);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token tidak valid.' });
      return;
    }

    (req as AuthedRequest).userId = userId;

    if (!knownProfiles.has(userId)) {
      try {
        await ensureProfile(userId);
        knownProfiles.add(userId);
      } catch (err) {
        console.warn(`Failed to ensure profile for ${userId}: ${(err as Error).message}`);
      }
    }

    next();
  } catch (err) {
    console.warn(`Auth rejected: ${(err as Error).message}`);
    res
      .status(401)
      .json({ error: 'Unauthorized', message: 'Sesi tidak valid atau sudah kedaluwarsa.' });
  }
}
