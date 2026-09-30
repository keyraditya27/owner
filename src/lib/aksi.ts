import 'server-only';

import { revalidatePath } from 'next/cache';
import type { PostgrestError } from '@supabase/supabase-js';
import { tanggalValid } from '@/lib/format';

import type { Hasil } from '@/lib/aksi-tipe';

export type { Hasil };

/** Terjemahkan galat Postgres/PostgREST jadi kalimat yang bisa dipahami tim. */
export function pesanGalat(e: PostgrestError | null | undefined, konteks = 'menyimpan'): string {
  if (!e) return `Gagal ${konteks}.`;
  if (e.code === '42501' || /row-level security/i.test(e.message)) return 'Akun ini tidak punya izin untuk perubahan ini.';
  if (e.code === '23505') return 'Data dengan nama/nomor yang sama sudah ada.';
  if (e.code === '23514') return 'Ada nilai yang tidak masuk akal (mis. dibayar melebihi tagihan).';
  if (e.code === '23503') return 'Data ini masih dipakai di tempat lain, atau pilihan yang dirujuk sudah tidak ada.';
  if (e.code === 'P0001') return e.message; // raise exception dari trigger, mis. periode sudah tutup buku
  return `Gagal ${konteks}: ${e.message}`;
}

/** Semua halaman memakai data yang sama — segarkan semuanya setelah perubahan. */
export const segarkan = () => revalidatePath('/', 'layout');

/* ---------------- validasi ---------------- */
export class Tolak extends Error {}

/** Menghapus data hanya boleh akun pemilik (Key). Dijaga juga oleh RLS (schema-tahap7.sql). */
export const PESAN_HAPUS = 'Hanya akun pemilik (Key) yang bisa menghapus data.';
export function wajibBolehHapus(p: { peran: string }) {
  if (p.peran !== 'pemilik') throw new Tolak(PESAN_HAPUS);
}

export const teks = (v: unknown, maks = 500) => String(v ?? '').trim().slice(0, maks);

export function wajibTeks(v: unknown, nama: string, maks = 500) {
  const s = teks(v, maks);
  if (!s) throw new Tolak(`${nama} wajib diisi.`);
  return s;
}

/** Rupiah bulat ≥ 0. Menerima "1.500.000", "1500000", "Rp 1.500.000". */
export function rupiah(v: unknown, nama: string, { wajibPositif = false } = {}) {
  let s = String(v ?? '').replace(/rp\.?/gi, '').replace(/\s/g, '');
  // Titik/koma hanya diterima sebagai pemisah ribuan (1.500.000). Selain itu = pecahan → tolak.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  if (s && !/^\d+$/.test(s)) {
    throw new Tolak(/^\d+[.,]\d+$/.test(s) ? `${nama} harus rupiah bulat, tanpa sen.` : `${nama} harus angka rupiah yang valid.`);
  }
  const n = Number(s || 0);
  if (n > 1e14) throw new Tolak(`${nama} terlalu besar.`);
  if (wajibPositif && n <= 0) throw new Tolak(`${nama} harus lebih dari nol.`);
  return n;
}

export function tanggal(v: unknown, nama: string) {
  const s = teks(v, 10);
  if (!tanggalValid(s)) throw new Tolak(`${nama} harus tanggal yang valid (YYYY-MM-DD).`);
  return s;
}

export function pilihan<T extends string>(v: unknown, daftar: readonly T[], nama: string): T {
  const s = teks(v, 100) as T;
  if (!daftar.includes(s)) throw new Tolak(`${nama} "${s}" tidak ada di daftar.`);
  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function idOpsional(v: unknown) {
  const s = teks(v, 40);
  if (!s) return null;
  if (!UUID.test(s)) throw new Tolak('Pilihan tidak valid.');
  return s;
}
export function idWajib(v: unknown) {
  const s = idOpsional(v);
  if (!s) throw new Tolak('Data yang dimaksud tidak ditemukan.');
  return s;
}

/** Bungkus action: ubah Tolak jadi { galat } dan galat lain jadi pesan umum. */
export async function jalankan(fn: () => Promise<Hasil>): Promise<Hasil> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Tolak) return { galat: e.message };
    // redirect()/notFound() dari Next harus diteruskan
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    console.error(e);
    return { galat: 'Terjadi kesalahan di server. Coba lagi.' };
  }
}
