'use client';

import { useState, useTransition } from 'react';
import { buatPajakBulanLalu } from '@/app/(aplikasi)/aksi/aset-pajak';
import { usePusat } from '@/components/form/PusatForm';
import { InputRupiah } from '@/components/form/Isian';
import { rp } from '@/lib/format';

/** Tombol "Buat dari data <bulan lalu>" — generatePajak() di prototipe. */
export function TombolBuatPajak({ label }: { label: string }) {
  const { kabar, bolehKelola } = usePusat();
  const [proses, mulai] = useTransition();
  if (!bolehKelola) return null;
  return (
    <button
      className="btn-hero"
      disabled={proses}
      onClick={() =>
        mulai(async () => {
          const h = await buatPajakBulanLalu();
          if (h.galat) return kabar(h.galat);
          kabar(h.dibuat ? `${h.dibuat} kewajiban dibuat` : 'Semua kewajiban bulan itu sudah tercatat');
        })
      }
    >
      {proses ? 'Membuat…' : label}
    </button>
  );
}

const JENIS = {
  ppn: { t: 0.11, n: 'PPN keluaran', ket: 'Ditambahkan ke invoice, disetor ARL ke negara. Hanya wajib kalau sudah PKP.' },
  pph23: { t: 0.02, n: 'PPh 23', ket: 'Dipotong klien dari pembayaran. Minta bukti potongnya — jadi kredit pajak ARL.' },
  pph23n: { t: 0.04, n: 'PPh 23 tanpa NPWP', ket: 'Tarif naik 100% kalau lawan transaksi tidak ber-NPWP.' },
  pph42: { t: 0.1, n: 'PPh 4(2) sewa', ket: 'Final. Dipotong penyewa saat membayar sewa tanah/bangunan.' },
} as const;

/** Kalkulator cepat — hitungPajak() di prototipe. */
export function Kalkulator() {
  const [dpp, setDpp] = useState('10000000');
  const [j, setJ] = useState<keyof typeof JENIS>('ppn');
  const T = JENIS[j];
  const nilai = Number(dpp || 0);
  const pajak = Math.round(nilai * T.t);
  return (
    <>
      <div className="grid max-w-[620px] grid-cols-1 gap-[13px] sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kDpp">
            Nilai bruto (DPP)
          </label>
          <InputRupiah id="kDpp" nilai={dpp} ubah={setDpp} />
        </div>
        <div>
          <label className="label" htmlFor="kJenis">
            Jenis
          </label>
          <select id="kJenis" value={j} onChange={(e) => setJ(e.target.value as keyof typeof JENIS)}>
            <option value="ppn">PPN keluaran 11%</option>
            <option value="pph23">PPh 23 jasa 2% (dipotong klien)</option>
            <option value="pph23n">PPh 23 tanpa NPWP 4%</option>
            <option value="pph42">PPh 4(2) sewa 10%</option>
          </select>
        </div>
      </div>
      <div className="mt-4 grid max-w-[640px] grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[
          ['Nilai bruto', rp(nilai), 'border-t-biru bg-krem'],
          [T.n, rp(pajak), 'border-t-amber bg-amber-muda'],
          [j === 'ppn' ? 'Total tagihan' : 'Diterima bersih', rp(j === 'ppn' ? nilai + pajak : nilai - pajak), 'border-t-hijau bg-hijau-muda'],
        ].map(([l, v, c]) => (
          <div key={l} className={`rounded-[10px] border border-t-[3px] border-garis p-4 ${c}`}>
            <div className="text-[11px] font-bold uppercase tracking-[.6px] text-muted">{l}</div>
            <div className="num mt-1.5 font-serif text-[20px] font-bold">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[13px] text-muted">{T.ket}</p>
    </>
  );
}
