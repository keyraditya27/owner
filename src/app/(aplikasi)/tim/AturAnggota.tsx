'use client';

import { useTransition } from 'react';
import { usePusat } from '@/components/form/PusatForm';
import { ubahAnggota } from './actions';

/** Ubah peran / aktifkan-nonaktifkan satu anggota (pemilik saja). */
export default function AturAnggota({ id, nama, peran, aktif }: { id: string; nama: string; peran: string; aktif: boolean }) {
  const { kabar } = usePusat();
  const [proses, mulai] = useTransition();
  const jalankan = (ubah: { peran?: string; aktif?: boolean }, konfirmasi?: string) =>
    mulai(async () => {
      if (konfirmasi && !confirm(konfirmasi)) return;
      const h = await ubahAnggota(id, ubah);
      kabar(h.galat ?? h.sukses ?? 'Tersimpan');
    });
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <select
        aria-label={`Peran ${nama}`}
        value={peran}
        disabled={proses}
        onChange={(e) => jalankan({ peran: e.target.value }, `Ubah peran ${nama} jadi ${e.target.value}?`)}
        className="!w-auto !py-1 !text-xs"
      >
        <option value="staf">staf</option>
        <option value="admin">admin</option>
      </select>
      <button
        className="btn-ghost btn-sm"
        disabled={proses}
        onClick={() =>
          jalankan({ aktif: !aktif }, aktif ? `Nonaktifkan ${nama}? Dia tidak bisa login lagi, datanya tetap ada.` : undefined)
        }
      >
        {aktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
    </div>
  );
}
