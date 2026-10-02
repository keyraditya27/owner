import 'server-only';

import { cache } from 'react';
import { klienServer } from '@/lib/supabase/server';
import type { BarisInv } from '@/lib/invoice';

export type Kelompok = { id: string; nama: string; urutan: number; aktif: boolean };
export type Layanan = {
  id: string;
  kelompok_id: string;
  nama: string;
  deskripsi: string | null;
  satuan: string;
  harga: number;
  porsi_hemat: number;
  porsi_standar: number;
  porsi_premium: number;
  berulang: boolean;
  urutan: number;
  aktif: boolean;
};
export type Dokumen = {
  id: string;
  jenis: 'penawaran' | 'invoice';
  kode: string;
  nomor: string | null;
  klien_id: string | null;
  tanggal: string;
  tempo_hari: number;
  durasi_bulan: number;
  porsi: string | null;
  diskon: number;
  diskon_tipe: 'rp' | 'pct';
  ppn_aktif: boolean;
  pph23: boolean;
  subtotal: number;
  dpp: number;
  ppn: number;
  total: number;
  pph23_nilai: number;
  diterima: number;
  status: 'Draf' | 'Terkirim' | 'Lunas' | 'Batal';
  catatan: string | null;
  tagihan_id: string | null;
  transaksi_id: string | null;
  dibuat_pada: string;
};

export const ambilKatalog = cache(async () => {
  const db = await klienServer();
  const [k, l] = await Promise.all([
    db.from('kelompok_layanan').select('*').order('urutan').order('nama'),
    db.from('layanan').select('*').order('urutan').order('nama'),
  ]);
  if (k.error || l.error) throw new Error('Gagal membaca katalog: ' + (k.error ?? l.error)!.message);
  return { kelompok: (k.data ?? []) as Kelompok[], layanan: (l.data ?? []) as Layanan[] };
});

export const ambilDaftarDokumen = cache(async () => {
  const db = await klienServer();
  const { data, error } = await db.from('dokumen').select('*').order('tanggal', { ascending: false }).order('dibuat_pada', { ascending: false });
  if (error) throw new Error('Gagal membaca dokumen: ' + error.message);
  return (data ?? []) as Dokumen[];
});

export async function ambilDokumen(id: string) {
  const db = await klienServer();
  const [d, b] = await Promise.all([
    db.from('dokumen').select('*').eq('id', id).maybeSingle(),
    db.from('baris_dokumen').select('*').eq('dokumen_id', id).order('urutan'),
  ]);
  if (!d.data) return null;
  return { dok: d.data as Dokumen, baris: (b.data ?? []) as BarisInv[] };
}
