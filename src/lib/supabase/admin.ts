import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

/**
 * Klien service role — MELEWATI semua aturan RLS.
 * `import 'server-only'` di atas membuat build gagal kalau file ini
 * sampai diimpor oleh komponen browser. Pakai hanya untuk pekerjaan
 * yang memang butuh hak admin (mis. membuat akun anggota tim).
 */
export function klienAdmin() {
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !kunci) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local');
  }
  return createClient(SUPABASE_URL, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
