// =====================================================================
// Pulihkan data dari file backup JSON (hasil Kontrol → Backup).
//
//   npm run pulihkan -- arl-backup-2026-10-05-18-00.json          → pulihkan
//   npm run pulihkan -- arl-backup-2026-10-05-18-00.json --coba   → hanya hitung
//
// Dipakai ke database yang sudah dijalankan semua file SQL (lihat README),
// idealnya masih kosong. Baris yang id-nya sudah ada TIDAK ditimpa.
// Akun login (Supabase Auth) tidak ikut backup: buat ulang akun lewat /mulai
// dan halaman Tim dulu. Rujukan ke pengguna yang tidak ada dikosongkan.
// Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local.
// =====================================================================
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const COBA = process.argv.includes('--coba');
const FILE = process.argv.find((a) => a.endsWith('.json'));
if (!FILE || !existsSync(FILE)) {
  console.error('✕ Sebutkan file backup: npm run pulihkan -- arl-backup-....json');
  process.exit(1);
}
for (const baris of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cadangan = JSON.parse(readFileSync(FILE, 'utf8'));
if (cadangan.versi !== 1 || !cadangan.tabel) throw new Error('Bukan file backup ARL yang dikenal');

// Urutan: induk dulu. pengguna tidak dipulihkan (terikat akun Auth); tutup_buku paling akhir
// supaya kunci periode tidak menolak transaksi yang sedang dipulihkan.
const URUTAN = ['perusahaan', 'rekening', 'klien', 'vendor', 'tagihan', 'utang_vendor', 'transaksi', 'aset', 'mutasi_aset',
  'pajak', 'karyawan', 'payroll', 'pengajuan', 'ai_riwayat', 'audit_log', 'tutup_buku'];
const KOLOM_PENGGUNA = ['dibuat_oleh', 'pengguna_id', 'ditutup_oleh', 'diajukan_oleh', 'diputus_oleh'];
const KUNCI = { tutup_buku: 'periode' };

const { data: pengguna } = await db.from('pengguna').select('id');
const adaPengguna = new Set((pengguna ?? []).map((p) => p.id));
console.log(`${COBA ? '[MODE COBA] ' : ''}Memulihkan ${FILE} (dibuat ${cadangan.dibuat})\n`);

const laporan = [];
for (const t of URUTAN) {
  let baris = cadangan.tabel[t] ?? [];
  if (!baris.length) continue;
  baris = baris.map((r) => {
    const x = { ...r };
    for (const k of KOLOM_PENGGUNA) if (k in x && x[k] && !adaPengguna.has(x[k])) x[k] = null;
    return x;
  });
  if (t === 'pengajuan') baris = baris.filter((r) => r.diajukan_oleh); // wajib ada pengaju
  if (t === 'ai_riwayat') baris = baris.filter((r) => r.pengguna_id);
  if (t === 'perusahaan') {
    // Perbarui baris perusahaan yang sudah ada, jangan buat baru
    const { data: lama } = await db.from('perusahaan').select('id').limit(1);
    if (lama?.[0] && !COBA) {
      const isi = { ...baris[0] };
      delete isi.id;
      delete isi.dibuat_pada;
      const { error } = await db.from('perusahaan').update(isi).eq('id', lama[0].id);
      if (error) throw new Error('perusahaan: ' + error.message);
    }
    laporan.push({ tabel: t, 'di backup': 1, dipulihkan: lama?.[0] ? 'diperbarui' : 0 });
    continue;
  }
  const kunci = KUNCI[t] ?? 'id';
  const ada = new Set();
  for (let i = 0; i < baris.length; i += 500) {
    const { data, error } = await db.from(t).select(kunci).in(kunci, baris.slice(i, i + 500).map((r) => r[kunci]));
    if (error) throw new Error(`${t}: ${error.message}`);
    (data ?? []).forEach((r) => ada.add(r[kunci]));
  }
  const baru = baris.filter((r) => !ada.has(r[kunci]));
  if (!COBA) {
    for (let i = 0; i < baru.length; i += 500) {
      const { error } = await db.from(t).insert(baru.slice(i, i + 500));
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
  laporan.push({ tabel: t, 'di backup': baris.length, dipulihkan: baru.length });
}
console.table(laporan);
console.log(COBA ? '\nTidak ada yang ditulis (mode coba).' : '\nSelesai. Periksa saldo & laporan di aplikasi.');
