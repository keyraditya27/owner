import 'server-only';

import { klienAdmin } from '@/lib/supabase/admin';

/**
 * Backup seluruh data ke JSON di bucket privat `backup`.
 * Memakai service role (melewati RLS) supaya SEMUA baris ikut, termasuk gaji,
 * audit log, dan data yang tidak terlihat oleh peran tertentu. Karena itu file
 * backup hanya bisa diunduh pemilik.
 *
 * Urutan tabel = urutan pemulihan (induk dulu, anak belakangan).
 */
export const TABEL_BACKUP = [
  'perusahaan',
  'pengguna',
  'rekening',
  'klien',
  'vendor',
  'tagihan',
  'utang_vendor',
  'transaksi',
  'aset',
  'mutasi_aset',
  'pajak',
  'karyawan',
  'payroll',
  'pengajuan',
  'tutup_buku',
  'ai_riwayat',
  'audit_log',
] as const;

export async function buatBackup(oleh: string) {
  const admin = klienAdmin();
  const tabel: Record<string, unknown[]> = {};
  for (const t of TABEL_BACKUP) {
    const semua: unknown[] = [];
    for (let dari = 0; ; dari += 1000) {
      const { data, error } = await admin.from(t).select('*').range(dari, dari + 999);
      if (error) throw new Error(`Backup ${t}: ${error.message}`);
      semua.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    tabel[t] = semua;
  }
  const waktu = new Date();
  const nama = `arl-backup-${waktu.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  const isi = JSON.stringify({ versi: 1, dibuat: waktu.toISOString(), oleh, tabel });
  const { error } = await admin.storage
    .from('backup')
    .upload(nama, Buffer.from(isi), { contentType: 'application/json', upsert: false });
  if (error) throw new Error('Gagal menyimpan backup: ' + error.message);
  return { nama, ukuran: isi.length, jumlah: Object.fromEntries(Object.entries(tabel).map(([k, v]) => [k, v.length])) };
}

export async function daftarBackup() {
  const { data, error } = await klienAdmin().storage.from('backup').list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (error) return [];
  return (data ?? []).filter((f) => f.name.endsWith('.json')).map((f) => ({ nama: f.name, ukuran: Number(f.metadata?.size ?? 0) }));
}
