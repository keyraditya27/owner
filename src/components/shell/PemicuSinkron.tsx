'use client';

import { useEffect } from 'react';
import { pemicuSinkron } from '@/app/(aplikasi)/aksi/sinkron';

/**
 * Selama aplikasi terbuka: minta server menyinkronkan sheet saat dibuka dan tiap 30 detik.
 * Server sendiri yang memutuskan perlu atau tidak (ada antrean, atau tarikan > 5 menit),
 * dan hanya satu proses yang jalan walau banyak HP/desktop terbuka bersamaan.
 * Tidak menyimpan data apa pun di perangkat.
 */
let jalan = false;
let ulang: ReturnType<typeof setTimeout> | undefined;
async function picu() {
  if (jalan || document.visibilityState !== 'visible' || !navigator.onLine) return;
  jalan = true;
  try {
    const h = await pemicuSinkron();
    if (h.cobaLagiMs) {
      clearTimeout(ulang);
      ulang = setTimeout(picu, Math.min(h.cobaLagiMs, 30_000));
    }
  } catch {
    /* sesi habis / offline — dicoba lagi nanti */
  } finally {
    jalan = false;
  }
}

/**
 * `jejak` berganti tiap layout dirender ulang — setelah setiap simpan/ubah/hapus
 * (server action menyegarkan layout) dan setiap pindah halaman. Perubahan baru
 * langsung didorong ke sheet tanpa menunggu putaran 30 detik berikutnya.
 */
export default function PemicuSinkron({ jejak }: { jejak: string }) {
  useEffect(() => {
    const t = setInterval(picu, 30_000);
    document.addEventListener('visibilitychange', picu);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', picu);
    };
  }, []);
  useEffect(() => {
    const t = setTimeout(picu, 1500);
    return () => clearTimeout(t);
  }, [jejak]);
  return null;
}
