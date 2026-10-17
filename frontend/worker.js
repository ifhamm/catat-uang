// Guard untuk host statis Cloudflare (Worker "catat-uang").
// Aplikasi memanggil backend lewat URL absolut (VITE_API_URL -> Heroku),
// jadi request ke /api/* di origin statis ini berarti konfigurasi salah.
// Jawab 404 agar cepat terdeteksi, bukan mengembalikan halaman HTML.
// Selain itu semua request diteruskan ke aset statis (env.ASSETS),
// termasuk fallback SPA untuk route dalam aplikasi.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return new Response("API tidak tersedia di origin ini. Periksa VITE_API_URL.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
