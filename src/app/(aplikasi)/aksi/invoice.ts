'use server';

/** Katalog layanan, penawaran & invoice. Hak akses dijaga RLS (schema-tahap8-invoice.sql). */
import {
  type Hasil,
  PESAN_HAPUS,
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
  wajibBolehHapus,
  wajibTeks,
} from '@/lib/aksi';
import { SATUAN, hitungInvoice, type BarisInv } from '@/lib/invoice';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

type Masukan = Record<string, unknown>;

const bulat = (v: unknown, nama: string, min: number, maks: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > maks) throw new Tolak(`${nama} harus angka bulat ${min}–${maks}.`);
  return n;
};

/* ------------------------------------------------------------ katalog */
export async function simpanKelompok(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idOpsional(m.id);
    const d = { nama: wajibTeks(m.nama, 'Nama kelompok', 80), urutan: bulat(m.urutan ?? 0, 'Urutan', 0, 999) };
    const db = await klienServer();
    const q = id ? db.from('kelompok_layanan').update(d).eq('id', id) : db.from('kelompok_layanan').insert(d);
    const { data, error } = await q.select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengubah katalog.' };
    segarkan();
    return { ok: true, id: data[0].id };
  });
}

export async function simpanLayanan(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idOpsional(m.id);
    const d = {
      kelompok_id: idWajib(m.kelompok_id),
      nama: wajibTeks(m.nama, 'Nama layanan', 120),
      deskripsi: teks(m.deskripsi, 600) || null,
      satuan: pilihan(m.satuan, SATUAN, 'Satuan'),
      harga: rupiah(m.harga, 'Harga'),
      porsi_hemat: bulat(m.porsi_hemat ?? 0, 'Porsi hemat', 0, 999),
      porsi_standar: bulat(m.porsi_standar ?? 1, 'Porsi standar', 0, 999),
      porsi_premium: bulat(m.porsi_premium ?? 1, 'Porsi premium', 0, 999),
      berulang: m.berulang === true || m.berulang === 'true',
      urutan: bulat(m.urutan ?? 0, 'Urutan', 0, 999),
      aktif: m.aktif === undefined ? true : m.aktif === true || m.aktif === 'true',
    };
    const db = await klienServer();
    const q = id ? db.from('layanan').update(d).eq('id', id) : db.from('layanan').insert(d);
    const { data, error } = await q.select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengubah katalog.' };
    segarkan();
    return { ok: true, id: data[0].id };
  });
}

async function hapusDari(tabel: 'kelompok_layanan' | 'layanan' | 'dokumen', id: string): Promise<Hasil> {
  return jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    const db = await klienServer();
    const { data, error } = await db.from(tabel).delete().eq('id', idWajib(id)).select('id');
    if (error) return { galat: pesanGalat(error, 'menghapus') };
    if (!data?.length) return { galat: PESAN_HAPUS };
    segarkan();
    return { ok: true };
  });
}
export const hapusKelompok = async (id: string) => hapusDari('kelompok_layanan', id);
export const hapusLayanan = async (id: string) => hapusDari('layanan', id);

/* ------------------------------------------------------------ dokumen */
function bacaBaris(v: unknown): BarisInv[] {
  if (!Array.isArray(v)) throw new Tolak('Rincian layanan tidak valid.');
  if (v.length > 200) throw new Tolak('Terlalu banyak baris.');
  return v.map((r: Masukan, i) => ({
    layanan_id: idOpsional(r.layanan_id),
    kelompok: teks(r.kelompok, 80) || null,
    nama: wajibTeks(r.nama, `Nama layanan baris ${i + 1}`, 160),
    deskripsi: teks(r.deskripsi, 600) || null,
    satuan: teks(r.satuan, 20) || 'unit',
    qty: bulat(r.qty, `Jumlah baris ${i + 1}`, 0, 9999),
    harga: rupiah(r.harga, `Harga baris ${i + 1}`),
    diskon_persen: bulat(r.diskon_persen ?? 0, `Diskon baris ${i + 1}`, 0, 100),
    berulang: r.berulang === true,
  }));
}

