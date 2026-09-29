import type { MetadataRoute } from 'next';

/** Manifest PWA — yang membuat aplikasi bisa dipasang di layar utama HP dan desktop. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ARL Keuangan Internal',
    short_name: 'ARL Keuangan',
    description: 'Keuangan internal PT Arah Ruang Langit',
    lang: 'id',
    start_url: '/ringkasan',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0A2540',
    theme_color: '#0A2540',
    categories: ['finance', 'business'],
    icons: [
      { src: '/ikon/ikon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/ikon/ikon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/ikon/ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Transaksi', url: '/transaksi', icons: [{ src: '/ikon/ikon-192.png', sizes: '192x192' }] },
      { name: 'Klien & Tagihan', url: '/klien', icons: [{ src: '/ikon/ikon-192.png', sizes: '192x192' }] },
    ],
  };
}
