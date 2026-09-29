import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type Catatan = {
  penggunaId: string | null;
  tabel: string;
  recordId: string | null;
  aksi: 'insert' | 'update' | 'delete';
  nilaiLama?: unknown;
  nilaiBaru?: unknown;
  sumber?: 'manual' | 'ai' | 'sheet';
};

/**
 * Tulis satu baris audit_log. CLAUDE.md: setiap perubahan data wajib tercatat.
 * Dipanggil dengan klien service role karena tabel audit_log tidak punya
 * aturan tulis untuk pengguna biasa (sengaja, supaya log tidak bisa dipalsukan).
 */
export async function catatAudit(admin: SupabaseClient, c: Catatan) {
  const { error } = await admin.from('audit_log').insert({
    pengguna_id: c.penggunaId,
    tabel: c.tabel,
    record_id: c.recordId,
    aksi: c.aksi,
    nilai_lama: c.nilaiLama ?? null,
    nilai_baru: c.nilaiBaru ?? null,
    sumber: c.sumber ?? 'manual',
  });
  if (error) throw new Error('Gagal menulis audit_log: ' + error.message);
}
