import 'server-only';

import { bulanIni } from '@/lib/format';
import { KATEGORI_GAJI } from '@/lib/konstanta';
import { klienServer } from '@/lib/supabase/server';
import type { Transaksi } from '@/lib/tipe-db';

/** Gaji rutin bulanan — tabel `karyawan` (schema.sql). RLS: hanya pemilik & admin yang bisa membaca. */
export type Karyawan = { id: string; nama: string; posisi: string | null; gaji_pokok: number; aktif: boolean };

export async function daftarKaryawan(): Promise<Karyawan[]> {
  const db = await klienServer();
  const { data } = await db.from('karyawan').select('id, nama, posisi, gaji_pokok, aktif').order('nama');
  return (data ?? []) as Karyawan[];
}

/**
 * Sudah dibayar bulan ini? = ada transaksi keluar kategori gaji di bulan berjalan
 * yang keterangannya menyebut nama karyawan. Dicatat lewat tombol, form, atau chat — semuanya terhitung.
 */
export function sudahDigaji(k: Karyawan, transaksi: Transaksi[], ym = bulanIni()) {
  const nama = k.nama.trim().toLowerCase();
  return transaksi.some(
    (t) => t.tipe === 'keluar' && t.kategori === KATEGORI_GAJI && t.tanggal.startsWith(ym) && (t.keterangan || '').toLowerCase().includes(nama),
  );
}

/** Karyawan aktif yang gajinya bulan ini belum tercatat. Pengingat muncul sejak tanggal 1. */
export async function gajiBelumDibayar(transaksi: Transaksi[]) {
  const semua = await daftarKaryawan();
  return semua.filter((k) => k.aktif && k.gaji_pokok > 0 && !sudahDigaji(k, transaksi));
}
