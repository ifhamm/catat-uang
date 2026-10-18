import { useEffect } from 'react';
import { api } from '../services/api';
import { DraftTransaction } from '../types';

const SHARE_CACHE = 'catat-uang-share';
const SHARE_KEY = '/__share__/pending';

interface UseSharedImageOptions {
  /** Only run once a session exists — parsed drafts belong to a signed-in user. */
  enabled: boolean;
  onDraft: (draft: DraftTransaction) => void;
  onBusy?: (busy: boolean) => void;
  onError?: (message: string) => void;
}

/**
 * Claims a screenshot delivered by the Android Web Share Target:
 *  1. Chromium POSTs the image to our own service worker (src/sw.ts), or
 *  2. on the very first share (before the SW is active) the Cloudflare
 *     worker (worker.js) stashes it — same cache, same key.
 *
 * Either way the file waits in Cache Storage until this hook runs: it
 * deletes the entry first (a crash can never replay the same screenshot),
 * parses it through /api/image/parse, and opens the review modal. No
 * auto-save, no silent offline queue — failures surface as an error.
 */
export function useSharedImage({ enabled, onDraft, onBusy, onError }: UseSharedImageOptions): void {
  useEffect(() => {
    if (!enabled) return;
    if (!('caches' in window)) return;

    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('shared');

      // Strip the marker off the URL so a refresh doesn't re-trigger this.
      if (shared) {
        params.delete('shared');
        const query = params.toString();
        window.history.replaceState({}, '', query ? `?${query}` : window.location.pathname);
      }

      let file: File | null = null;
      try {
        const cacheKey = new URL(SHARE_KEY, window.location.origin).toString();
        const cache = await caches.open(SHARE_CACHE);
        const response = await cache.match(cacheKey);
        if (response) {
          // Delete FIRST: if parsing fails or the tab crashes, the screenshot
          // must not come back as a fresh draft on the next launch.
          await cache.delete(cacheKey);
          const blob = await response.blob();
          const type = response.headers.get('content-type') || 'image/png';
          file = new File([blob], 'tangkapan-layar', { type });
        }
      } catch (err) {
        console.warn('Gagal membaca berkas dibagikan:', err);
      }

      if (cancelled) return;

      if (!file) {
        if (shared === '1') {
          onError?.('Tangkapan layar yang dibagikan tidak ditemukan. Coba bagikan ulang, atau pilih gambar lewat tombol di beranda.');
        } else if (shared === 'unavailable') {
          onError?.('Buka Catat Uang dulu, lalu bagikan tangkapan layarnya dari menu berbagi.');
        } else if (shared === 'empty') {
          onError?.('Tidak ada gambar pada kiriman yang dibagikan.');
        }
        return;
      }

      try {
        onBusy?.(true);
        const draft = await api.parseImage(file);
        if (!cancelled) onDraft(draft);
      } catch (err: any) {
        console.error('Shared screenshot parsing error:', err);
        if (!cancelled) onError?.(err?.message || 'Gagal membaca tangkapan layar yang dibagikan.');
      } finally {
        if (!cancelled) onBusy?.(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // onDraft/onBusy/onError are expected to be stable setters from the app.
  }, [enabled, onDraft, onBusy, onError]);
}