/** Simpan draf (baru atau ubah). Angka dihitung ulang di server, bukan dipercaya dari browser. */
export async function simpanDokumen(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idOpsional(m.id);
    const jenis = pilihan(m.jenis, ['penawaran', 'invoice'] as const, 'Jenis');
    const baris = bacaBaris(m.baris).filter((b) => b.qty > 0);
    const kepala = {
      durasi_bulan: bulat(m.durasi_bulan, 'Durasi', 1, 36),
      diskon: m.diskon_tipe === 'pct' ? bulat(m.diskon ?? 0, 'Diskon %', 0, 100) : rupiah(m.diskon, 'Diskon'),
      diskon_tipe: m.diskon_tipe === 'pct' ? ('pct' as const) : ('rp' as const),
      ppn_aktif: m.ppn_aktif === true,
      pph23: m.pph23 === true,
    };
    const h = hitungInvoice(kepala, baris);
    const d = {
      jenis,
      kode: jenis === 'invoice' ? 'INV' : 'PNW',
      klien_id: idOpsional(m.klien_id),
      tanggal: tanggal(m.tanggal, 'Tanggal'),
      tempo_hari: bulat(m.tempo_hari ?? 7, 'Tempo', 0, 90),
      porsi: teks(m.porsi, 20) || null,
      catatan: teks(m.catatan, 1500) || null,
      ...kepala,
      subtotal: h.subtotal,
      dpp: h.dpp,
      ppn: h.ppn,
      total: h.total,
      pph23_nilai: h.pph23_nilai,
      diterima: h.diterima,
      diubah_pada: new Date().toISOString(),
    };

    const db = await klienServer();
    if (id) {
      const { data: lama } = await db.from('dokumen').select('status').eq('id', id).maybeSingle();
      if (!lama) throw new Tolak('Dokumen tidak ditemukan.');
      if (lama.status !== 'Draf') throw new Tolak('Dokumen yang sudah terbit tidak bisa diubah. Batalkan lalu buat ulang.');
    }
    const q = id ? db.from('dokumen').update(d).eq('id', id) : db.from('dokumen').insert(d);
    const { data, error } = await q.select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Akun ini tidak boleh menyimpan dokumen ini (staf hanya boleh menyusun penawaran).' };
    const dokId = data[0].id as string;

    // Baris = SALINAN harga saat ini. Ganti seluruhnya setiap simpan draf.
    if (id) {
      const { error: e1 } = await db.from('baris_dokumen').delete().eq('dokumen_id', dokId);
      if (e1) return { galat: pesanGalat(e1) };
    }
    if (baris.length) {
      const { error: e2 } = await db
        .from('baris_dokumen')
        .insert(baris.map((b, i) => ({ ...b, dokumen_id: dokId, urutan: i })));
      if (e2) return { galat: pesanGalat(e2) };
    }
    segarkan();
    return { ok: true, id: dokId };
  });
}

export async function terbitkanDokumen(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data, error } = await db.rpc('terbitkan_dokumen', { p_id: idWajib(id) });
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: `Terbit: ${data}` };
  });
}

export async function lunasiInvoice(id: string, m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { error } = await db.rpc('lunasi_invoice', {
      p_id: idWajib(id),
      p_tanggal: tanggal(m.tanggal, 'Tanggal bayar'),
      p_rekening: idOpsional(m.rekening_id),
    });
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true };
  });
}

export async function batalkanDokumen(id: string): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data: d } = await db.from('dokumen').select('status, tagihan_id').eq('id', idWajib(id)).maybeSingle();
    if (!d) throw new Tolak('Dokumen tidak ditemukan.');
    if (d.status === 'Lunas') throw new Tolak('Invoice yang sudah lunas tidak bisa dibatalkan. Koreksi lewat transaksinya.');
    const { data, error } = await db.from('dokumen').update({ status: 'Batal' }).eq('id', id).select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh membatalkan dokumen.' };
    // Tagihannya dinolkan (bukan dihapus) supaya tidak jadi piutang palsu, jejaknya tetap ada.
    if (d.tagihan_id) {
      await db.from('tagihan').update({ nominal: 0, catatan: 'Invoice dibatalkan' }).eq('id', d.tagihan_id);
    }
    segarkan();
    return { ok: true };
  });
}
export const hapusDokumen = async (id: string) => hapusDari('dokumen', id);

/* ------------------------------------------------------------ profil kop */
export async function simpanProfilInvoice(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const id = idWajib(m.id);
    const url = teks(m.folder_invoice_url, 300);
    if (url && !/^https:\/\/drive\.google\.com\//.test(url)) throw new Tolak('Tautan folder harus dari drive.google.com.');
    const d = {
      telp: teks(m.telp, 40) || null,
      email: teks(m.email, 120) || null,
      bank: teks(m.bank, 60) || null,
      no_rekening: teks(m.no_rekening, 40) || null,
      atas_nama: teks(m.atas_nama, 120) || null,
      penanda_tangan: teks(m.penanda_tangan, 120) || null,
      jabatan_ttd: teks(m.jabatan_ttd, 80) || null,
      folder_invoice_url: url || null,
    };
    const db = await klienServer();
    const { data, error } = await db.from('perusahaan').update(d).eq('id', id).select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengubah profil invoice.' };
    segarkan();
    return { ok: true };
  });
}
