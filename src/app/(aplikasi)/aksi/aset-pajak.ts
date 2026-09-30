'use server';

/** Aset & inventaris, kewajiban pajak, dan profil perusahaan — hanya pemilik/admin (dijaga RLS). */
import { KATEGORI_ASET, KELOMPOK, KONDISI, STATUS_ASET } from '@/lib/aset';
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
import { bulanIni, geserBulan } from '@/lib/format';
import { JENIS_PAJAK } from '@/lib/konstanta';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

type Masukan = Record<string, unknown>;

async function simpan(tabel: 'aset' | 'pajak', id: string | null, d: Record<string, unknown>): Promise<Hasil> {
  const db = await klienServer();
  const q = id ? db.from(tabel).update(d).eq('id', id).select('id') : db.from(tabel).insert(d).select('id');
  const { data, error } = await q;
  if (error) return { galat: pesanGalat(error) };
  if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengelola data ini.' };
  segarkan();
  return { ok: true, id: data[0].id };
}
async function hapus(tabel: 'aset' | 'pajak', id: string): Promise<Hasil> {
  const db = await klienServer();
  const { data, error } = await db.from(tabel).delete().eq('id', idWajib(id)).select('id');
  if (error) return { galat: pesanGalat(error, 'menghapus') };
  if (!data?.length) return { galat: PESAN_HAPUS };
  segarkan();
  return { ok: true };
}

/* ---------------------------------------------------------------- aset */
export async function simpanAset(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const inv = m.jenis === 'inventaris';
    const harga = rupiah(m.harga_perolehan, 'Harga perolehan', { wajibPositif: true });
    const residu = inv ? 0 : rupiah(m.nilai_residu, 'Nilai residu');
    if (residu > harga) throw new Tolak('Nilai residu tidak boleh melebihi harga perolehan.');
    const kelompok = inv ? '1' : pilihan(m.kelompok, Object.keys(KELOMPOK), 'Kelompok fiskal');
    // Bangunan hanya boleh garis lurus (Pasal 11 UU PPh)
    const metode = inv || kelompok.startsWith('b') ? 'garis_lurus' : pilihan(m.metode, ['garis_lurus', 'saldo_menurun'], 'Metode');
    const qty = inv ? Number(m.qty) || 1 : 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) throw new Tolak('Jumlah unit harus angka bulat ≥ 1.');
    const status = pilihan(m.status, STATUS_ASET, 'Status');
    return simpan('aset', idOpsional(m.id), {
      jenis: inv ? 'inventaris' : 'tetap',
      kode: teks(m.kode, 40) || null,
      nama: wajibTeks(m.nama, 'Nama barang', 120),
      kategori: pilihan(m.kategori, KATEGORI_ASET, 'Kategori'),
      tgl_perolehan: tanggal(m.tgl_perolehan, 'Tanggal perolehan'),
      harga_perolehan: harga,
      nilai_residu: residu,
      kelompok,
      metode,
      qty,
      lokasi: teks(m.lokasi, 120) || null,
      penanggung_jawab: teks(m.penanggung_jawab, 120) || null,
      kondisi: pilihan(m.kondisi, KONDISI, 'Kondisi'),
      status,
      tgl_lepas: status === 'Aktif' ? null : m.tgl_lepas ? tanggal(m.tgl_lepas, 'Tanggal lepas') : null,
      nilai_jual: status === 'Dilepas' && m.nilai_jual ? rupiah(m.nilai_jual, 'Nilai jual') : null,
      catatan: teks(m.catatan, 500) || null,
    });
  });
}
export async function hapusAset(id: string) {
  return jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    return hapus('aset', id);
  });
}

