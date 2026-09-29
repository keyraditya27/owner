'use client';

import { useTransition } from 'react';
import { usePusat } from '@/components/form/PusatForm';
import { tautanBackup } from '@/app/(aplikasi)/aksi/kontrol';

/** Unduh satu file backup lewat signed URL 5 menit. */
export default function UnduhBackup({ nama }: { nama: string }) {
  const { kabar } = usePusat();
  const [proses, mulai] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm"
      disabled={proses}
      onClick={() =>
        mulai(async () => {
          const h = await tautanBackup(nama);
          if (h.url) window.location.href = h.url;
          else kabar(h.galat ?? 'Gagal');
        })
      }
    >
      {proses ? 'Menyiapkan…' : 'Unduh'}
    </button>
  );
}
