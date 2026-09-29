'use client';

import { useTransition } from 'react';
import { usePusat } from '@/components/form/PusatForm';
import type { Hasil } from '@/lib/aksi-tipe';

/**
 * Tombol yang memanggil server action (sudah di-bind dari server component).
 * `konfirmasi` → minta konfirmasi dulu. `minta` → minta teks (alasan/catatan) lewat prompt;
 * teksnya dikirim sebagai argumen terakhir.
 */
export default function TombolAksi({
  aksi,
  children,
  varian = 'btn-ghost',
  konfirmasi,
  minta,
  wajibIsi = false,
  className = '',
}: {
  aksi: (isian: string) => Promise<Hasil>;
  children: React.ReactNode;
  varian?: 'btn' | 'btn-ghost' | 'btn-hero';
  konfirmasi?: string;
  minta?: string;
  wajibIsi?: boolean;
  className?: string;
}) {
  const { kabar } = usePusat();
  const [proses, mulai] = useTransition();
  return (
    <button
      type="button"
      disabled={proses}
      className={`${varian} ${className}`}
      onClick={() =>
        mulai(async () => {
          let isian = '';
          if (minta) {
            const t = prompt(minta);
            if (t === null) return;
            if (wajibIsi && !t.trim()) return kabar('Wajib diisi');
            isian = t;
          } else if (konfirmasi && !confirm(konfirmasi)) return;
          const h = await aksi(isian);
          kabar(h.galat ?? h.pesan ?? 'Tersimpan');
        })
      }
    >
      {proses ? 'Memproses…' : children}
    </button>
  );
}
