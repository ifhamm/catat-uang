import { Transaction, MonthSummary, DraftTransaction } from '../types';
import { supabase } from '../lib/supabase';

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const API_BASE = configuredBase
  ? configuredBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? `http://${window.location.hostname}:3001`
    : '';

let unauthorizedHandler: (() => void) | null = null;

/** Lets the app react to an expired session (e.g. by signing the user out). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Performs an authenticated request. Retries once for transient failures,
 * which covers the Render free-tier cold start (~60s) and short network blips.
 */
async function request(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  if (!API_BASE) {
    throw new Error('Alamat backend belum dikonfigurasi.');
  }

  const headers = new Headers(init.headers);
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    if (allowRetry) {
      await delay(1500);
      return request(path, init, false);
    }
    throw new Error('Tidak bisa menghubungi server. Periksa koneksi internetmu.');
  }

  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new Error('Sesi berakhir. Silakan masuk lagi.');
  }

  if (allowRetry && (res.status === 502 || res.status === 503 || res.status === 504)) {
    await delay(1800);
    return request(path, init, false);
  }

  return res;
}

async function readJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err: any = new Error(data?.message || data?.error || fallbackMessage);
    err.code = data?.code;
    err.isWarning = data?.isWarning;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

export const api = {
  // Summary
  async getSummary(month?: string): Promise<MonthSummary> {
    const path = month ? `/api/summary?month=${month}` : '/api/summary';
    return readJson<MonthSummary>(await request(path), 'Gagal mengambil ringkasan keuangan');
  },

  // Recent transactions (3 items)
  async getRecentTransactions(): Promise<Transaction[]> {
    return readJson<Transaction[]>(
      await request('/api/transactions/recent'),
      'Gagal mengambil transaksi terbaru'
    );
  },

  // List transactions
  async getTransactions(filters?: { month?: string; type?: string }): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (filters?.month) params.append('month', filters.month);
    if (filters?.type && filters.type !== 'ALL') params.append('type', filters.type);

    return readJson<Transaction[]>(
      await request(`/api/transactions?${params.toString()}`),
      'Gagal mengambil riwayat transaksi'
    );
  },

  // Create transaction with idempotency
  async createTransaction(payload: {
    operation_id: string;
    type: 'INCOME' | 'EXPENSE';
    amount_idr: number;
    category: string;
    occurred_on?: string;
    description?: string | null;
    source?: 'voice' | 'text' | 'manual';
    confirm_duplicate?: boolean;
  }): Promise<{ transaction: Transaction; isIdempotentReplay: boolean }> {
    const res = await request('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson(res, 'Gagal menyimpan transaksi');
  },

  // Update transaction
  async updateTransaction(
    id: string,
    payload: {
      expected_version: number;
      type?: 'INCOME' | 'EXPENSE';
      amount_idr?: number;
      category?: string;
      occurred_on?: string;
      description?: string | null;
      operation_id?: string;
    }
  ): Promise<Transaction> {
    const res = await request(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson<Transaction>(res, 'Gagal memperbarui transaksi');
  },

  // Soft delete transaction
  async deleteTransaction(id: string): Promise<{ message: string; transaction: Transaction }> {
    const res = await request(`/api/transactions/${id}`, { method: 'DELETE' });
    return readJson(res, 'Gagal menghapus transaksi');
  },

  // Restore transaction (within 7 days)
  async restoreTransaction(id: string): Promise<{ message: string; transaction: Transaction }> {
    const res = await request(`/api/transactions/${id}/restore`, { method: 'POST' });
    return readJson(res, 'Gagal memulihkan transaksi');
  },

  // Quick text parser
  async parseText(text: string): Promise<DraftTransaction> {
    const res = await request('/api/text/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await readJson<any>(res, 'Gagal memproses teks');
    return {
      type: data.type,
      amount_idr: data.amount_idr,
      category: data.category,
      occurred_on: data.occurred_on,
      description: data.description,
      source: 'text',
      notes: data.notes,
    };
  },

  // Voice parse
  async parseVoice(audioBlob: Blob): Promise<{
    text: string;
    detectedNominal?: number;
    notes?: string;
    processingTimeMs: number;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.audio');

    const res = await request('/api/voice/parse', { method: 'POST', body: formData });
    return readJson(res, 'Gagal memproses suara');
  },
};
