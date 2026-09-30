import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Bukti transfer (PDF sampai 8 MB) dikirim lewat server action. Foto sudah dikecilkan di browser.
    serverActions: { bodySizeLimit: '10mb' },
  },
  async headers() {
    return [
      {
        // Service worker harus selalu diambil ulang supaya pembaruan aplikasi cepat sampai ke HP.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Verifikasi aplikasi Android (APK/TWA): Android membaca file ini untuk membuka
        // aplikasi layar penuh tanpa bilah alamat. Harus JSON dan bisa dibuka tanpa login.
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;
