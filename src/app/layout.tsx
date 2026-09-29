import type { Metadata, Viewport } from 'next';
import DaftarkanSW from '@/components/DaftarkanSW';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ARL Keuangan', template: '%s · ARL Keuangan' },
  description: 'Keuangan internal PT Arah Ruang Langit',
  applicationName: 'ARL Keuangan',
  appleWebApp: { capable: true, title: 'ARL Keuangan', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/ikon/ikon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/ikon/ikon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/ikon/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0A2540',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <DaftarkanSW />
      </body>
    </html>
  );
}
