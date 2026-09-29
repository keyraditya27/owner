import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { klienServer } from '@/lib/supabase/server';
import { klienAdmin } from '@/lib/supabase/admin';
import type { DataKeuangan } from '@/lib/hitung';
import { bacaPeriode, COOKIE_PERIODE } from '@/lib/periode';

/**
 * Ambil seluruh data operasional untuk satu permintaan halaman.
 * Pakai sesi pengguna (anon key) → aturan RLS tetap berlaku.
 * Baris yang diarsipkan sinkron sheet (arsip = true) tidak ikut.
 * Data ARL masih ratusan baris, jadi diambil utuh lalu dihitung di server —
 * sama dengan cara prototipe menghitung dari state.
 */
export const ambilData = cache(async (): Promise<DataKeuangan> => {
  const db = await klienServer();
  const [transaksi, klien, tagihan, rekening, vendor, utang, pajak, perusahaan] = await Promise.all([
    db.from('transaksi').select('*').eq('arsip', false).order('tanggal', { ascending: false }),
    db.from('klien').select('*').eq('arsip', false).order('nama'),
    db.from('tagihan').select('*').eq('arsip', false),
    db.from('rekening').select('*').eq('arsip', false).order('urutan'),
    db.from('vendor').select('*').eq('arsip', false).order('nama'),
    db.from('utang_vendor').select('*').eq('arsip', false),
    db.from('pajak').select('*').eq('arsip', false).order('periode', { ascending: false }),
    db.from('perusahaan').select('nama').limit(1).maybeSingle(),
  ]);
  const galat = [transaksi, klien, tagihan, rekening, vendor, utang, pajak].find((r) => r.error)?.error;
  if (galat) throw new Error('Gagal membaca database: ' + galat.message);

  return {
    transaksi: transaksi.data ?? [],
    klien: klien.data ?? [],
    tagihan: tagihan.data ?? [],
    rekening: rekening.data ?? [],
    vendor: vendor.data ?? [],
    utang: utang.data ?? [],
    pajak: pajak.data ?? [],
    namaPerusahaan: perusahaan.data?.nama ?? 'PT Arah Ruang Langit',
  };
});

export async function ambilPeriode() {
  const c = await cookies();
  return bacaPeriode(c.get(COOKIE_PERIODE)?.value);
}

/**
 * Signed URL untuk file bukti di bucket privat `bukti`. Berlaku 1 jam.
 * Hanya dipanggil untuk baris yang sudah lolos RLS (pengguna memang boleh melihatnya).
 */
export async function urlBukti(paths: string[]): Promise<Record<string, string>> {
  const unik = [...new Set(paths.filter(Boolean))];
  if (!unik.length) return {};
  const { data, error } = await klienAdmin().storage.from('bukti').createSignedUrls(unik, 3600);
  if (error || !data) return {};
  const hasil: Record<string, string> = {};
  data.forEach((d) => {
    if (d.path && d.signedUrl) hasil[d.path] = d.signedUrl;
  });
  return hasil;
}
