'use server';

/** Tahap 5: persetujuan pengeluaran, tutup buku, backup. Hak akses dijaga lagi di database (schema-tahap5.sql). */
import { Tolak, idWajib, jalankan, pesanGalat, segarkan, teks } from '@/lib/aksi';
import type { Hasil } from '@/lib/aksi-tipe';
import { buatBackup } from '@/lib/backup';
import { bulanIni, bulanLabel } from '@/lib/format';
import { wajibLogin, wajibPemilik } from '@/lib/pengguna';
import { klienAdmin } from '@/lib/supabase/admin';
import { klienServer } from '@/lib/supabase/server';

/* ---------------------------------------------------------------- persetujuan */
export async function setujuiPengajuan(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPemilik();
    const db = await klienServer();
    const { error } = await db.rpc('setujui_pengajuan', { p_id: idWajib(id) });
    if (error) return { galat: pesanGalat(error, 'menyetujui') };
    segarkan();
    return { ok: true, pesan: 'Disetujui — sudah tercatat di transaksi' };
  });
}

export async function tolakPengajuan(id: string, alasan: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPemilik();
    const a = teks(alasan, 500);
    if (!a) throw new Tolak('Alasan penolakan wajib diisi.');
    const db = await klienServer();
    const { error } = await db.rpc('tolak_pengajuan', { p_id: idWajib(id), p_alasan: a });
    if (error) return { galat: pesanGalat(error, 'menolak') };
    segarkan();
    return { ok: true, pesan: 'Pengajuan ditolak' };
  });
}

/** Pengaju menarik kembali pengajuannya yang belum diputuskan. */
export async function tarikPengajuan(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data, error } = await db.from('pengajuan').delete().eq('id', idWajib(id)).select('id');
    if (error) return { galat: pesanGalat(error, 'menarik') };
    if (!data?.length) return { galat: 'Hanya pengajuan milikmu yang belum diputuskan yang bisa ditarik.' };
    segarkan();
    return { ok: true, pesan: 'Pengajuan ditarik' };
  });
}

/* ---------------------------------------------------------------- tutup buku */
const cekPeriode = (p: string) => {
  const s = teks(p, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Tolak('Periode tidak valid.');
  return s;
};

export async function tutupPeriode(periode: string, catatan: string): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibLogin();
    const p = cekPeriode(periode);
    if (p > bulanIni()) throw new Tolak('Bulan yang belum berjalan tidak bisa ditutup.');
    const db = await klienServer();
    const { error } = await db.from('tutup_buku').insert({ periode: p, ditutup_oleh: saya.id, catatan: teks(catatan, 300) || null });
    if (error) return { galat: error.code === '23505' ? `${bulanLabel(p)} sudah ditutup.` : pesanGalat(error, 'menutup buku') };
    segarkan();
    return { ok: true, pesan: `${bulanLabel(p)} ditutup — transaksinya terkunci` };
  });
}

export async function bukaPeriode(periode: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPemilik();
    const p = cekPeriode(periode);
    const db = await klienServer();
    const { data, error } = await db.from('tutup_buku').delete().eq('periode', p).select('periode');
    if (error) return { galat: pesanGalat(error, 'membuka') };
    if (!data?.length) return { galat: 'Periode ini tidak sedang ditutup.' };
    segarkan();
    return { ok: true, pesan: `${bulanLabel(p)} dibuka kembali` };
  });
}

/* ---------------------------------------------------------------- backup */
export async function backupSekarang(): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibPemilik();
    const h = await buatBackup(saya.nama);
    segarkan();
    const total = Object.values(h.jumlah).reduce((a, b) => a + b, 0);
    return { ok: true, pesan: `Backup tersimpan: ${h.nama} (${total} baris)` };
  });
}

export async function tautanBackup(nama: string): Promise<{ url?: string; galat?: string }> {
  await wajibPemilik();
  if (!/^arl-backup-[\d-]+\.json$/.test(nama)) return { galat: 'Nama file tidak valid' };
  const { data, error } = await klienAdmin().storage.from('backup').createSignedUrl(nama, 300, { download: true });
  if (error || !data) return { galat: 'Gagal membuat tautan unduhan' };
  return { url: data.signedUrl };
}
