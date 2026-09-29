'use server';

import {
  type Hasil,
  Tolak,
  idOpsional,
  idWajib,
  jalankan,
  pesanGalat,
  rupiah,
  segarkan,
  tanggal,
  teks,
  wajibTeks,
} from '@/lib/aksi';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

type Masukan = Record<string, unknown>;

const angka = (v: unknown, min: number, maks: number, bawaan: number, nama: string) => {
  const n = v === '' || v == null ? bawaan : Number(v);
  if (!Number.isInteger(n) || n < min || n > maks) throw new Tolak(`${nama} harus angka ${min}–${maks}.`);
  return n;
};

/* ---------------- klien ---------------- */
export async function simpanKlien(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idOpsional(m.id);
    const d = {
      nama: wajibTeks(m.nama, 'Nama klien', 120),
      pic: teks(m.pic, 120) || null,
      wa: teks(m.wa, 30).replace(/\D/g, '') || null,
      paket: teks(m.paket, 200) || null,
      nilai_bulanan: rupiah(m.nilai_bulanan, 'Nilai per bulan'),
      tanggal_tagih: angka(m.tanggal_tagih, 1, 28, 1, 'Tanggal tagih'),
      tempo_hari: angka(m.tempo_hari, 0, 90, 7, 'Tempo'),
      catatan: teks(m.catatan, 1000) || null,
    };
    const db = await klienServer();
    const q = id ? db.from('klien').update(d).eq('id', id).select('id') : db.from('klien').insert(d).select('id');
    const { data, error } = await q;
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengelola data klien.' };
    segarkan();
    return { ok: true, id: data[0].id };
  });
}

export async function hapusKlien(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    // Tagihannya ikut terhapus (on delete cascade); transaksi tetap ada, klien_id jadi kosong.
    const { data, error } = await db.from('klien').delete().eq('id', idWajib(id)).select('id');
    if (error) return { galat: pesanGalat(error, 'menghapus') };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh menghapus klien.' };
    segarkan();
    return { ok: true };
  });
}

/* ---------------- tagihan ---------------- */
export async function simpanTagihan(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idOpsional(m.id);
    const d = {
      klien_id: idWajib(m.klien_id),
      periode: wajibTeks(m.periode, 'Periode', 60),
      nominal: rupiah(m.nominal, 'Nilai tagihan', { wajibPositif: true }),
      dibayar: rupiah(m.dibayar, 'Sudah dibayar'),
      pph23_dipotong: rupiah(m.pph23_dipotong, 'PPh 23 dipotong'),
      tgl_invoice: tanggal(m.tgl_invoice, 'Tanggal invoice'),
      jatuh_tempo: tanggal(m.jatuh_tempo, 'Jatuh tempo'),
      catatan: teks(m.catatan, 500) || null,
    };
    if (d.dibayar + d.pph23_dipotong > d.nominal) {
      throw new Tolak('Sudah dibayar ditambah PPh 23 dipotong tidak boleh melebihi nilai tagihan.');
    }
    if (d.jatuh_tempo < d.tgl_invoice) throw new Tolak('Jatuh tempo tidak boleh sebelum tanggal invoice.');

    const db = await klienServer();
    const q = id ? db.from('tagihan').update(d).eq('id', id).select('id') : db.from('tagihan').insert(d).select('id');
    const { data, error } = await q;
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengelola tagihan.' };
    segarkan();
    return { ok: true, id: data[0].id };
  });
}

export async function hapusTagihan(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data, error } = await db.from('tagihan').delete().eq('id', idWajib(id)).select('id');
    if (error) return { galat: pesanGalat(error, 'menghapus') };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh menghapus tagihan.' };
    segarkan();
    return { ok: true };
  });
}
