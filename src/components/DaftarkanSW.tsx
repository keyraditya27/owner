'use client';

import { useEffect } from 'react';

/** Mendaftarkan service worker supaya aplikasi bisa dipasang (PWA). */
export default function DaftarkanSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Di mode dev, service worker bikin halaman lama tersangkut di cache — lewati.
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
