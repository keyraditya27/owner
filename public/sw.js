/*
 * Service worker ARL Keuangan.
 *
 * Sengaja minimal: data keuangan TIDAK PERNAH disimpan di cache HP.
 * Halaman selalu diambil langsung dari server supaya angka yang tampil
 * selalu terbaru dan sama di semua perangkat. Yang di-cache hanya file
 * statis (JS/CSS build, ikon, logo) dan halaman "sedang offline".
 */
const VERSI = 'arl-v1';
const HALAMAN_OFFLINE = '/offline';
const PRA_CACHE = [
  HALAMAN_OFFLINE,
  '/ikon/ikon-192.png',
  '/logo/arl-putih.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(PRA_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((daftar) => Promise.all(daftar.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const statis = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/ikon/') ||
    url.pathname.startsWith('/logo/'));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pindah halaman: selalu ke jaringan. Kalau gagal, tampilkan halaman offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(HALAMAN_OFFLINE)));
    return;
  }

  // File statis berversi: ambil dari cache dulu, simpan kalau belum ada.
  if (statis(url)) {
    e.respondWith(
      caches.match(req).then(
        (ada) =>
          ada ||
          fetch(req).then((res) => {
            if (res.ok) {
              const salinan = res.clone();
              caches.open(VERSI).then((c) => c.put(req, salinan));
            }
            return res;
          }),
      ),
    );
  }
  // Selain itu (API, data Supabase): tidak disentuh, langsung ke jaringan.
});
