// Guard untuk host statis Cloudflare (Worker "catat-uang").
// Aplikasi memanggil backend lewat URL absolut (VITE_API_URL -> Heroku),
// jadi request ke /api/* di origin statis ini berarti konfigurasi salah.
// Jawab 404 agar cepat terdeteksi, bukan mengembalikan halaman HTML.
//
// Selain itu:
// - POST / (Web Share Target, saat service worker belum aktif) ditangani di
//   sini: berkas gambar disimpan ke Cache Storage lalu di-redirect 303 ke
//   /?shared=1. Bila Cache Storage tidak tersedia (mis. domain workers.dev),
//   balas dengan flag ?shared=unavailable supaya aplikasi menampilkan error
//   eksplisit — tidak pernah kehilangan tangkapan layar diam-diam.
// - Request lain diteruskan ke aset statis (env.ASSETS), termasuk fallback
//   SPA untuk route dalam aplikasi.

const SHARE_CACHE = "catat-uang-share";
const SHARE_KEY = "/__share__/pending";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Web Share Target: Android membagikan tangkapan layar ke aplikasi
    // terpasang lewat POST multipart ke halaman utama.
    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const redirect = (path) => Response.redirect(new URL(path, url.origin).toString(), 303);
      try {
        const form = await request.formData();
        const file = form.get("screenshot");
        if (file && typeof file !== "string") {
          const cacheKey = new URL(SHARE_KEY, url.origin).toString();
          const cache = await caches.open(SHARE_CACHE);
          // Hapus dulu agar crash di tengah tidak membuat berkas yang sama
          // terus menerus menjadi draf baru.
          await cache.delete(cacheKey);
          await cache.put(
            cacheKey,
            new Response(await file.arrayBuffer(), {
              headers: { "content-type": file.type || "image/png" },
            })
          );
          return redirect("/?shared=1");
        }
        return redirect("/?shared=empty");
      } catch (err) {
        console.warn("Gagal menyimpan berkas dibagikan:", err);
        return redirect("/?shared=unavailable");
      }
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return new Response("API tidak tersedia di origin ini. Periksa VITE_API_URL.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
