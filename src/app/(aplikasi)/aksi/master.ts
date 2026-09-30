'use server';

/** Rekening, vendor, dan utang vendor — dikelola dari tab Kas & Rekening dan Utang & Pajak. */
import { JENIS_REKENING, JENIS_VENDOR } from '@/lib/konstanta';
import {
  type Hasil,
  Tolak,
  idOpsional,
  idWajib,
  jalankan,
  pesanGalat,
  pilihan,
  rupiah,
  segarkan,
  tanggal,
  teks,
  wajibTeks,
  PESAN_HAPUS,
  wajibBolehHapus,
} from '@/lib/aksi';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

type Masukan = Record<string, unknown>;
type Tabel = 'rekening' | 'vendor' | 'utang_vendor';

async function simpan(tabel: Tabel, id: string | null, d: Record<string, unknown>): Promise<Hasil> {
  const db = await klienServer();
  const q = id ? db.from(tabel).update(d).eq('id', id).select('id') : db.from(tabel).insert(d).select('id');
  const { data, error } = await q;
  if (error) return { galat: pesanGalat(error) };
  if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengelola data ini.' };
  segarkan();
  return { ok: true, id: data[0].id };
}

async function hapus(tabel: Tabel, id: string): Promise<Hasil> {
  const db = await klienServer();
  const { data, error } = await db.from(tabel).delete().eq('id', idWajib(id)).select('id');
  if (error) return { galat: pesanGalat(error, 'menghapus') };
  if (!data?.length) return { galat: PESAN_HAPUS };
  segarkan();
  return { ok: true };
}

/* ---------------- rekening ---------------- */
export async function simpanRekening(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    // Nomor rekening: simpan 4 digit terakhir saja (komentar di schema.sql)
    const digit = teks(m.no_rek, 40).replace(/\D/g, '');
    return simpan('rekening', idOpsional(m.id), {
      nama: wajibTeks(m.nama, 'Nama rekening', 100),
      jenis: pilihan(m.jenis, JENIS_REKENING, 'Jenis'),
      bank: teks(m.bank, 60) || null,
      no_rek: digit ? digit.slice(-4) : null,
      saldo_awal: rupiahBertanda(m.saldo_awal),
      catatan: teks(m.catatan, 300) || null,
    });
  });
}
export const hapusRekening = async (id: string) =>
  jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    return hapus('rekening', id);
  });

/** Saldo awal boleh negatif (mis. rekening overdraft), tetap harus bulat. */
function rupiahBertanda(v: unknown) {
  const s = String(v ?? '').trim();
  const neg = s.startsWith('-') || s.startsWith('−');
  const n = rupiah(s.replace(/^[-−]/, ''), 'Saldo awal');
  return neg ? -n : n;
}

/* ---------------- vendor ---------------- */
export async function simpanVendor(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    return simpan('vendor', idOpsional(m.id), {
      nama: wajibTeks(m.nama, 'Nama vendor', 120),
      jenis: pilihan(m.jenis, JENIS_VENDOR, 'Jenis'),
      wa: teks(m.wa, 30).replace(/\D/g, '') || null,
      npwp: m.npwp === true || m.npwp === 'ya',
      catatan: teks(m.catatan, 300) || null,
    });
  });
}
export const hapusVendor = async (id: string) =>
  jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    return hapus('vendor', id);
  });

/* ---------------- utang vendor ---------------- */
export async function simpanUtang(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const d = {
      vendor_id: idWajib(m.vendor_id),
      keterangan: teks(m.keterangan, 200) || 'Tagihan',
      nominal: rupiah(m.nominal, 'Nilai', { wajibPositif: true }),
      dibayar: rupiah(m.dibayar, 'Sudah dibayar'),
      jatuh_tempo: tanggal(m.jatuh_tempo, 'Jatuh tempo'),
      catatan: teks(m.catatan, 300) || null,
    };
    if (d.dibayar > d.nominal) throw new Tolak('Sudah dibayar tidak boleh melebihi nilai tagihan.');
    return simpan('utang_vendor', idOpsional(m.id), d);
  });
}
export const hapusUtang = async (id: string) =>
  jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    return hapus('utang_vendor', id);
  });
