'use server';

/** Gaji rutin: daftar karyawan + catat gaji sekali klik. Hak akses dijaga lagi oleh RLS (pemilik/admin). */
import { Tolak, idWajib, jalankan, pesanGalat, rupiah, segarkan, teks, wajibTeks } from '@/lib/aksi';
import type { Hasil } from '@/lib/aksi-tipe';
import { bulanIni, bulanLabel, hariIni } from '@/lib/format';
import { sudahDigaji, type Karyawan } from '@/lib/gaji';
import { KATEGORI_GAJI } from '@/lib/konstanta';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

async function wajibPengelola() {
  const p = await wajibLogin();
  if (p.peran === 'staf') throw new Tolak('Data gaji hanya untuk pemilik dan admin.');
  return p;
}

export async function simpanKaryawan(_: Hasil, form: FormData): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    const nama = wajibTeks(form.get('nama'), 'Nama', 80);
    const gaji = rupiah(form.get('gaji'), 'Gaji per bulan', { wajibPositif: true });
    const db = await klienServer();
    const { error } = await db.from('karyawan').insert({ nama, posisi: teks(form.get('posisi'), 80) || null, gaji_pokok: gaji });
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: `${nama} ditambahkan — pengingat gajinya muncul tiap tanggal 1` };
  });
}

export async function aktifkanKaryawan(id: string, aktif: boolean): Promise<Hasil> {
  return ubah(id, { aktif });
}

export async function ubahGaji(id: string, gaji: string): Promise<Hasil> {
  return ubah(id, { gaji });
}

async function ubah(id: string, ubah: { aktif?: boolean; gaji?: string }): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    const isi: Record<string, unknown> = {};
    if (typeof ubah.aktif === 'boolean') isi.aktif = ubah.aktif;
    if (ubah.gaji !== undefined) isi.gaji_pokok = rupiah(ubah.gaji, 'Gaji per bulan', { wajibPositif: true });
    const db = await klienServer();
    const { error } = await db.from('karyawan').update(isi).eq('id', idWajib(id));
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: 'Tersimpan' };
  });
}

/** Catat gaji bulan ini untuk satu karyawan: hari ini, dari rekening pertama, kategori gaji. */
export async function catatGaji(id: string): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibPengelola();
    const db = await klienServer();
    const [{ data: k }, { data: rek }, { data: trx }] = await Promise.all([
      db.from('karyawan').select('id, nama, posisi, gaji_pokok, aktif').eq('id', idWajib(id)).maybeSingle(),
      db.from('rekening').select('id').eq('aktif', true).eq('arsip', false).order('urutan').limit(1),
      db.from('transaksi').select('*').eq('kategori', KATEGORI_GAJI).gte('tanggal', bulanIni() + '-01'),
    ]);
    if (!k) return { galat: 'Karyawan tidak ditemukan.' };
    if (sudahDigaji(k as Karyawan, trx ?? [])) return { galat: `Gaji ${k.nama} bulan ini sudah tercatat.` };
    const { error } = await db.from('transaksi').insert({
      tanggal: hariIni(),
      tipe: 'keluar',
      nominal: k.gaji_pokok,
      kategori: KATEGORI_GAJI,
      keterangan: `Gaji ${k.nama} ${bulanLabel(bulanIni())}`,
      metode: 'Transfer bank',
      rekening_id: rek?.[0]?.id ?? null,
      sumber: 'manual',
      dibuat_oleh: saya.id,
    });
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: `Gaji ${k.nama} tercatat` };
  });
}
