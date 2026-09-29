'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Aset, Klien, Pajak, Perusahaan, Rekening, Tagihan, Transaksi, UtangVendor, Vendor } from '@/lib/tipe-db';
import type { Peran } from '@/lib/tipe-db';
import type { TagihanTerbuka } from '@/lib/hitung';
import FormTransaksi from './FormTransaksi';
import FormKlien from './FormKlien';
import FormTagihan from './FormTagihan';
import { FormRekening, FormUtang, FormVendor } from './FormMaster';
import { Pengingat, PengingatMassal } from './Pengingat';
import LihatBukti from './LihatBukti';
import { FormAset, FormPajak, FormPerusahaan } from './FormAsetPajak';

/**
 * Pusat semua modal form. Tombol di mana pun (termasuk di server component)
 * cukup memakai <TombolForm buka={{ jenis: 'klien', data: k }}> — modal,
 * daftar pilihan (klien, rekening, vendor), dan notifikasi diurus di sini.
 */
export type Permintaan =
  | { jenis: 'transaksi'; data?: Transaksi }
  | { jenis: 'klien'; data?: Klien }
  | { jenis: 'tagihan'; klien: Klien; data?: Tagihan }
  | { jenis: 'rekening'; data?: Rekening }
  | { jenis: 'vendor'; data?: Vendor }
  | { jenis: 'utang'; vendor: Vendor; data?: UtangVendor }
  | { jenis: 'pengingat'; klien: Klien; tagihan: TagihanTerbuka[] }
  | { jenis: 'pengingat-massal'; telat: TagihanTerbuka[] }
  | { jenis: 'bukti'; transaksi: Transaksi; url?: string }
  | { jenis: 'aset'; data?: Aset; jenisAset?: 'tetap' | 'inventaris' }
  | { jenis: 'pajak'; data?: Pajak }
  | { jenis: 'perusahaan'; data: Perusahaan };

export type Pilihan = { klien: Klien[]; rekening: Rekening[]; vendor: Vendor[]; peran: Peran; penggunaId: string };

type Konteks = Pilihan & {
  buka: (p: Permintaan) => void;
  tutup: () => void;
  kabar: (teks: string) => void;
  bolehKelola: boolean;
};

const Ctx = createContext<Konteks | null>(null);
export const usePusat = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePusat di luar PusatForm');
  return c;
};

export default function PusatForm({ pilihan, children }: { pilihan: Pilihan; children: React.ReactNode }) {
  const [aktif, setAktif] = useState<Permintaan | null>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tutup = useCallback(() => setAktif(null), []);
  const kabar = useCallback((t: string) => {
    setToast(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const nilai: Konteks = {
    ...pilihan,
    buka: setAktif,
    tutup,
    kabar,
    bolehKelola: pilihan.peran === 'pemilik' || pilihan.peran === 'admin',
  };

  return (
    <Ctx.Provider value={nilai}>
      {children}
      {aktif?.jenis === 'transaksi' ? <FormTransaksi data={aktif.data} /> : null}
      {aktif?.jenis === 'klien' ? <FormKlien data={aktif.data} /> : null}
      {aktif?.jenis === 'tagihan' ? <FormTagihan klien={aktif.klien} data={aktif.data} /> : null}
      {aktif?.jenis === 'rekening' ? <FormRekening data={aktif.data} /> : null}
      {aktif?.jenis === 'vendor' ? <FormVendor data={aktif.data} /> : null}
      {aktif?.jenis === 'utang' ? <FormUtang vendor={aktif.vendor} data={aktif.data} /> : null}
      {aktif?.jenis === 'pengingat' ? <Pengingat klien={aktif.klien} tagihan={aktif.tagihan} /> : null}
      {aktif?.jenis === 'pengingat-massal' ? <PengingatMassal telat={aktif.telat} /> : null}
      {aktif?.jenis === 'bukti' ? <LihatBukti transaksi={aktif.transaksi} url={aktif.url} /> : null}
      {aktif?.jenis === 'aset' ? <FormAset data={aktif.data} jenis={aktif.jenisAset} /> : null}
      {aktif?.jenis === 'pajak' ? <FormPajak data={aktif.data} /> : null}
      {aktif?.jenis === 'perusahaan' ? <FormPerusahaan data={aktif.data} /> : null}
      <div
        role="status"
        className={`pointer-events-none fixed bottom-[calc(90px+env(safe-area-inset-bottom))] left-1/2 z-[80] -translate-x-1/2 rounded-[9px] bg-navy px-[18px] py-[11px] text-[13px] text-white shadow-toast transition-opacity lebar:bottom-[22px] ${
          toast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toast}
      </div>
    </Ctx.Provider>
  );
}

/** Tombol pembuka modal. `varian` mengikuti kelas tombol prototipe. */
export function TombolForm({
  buka,
  children,
  varian = 'btn',
  className = '',
  hanyaPengelola = false,
}: {
  buka: Permintaan;
  children: React.ReactNode;
  varian?: 'btn' | 'btn-ghost' | 'btn-hero';
  className?: string;
  hanyaPengelola?: boolean;
}) {
  const { buka: bukaModal, bolehKelola } = usePusat();
  if (hanyaPengelola && !bolehKelola) return null;
  return (
    <button type="button" className={`${varian} ${className}`} onClick={() => bukaModal(buka)}>
      {children}
    </button>
  );
}
