'use server';

import { BUKTI_MAKS_BYTE, BUKTI_TIPE, kategoriUntuk, METODE } from '@/lib/konstanta';
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
} from '@/lib/aksi';
import { wajibLogin } from '@/lib/pengguna';
import { klienAdmin } from '@/lib/supabase/admin';
import { klienServer } from '@/lib/supabase/server';

/** Simpan transaksi baru atau ubah yang ada. Bukti (opsional) diunggah ke bucket privat. */
export async function simpanTransaksi(form: FormData): Promise<Hasil> {
  return jalankan(async () => {
    const saya = await wajibLogin();
    const id = idOpsional(form.get('id'));
    const tipe = pilihan(form.get('tipe'), ['masuk', 'keluar'] as const, 'Tipe');
    const d = {
      tipe,
      tanggal: tanggal(form.get('tanggal'), 'Tanggal'),
      keterangan: teks(form.get('keterangan'), 300) || 'Transaksi',
      nominal: rupiah(form.get('nominal'), 'Nominal', { wajibPositif: true }),
      metode: pilihan(form.get('metode'), METODE, 'Metode'),
      kategori: pilihan(form.get('kategori'), kategoriUntuk(tipe), 'Kategori'),
      rekening_id: idOpsional(form.get('rekening_id')),
      klien_id: idOpsional(form.get('klien_id')),
    };

    const file = form.get('bukti');
    const bukti = file instanceof File && file.size > 0 ? file : null;
    if (bukti) {
      if (!BUKTI_TIPE.includes(bukti.type)) throw new Tolak('Bukti harus gambar (JPG/PNG/WEBP/HEIC) atau PDF.');
      if (bukti.size > BUKTI_MAKS_BYTE) throw new Tolak('Ukuran bukti maksimal 8 MB.');
    }

    const db = await klienServer();
    let trxId = id;
    if (id) {
      const { data, error } = await db.from('transaksi').update(d).eq('id', id).select('id');
      if (error) return { galat: pesanGalat(error) };
      if (!data?.length) return { galat: 'Transaksi tidak ditemukan, atau akun ini hanya boleh mengubah transaksi buatannya sendiri.' };
    } else {
      const { data, error } = await db
        .from('transaksi')
        .insert({ ...d, sumber: 'manual', dibuat_oleh: saya.id })
        .select('id')
        .single();
      if (error || !data) return { galat: pesanGalat(error) };
      trxId = data.id;
    }

    if (bukti && trxId) {
      const galat = await unggahBukti(trxId, bukti);
      if (galat) return { galat: 'Transaksi tersimpan, tapi bukti gagal diunggah: ' + galat, ok: true, id: trxId };
    }
    segarkan();
    return { ok: true, id: trxId ?? undefined };
  });
}

/**
 * Unggah ke bucket `bukti` lalu simpan path-nya di transaksi.
 * Yang disimpan path, bukan URL — URL dibuat ulang (signed, 1 jam) setiap kali ditampilkan.
 */
async function unggahBukti(trxId: string, file: File): Promise<string | null> {
  const aman = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'bukti';
  const path = `transaksi/${trxId}/${Date.now()}-${aman}`;
  const admin = klienAdmin();
  const { error } = await admin.storage
    .from('bukti')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return error.message;

  // Perbarui lewat sesi pengguna supaya RLS & audit_log mencatat siapa yang melampirkan.
  const db = await klienServer();
  const { data, error: e2 } = await db
    .from('transaksi')
    .update({ bukti_url: path, bukti_nama: file.name.slice(0, 200) })
    .eq('id', trxId)
    .select('id');
  if (e2 || !data?.length) {
    await admin.storage.from('bukti').remove([path]);
    return e2 ? pesanGalat(e2) : 'tidak punya izin mengubah transaksi ini';
  }
  return null;
}

export async function hapusTransaksi(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data, error } = await db.from('transaksi').delete().eq('id', idWajib(id)).select('id');
    if (error) return { galat: pesanGalat(error, 'menghapus') };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh menghapus transaksi.' };
    // File bukti sengaja tidak dihapus: tetap tersimpan sebagai jejak audit.
    segarkan();
    return { ok: true };
  });
}

/** Signed URL untuk melihat satu bukti. Dicek dulu lewat RLS bahwa pengguna boleh melihat transaksinya. */
export async function lihatBukti(id: string): Promise<{ url?: string; galat?: string }> {
  await wajibLogin();
  const db = await klienServer();
  const { data } = await db.from('transaksi').select('bukti_url').eq('id', idWajib(id)).maybeSingle();
  if (!data?.bukti_url) return { galat: 'Bukti tidak ditemukan.' };
  const { data: s, error } = await klienAdmin().storage.from('bukti').createSignedUrl(data.bukti_url, 600);
  if (error || !s) return { galat: 'Gagal membuka bukti.' };
  return { url: s.signedUrl };
}
