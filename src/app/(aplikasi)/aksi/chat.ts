'use server';

import { idWajib, jalankan, pesanGalat, segarkan } from '@/lib/aksi';
import type { Hasil } from '@/lib/aksi-tipe';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';
import type { Transaksi } from '@/lib/tipe-db';

export type PesanChat =
  | { id: string; peran: 'me'; isi: string; bukti?: boolean }
  | { id: string; peran: 'ai'; isi: string }
  | {
      id: string;
      peran: 'log';
      log: { ok: boolean; teks: string; trxId?: string }[];
      mode: string;
      riwayatId: string | null;
      dibatalkan: boolean;
    };

/** 60 pesan terakhir milik pengguna ini, urut lama → baru. */
export async function ambilChat(): Promise<PesanChat[]> {
  const saya = await wajibLogin();
  const db = await klienServer();
  const { data } = await db
    .from('chat')
    .select('id, peran, isi, data')
    .eq('pengguna_id', saya.id)
    .order('dibuat_pada', { ascending: false })
    .limit(60);
  const baris = (data ?? []).reverse();

  const ids = baris.map((b) => b.data?.riwayatId).filter(Boolean) as string[];
  const batal = new Set<string>();
  if (ids.length) {
    const { data: r } = await db.from('ai_riwayat').select('id, dibatalkan').in('id', ids);
    (r ?? []).forEach((x) => x.dibatalkan && batal.add(x.id));
  }
  return baris.map((b): PesanChat => {
    if (b.peran === 'log')
      return {
        id: b.id,
        peran: 'log',
        log: b.data?.log ?? [],
        mode: b.data?.mode ?? '',
        riwayatId: b.data?.riwayatId ?? null,
        dibatalkan: b.data?.riwayatId ? batal.has(b.data.riwayatId) : false,
      };
    if (b.peran === 'me') return { id: b.id, peran: 'me', isi: b.isi ?? '', bukti: !!b.data?.bukti };
    return { id: b.id, peran: 'ai', isi: b.isi ?? '' };
  });
}

/** Tombol Batalkan: balikkan semua perubahan dari satu perintah chat. */
export async function batalkanAI(riwayatId: string): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibLogin();
    const db = await klienServer();
    const { error } = await db.rpc('batalkan_perubahan', { p_id: idWajib(riwayatId) });
    if (error) return { galat: pesanGalat(error, 'membatalkan') };
    await db.from('chat').insert({ peran: 'ai', isi: 'Perubahan dibatalkan.', pengguna_id: saya.id });
    segarkan();
    return { ok: true };
  });
}

export async function bersihkanChat(): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibLogin();
    const db = await klienServer();
    const { error } = await db.from('chat').delete().eq('pengguna_id', saya.id);
    if (error) return { galat: pesanGalat(error, 'membersihkan') };
    return { ok: true };
  });
}

/** Untuk tombol "Ubah" di kartu chat — ambil transaksinya lewat RLS. */
export async function ambilTransaksi(id: string): Promise<Transaksi | null> {
  await wajibLogin();
  const db = await klienServer();
  const { data } = await db.from('transaksi').select('*').eq('id', idWajib(id)).maybeSingle();
  return (data as Transaksi) ?? null;
}
