import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { klienServer } from '@/lib/supabase/server';

export type Peran = 'pemilik' | 'admin' | 'staf';

export type PenggunaAktif = {
  id: string;
  email: string;
  nama: string;
  peran: Peran;
};

/**
 * Pengguna yang sedang login beserta profilnya di tabel `pengguna`.
 * null kalau belum login, atau akunnya ada di Auth tapi belum terdaftar /
 * sudah dinonaktifkan di tabel `pengguna`.
 * Dibungkus cache() supaya satu permintaan halaman cukup satu kali cek.
 */
export const penggunaSaatIni = cache(async (): Promise<PenggunaAktif | null> => {
  const supabase = await klienServer();
  // getClaims() memverifikasi token; dengan kunci asimetris tanpa panggilan ke server Auth.
  const { data: klaim } = await supabase.auth.getClaims();
  const id = klaim?.claims?.sub;
  if (!id) return null;

  // Butuh aturan "baca_pengguna" dari schema-perbaikan-tahap1.sql.
  const { data } = await supabase.from('pengguna').select('nama, peran, aktif').eq('id', id).maybeSingle();
  if (!data || !data.aktif) return null;

  return { id, email: String(klaim.claims.email ?? ''), nama: data.nama, peran: data.peran as Peran };
});

/** Untuk halaman di dalam aplikasi: wajib login dan terdaftar aktif. */
export async function wajibLogin(): Promise<PenggunaAktif> {
  const p = await penggunaSaatIni();
  if (!p) redirect('/login?alasan=tidak-terdaftar');
  return p;
}

/** Untuk halaman/aksi khusus pemilik. */
export async function wajibPemilik(): Promise<PenggunaAktif> {
  const p = await wajibLogin();
  if (p.peran !== 'pemilik') redirect('/ringkasan');
  return p;
}
