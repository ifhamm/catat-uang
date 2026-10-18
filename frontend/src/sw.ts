/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Generated at build time by vite-plugin-pwa (injectManifest).
declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0]
}

// ---------------------------------------------------------------------------
// App shell — replaces what the old generateSW config produced.
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.skipWaiting()
self.clients.claim()

// SPA navigation -> cached app shell, but never for API routes.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api/],
  }),
)

// ---------------------------------------------------------------------------
// Web Share Target (POST / with a multipart image).
// Once this worker is active, Chromium routes the share-target POST through
// us. We stash the screenshot in Cache Storage and answer with a 303 redirect
// so the browser follows up with a normal GET — useSharedImage claims the
// file, parses it, and opens the review modal (never an auto-save).
// ---------------------------------------------------------------------------
const SHARE_CACHE = 'catat-uang-share'
const SHARE_KEY = '/__share__/pending'

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'POST') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname !== '/' && url.pathname !== '/index.html') return

  event.respondWith(storeSharedImage(request))
})

async function storeSharedImage(request: Request): Promise<Response> {
  const target = (path: string) => new URL(path, self.location.origin).toString()

  try {
    const form = await request.formData()
    const file = form.get('screenshot')

    if (file instanceof File) {
      const cache = await caches.open(SHARE_CACHE)
      // Delete before writing: a crash between put/delete must never replay
      // the same screenshot into a new draft on every launch.
      await cache.delete(target(SHARE_KEY))
      await cache.put(
        target(SHARE_KEY),
        new Response(await file.arrayBuffer(), {
          headers: { 'content-type': file.type || 'image/png' },
        }),
      )
      return Response.redirect(target('/?shared=1'), 303)
    }

    return Response.redirect(target('/?shared=empty'), 303)
  } catch (err) {
    console.warn('Gagal menyimpan berkas dibagikan:', err)
    // Explicit flag instead of silently losing the share.
    return Response.redirect(target('/?shared=unavailable'), 303)
  }
}
