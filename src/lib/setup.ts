import 'server-only';

import { klienAdmin } from '@/lib/supabase/admin';

/** Sudah ada pengguna terdaftar? Kalau ya, halaman /mulai terkunci selamanya. */
export async function sudahAdaPengguna(): Promise<boolean> {
  const admin = klienAdmin();
  const { count, error } = await admin.from('pengguna').select('id', { count: 'exact', head: true });
  if (error) {
    throw new Error('Tidak bisa membaca tabel pengguna. Sudah menjalankan schema.sql? (' + error.message + ')');
  }
  return (count ?? 0) > 0;
}