/* ---------------------------------------------------------------- pajak */
export async function simpanPajak(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const periode = teks(m.periode, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode)) throw new Tolak('Masa pajak harus bulan yang valid.');
    const tglSetor = m.tgl_setor ? tanggal(m.tgl_setor, 'Tanggal setor') : null;
    const tglLapor = m.tgl_lapor ? tanggal(m.tgl_lapor, 'Tanggal lapor') : null;
    return simpan('pajak', idOpsional(m.id), {
      periode,
      jenis: pilihan(m.jenis, Object.keys(JENIS_PAJAK), 'Jenis pajak'),
      dpp: rupiah(m.dpp, 'Dasar pengenaan'),
      nominal: rupiah(m.nominal, 'Pajak terutang'),
      tgl_setor: tglSetor,
      tgl_lapor: tglLapor,
      ntpn: teks(m.ntpn, 40) || null,
      catatan: teks(m.catatan, 300) || null,
    });
  });
}
export async function hapusPajak(id: string) {
  return jalankan(async () => {
    wajibBolehHapus(await wajibLogin());
    return hapus('pajak', id);
  });
}

/**
 * "Buat dari data bulan lalu" — generatePajak() di prototipe. Usulan kewajiban
 * dari transaksi bulan lalu; yang sudah tercatat untuk masa & jenis yang sama dilewati.
 */
export async function buatPajakBulanLalu(): Promise<Hasil & { dibuat?: number }> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const p = geserBulan(bulanIni(), -1);
    const [{ data: trx }, { data: ada }, { data: prsh }] = await Promise.all([
      db.from('transaksi').select('tipe, nominal, kategori').gte('tanggal', p + '-01').lt('tanggal', geserBulan(p, 1) + '-01').eq('arsip', false),
      db.from('pajak').select('jenis').eq('periode', p),
      db.from('perusahaan').select('pkp').limit(1).maybeSingle(),
    ]);
    const arr = trx ?? [];
    const jumlah = (f: (t: { tipe: string; kategori: string }) => boolean) => arr.filter(f).reduce((s, t) => s + t.nominal, 0);
    const gaji = jumlah((t) => t.kategori === 'Gaji & fee tim');
    const jasa = jumlah((t) => ['Komisi KOL/affiliate', 'Produksi konten'].includes(t.kategori));
    const omzet = jumlah((t) => t.tipe === 'masuk' && t.kategori !== 'Ads budget titipan');

    const usul: Record<string, unknown>[] = [];
    if (gaji) usul.push({ jenis: 'PPh 21', dpp: gaji, nominal: 0, catatan: 'Hitung per pegawai dengan tarif efektif rata-rata (TER)' });
    if (jasa) usul.push({ jenis: 'PPh 23', dpp: jasa, nominal: Math.round(jasa * 0.02), catatan: '2% dari jasa vendor ber-NPWP' });
    if (prsh?.pkp && omzet)
      usul.push({ jenis: 'PPN Keluaran', dpp: omzet, nominal: Math.round(omzet * 0.11), catatan: '11% dari penyerahan jasa' });
    const baru = usul.filter((u) => !(ada ?? []).some((x) => x.jenis === u.jenis)).map((u) => ({ ...u, periode: p }));
    if (!usul.length) return { galat: 'Tidak ada dasar pajak di bulan lalu.' };
    if (!baru.length) return { ok: true, dibuat: 0 };
    const { data, error } = await db.from('pajak').insert(baru).select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mencatat pajak.' };
    segarkan();
    return { ok: true, dibuat: data.length };
  });
}

/* ---------------------------------------------------------------- perusahaan */
export async function simpanPerusahaan(m: Masukan): Promise<Hasil> {
  return jalankan(async () => {
    await wajibLogin();
    const db = await klienServer();
    const { data, error } = await db
      .from('perusahaan')
      .update({
        nama: wajibTeks(m.nama, 'Nama badan usaha', 120),
        npwp: teks(m.npwp, 30) || null,
        pkp: m.pkp === 'ya',
        modal_disetor: rupiah(m.modal_disetor, 'Modal disetor'),
        batas_kapitalisasi: rupiah(m.batas_kapitalisasi, 'Batas kapitalisasi', { wajibPositif: true }),
        alamat: teks(m.alamat, 300) || null,
      })
      .eq('id', idWajib(m.id))
      .select('id');
    if (error) return { galat: pesanGalat(error) };
    if (!data?.length) return { galat: 'Hanya pemilik atau admin yang boleh mengubah profil perusahaan.' };
    segarkan();
    return { ok: true };
  });
}
