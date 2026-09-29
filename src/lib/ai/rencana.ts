import 'server-only';

/**
 * Validasi keluaran model lalu terjemahkan jadi daftar operasi database.
 * Padanan EKSEKUTOR di prototipe v7, dengan satu beda penting:
 * JANGAN PERCAYA KELUARAN MODEL. Setiap nilai diperiksa di sini; aksi yang
 * tidak lolos ditolak dengan alasan yang jelas, aksi lain tetap jalan.
 * Operasi yang lolos dijalankan sekaligus oleh terapkan_perubahan() di Postgres.
 */
import { randomUUID } from 'node:crypto';
import { bulanIni, bulanLabel, geserBulan, rp, tambahHari, tanggalValid } from '@/lib/format';
import { JENIS_PAJAK, JENIS_REKENING, kategoriUntuk, METODE } from '@/lib/konstanta';
import { sisaTagihan, type DataKeuangan } from '@/lib/hitung';
import type { Aset, Klien, Peran, Rekening, Tagihan, Transaksi, UtangVendor, Vendor } from '@/lib/tipe-db';
import { cariSatu, skorCocok, type HasilCari } from './cocok';

export type Operasi = { op: 'insert' | 'update' | 'delete'; tabel: string; id: string; data?: Record<string, unknown> };
export type BarisLog = { ok: boolean; teks: string; trxId?: string };

export type Konteks = {
  data: DataKeuangan;
  aset: Aset[];
  batasKapitalisasi: number;
  periodeTutup: Set<string>;
  pengguna: { id: string; peran: Peran };
  hariIni: string;
};

const KATEGORI_ASET = [
  'Komputer & laptop',
  'Kamera & peralatan produksi',
  'Peralatan kantor',
  'Furnitur',
  'Kendaraan',
  'Bangunan',
  'Perangkat lunak & lisensi',
  'Lain-lain',
];
const KELOMPOK = ['1', '2', '3', '4', 'bp', 'bnp'];
const KONDISI = ['Baik', 'Perlu perbaikan', 'Rusak'];
const STATUS_ASET = ['Aktif', 'Dilepas', 'Hilang'];
const AKSI_STAF = new Set(['transaksi_baru', 'transaksi_ubah']);

class Tolak extends Error {}

type A = Record<string, unknown>;

/* ---------------------------------------------------------------- validator */
const str = (v: unknown, maks = 200) => (typeof v === 'string' ? v.trim().slice(0, maks) : v == null ? '' : String(v).trim().slice(0, maks));

/** Nominal harus integer positif. "750000" boleh, "750rb" / 750000.5 / -1 ditolak. */
function intPositif(v: unknown, nama = 'Nominal') {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw new Tolak(`${nama} "${String(v)}" bukan angka bulat positif`);
  return n;
}
function intNonNeg(v: unknown, nama: string) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isSafeInteger(n) || n < 0) throw new Tolak(`${nama} "${String(v)}" bukan angka bulat`);
  return n;
}
const ada = (v: unknown) => v !== undefined && v !== null && v !== '';

/** Tanggal: kosong → hari ini; ada tapi bukan YYYY-MM-DD valid → tolak. */
function tanggal(v: unknown, bawaan: string, nama = 'Tanggal') {
  if (!ada(v)) return bawaan;
  const s = str(v, 20);
  if (!tanggalValid(s)) throw new Tolak(`${nama} "${s}" bukan format YYYY-MM-DD`);
  return s;
}

function wajibCocok<T>(h: HasilCari<T>, jenis: string, kueri: unknown, nama: (x: T) => string | null): T {
  if (h.ok) return h.data;
  if (h.alasan === 'ambigu')
    throw new Tolak(`"${str(kueri)}" cocok dengan beberapa ${jenis}: ${h.kandidat.map(nama).join(', ')}. Sebutkan lebih lengkap.`);
  throw new Tolak(`${jenis[0].toUpperCase() + jenis.slice(1)} "${str(kueri)}" tidak ada di data`);
}

/* ---------------------------------------------------------------- perencana */
export function rencanakan(aksiMentah: unknown, k: Konteks) {
  const ops: Operasi[] = [];
  const log: BarisLog[] = [];
  // Salinan kerja: aksi berikutnya dalam pesan yang sama melihat hasil aksi sebelumnya.
  const d = {
    transaksi: [...k.data.transaksi],
    klien: [...k.data.klien],
    tagihan: k.data.tagihan.map((x) => ({ ...x })),
    vendor: [...k.data.vendor],
    utang: k.data.utang.map((x) => ({ ...x })),
    rekening: [...k.data.rekening],
    pajak: k.data.pajak.map((x) => ({ ...x })),
    aset: k.aset.map((x) => ({ ...x })),
  };
  const bolehKelola = k.pengguna.peran === 'pemilik' || k.pengguna.peran === 'admin';

  const cekTutup = (tgl: string) => {
    if (k.periodeTutup.has(tgl.slice(0, 7))) throw new Tolak(`Periode ${bulanLabel(tgl.slice(0, 7))} sudah tutup buku`);
  };
  const cariKlien = (q: unknown) => wajibCocok(cariSatu(d.klien, str(q), (x) => x.nama), 'klien', q, (x: Klien) => x.nama);
  const cariVendor = (q: unknown) => cariSatu(d.vendor, str(q), (x) => x.nama);
  const cariRekening = (q: unknown): Rekening | null =>
    ada(q) ? wajibCocok(cariSatu(d.rekening, str(q), (x) => x.nama), 'rekening', q, (x: Rekening) => x.nama) : d.rekening[0] ?? null;
  const kategori = (tipe: 'masuk' | 'keluar', v: unknown) => {
    const s = str(v, 60);
    const daftar = kategoriUntuk(tipe);
    const cocok = daftar.find((x) => x.toLowerCase() === s.toLowerCase());
    if (!cocok) throw new Tolak(`Kategori "${s}" tidak ada untuk uang ${tipe}`);
    return cocok;
  };

  const trxBaru = (t: Omit<Transaksi, 'id' | 'vendor_id' | 'ppn' | 'pph_dipotong' | 'bukti_url' | 'bukti_nama' | 'dibuat_pada' | 'diubah_pada' | 'sheet_diubah' | 'sheet_sumber' | 'arsip'>) => {
    cekTutup(t.tanggal);
    const id = randomUUID();
    const data = { ...t };
    ops.push({ op: 'insert', tabel: 'transaksi', id, data });
    d.transaksi.unshift({ ...(data as unknown as Transaksi), id });
    return id;
  };

  const EKSEKUTOR: Record<string, (a: A) => BarisLog> = {
    transaksi_baru(a) {
      const tipe = a.tipe === 'masuk' ? 'masuk' : a.tipe === 'keluar' ? 'keluar' : null;
      if (!tipe) throw new Tolak(`Tipe "${str(a.tipe)}" harus masuk atau keluar`);
      const nominal = intPositif(a.nominal);
      const kl = ada(a.klien) ? cariKlien(a.klien) : null;
      const r = cariRekening(a.rekening);
      const metode = METODE.find((m) => m.toLowerCase() === str(a.metode).toLowerCase()) ?? 'Transfer bank';
      const ket = str(a.keterangan, 120) || 'Transaksi';
      const id = trxBaru({
        tipe,
        nominal,
        kategori: kategori(tipe, a.kategori),
        klien_id: kl?.id ?? null,
        rekening_id: r?.id ?? null,
        tagihan_id: null,
        tanggal: tanggal(a.tanggal, k.hariIni),
        keterangan: ket,
        metode,
        sumber: 'ai',
        dibuat_oleh: k.pengguna.id,
      });
      return { ok: true, trxId: id, teks: `${tipe === 'masuk' ? 'Uang masuk' : 'Uang keluar'} ${rp(nominal)} — ${ket}` };
    },

    transaksi_ubah(a) {
      const t = cariTransaksi(a.cari);
      if (!bolehKelola && t.dibuat_oleh !== k.pengguna.id) throw new Tolak(`"${t.keterangan}" bukan transaksi buatanmu — hanya pemilik/admin yang boleh mengubahnya`);
      cekTutup(t.tanggal);
      const ubah: Record<string, unknown> = {};
      if (ada(a.nominal)) ubah.nominal = intPositif(a.nominal);
      if (ada(a.tanggal)) ubah.tanggal = tanggal(a.tanggal, t.tanggal);
      if (ada(a.kategori)) ubah.kategori = kategori(t.tipe, a.kategori);
      if (ada(a.keterangan)) ubah.keterangan = str(a.keterangan, 120);
      if (ada(a.klien)) ubah.klien_id = cariKlien(a.klien).id;
      if (ada(a.rekening)) ubah.rekening_id = cariRekening(a.rekening)?.id ?? null;
      if (!Object.keys(ubah).length) throw new Tolak('Tidak ada yang diubah');
      if (ubah.tanggal) cekTutup(ubah.tanggal as string);
      ops.push({ op: 'update', tabel: 'transaksi', id: t.id, data: ubah });
      Object.assign(t, ubah);
      return {
        ok: true,
        trxId: t.id,
        teks: `Diubah: ${t.keterangan}${ubah.nominal ? ` — jadi ${rp(ubah.nominal as number)}` : ''}`,
      };
    },

    transaksi_hapus(a) {
      const t = cariTransaksi(a.cari);
      cekTutup(t.tanggal);
      ops.push({ op: 'delete', tabel: 'transaksi', id: t.id });
      d.transaksi = d.transaksi.filter((x) => x.id !== t.id);
      return { ok: true, teks: `Dihapus: ${t.keterangan} ${rp(t.nominal)}` };
    },

    tagihan_lunas(a) {
      const kl = cariKlien(a.klien);
      let inv = d.tagihan.filter((i) => i.klien_id === kl.id && sisaTagihan(i) > 0);
      if (ada(a.periode)) {
        const p = inv.filter((i) => skorCocok(str(a.periode), i.periode) >= 40);
        if (!p.length) throw new Tolak(`${kl.nama} tidak punya tagihan terbuka untuk "${str(a.periode)}"`);
        inv = p;
      }
      if (!inv.length) throw new Tolak(`${kl.nama} tidak punya tagihan terbuka`);
      inv.sort((x, y) => (x.jatuh_tempo || '').localeCompare(y.jatuh_tempo || ''));
      const totalSisa = inv.reduce((s, i) => s + sisaTagihan(i), 0);
      const bayar = ada(a.nominal) ? intPositif(a.nominal) : totalSisa;
      if (bayar > totalSisa)
        throw new Tolak(`${rp(bayar)} melebihi sisa tagihan ${kl.nama} (${rp(totalSisa)}). Catat kelebihannya sebagai transaksi terpisah.`);
      const tgl = tanggal(a.tanggal, k.hariIni);

      let sisaBayar = bayar;
      const kena: string[] = [];
      for (const i of inv) {
        if (sisaBayar <= 0) break;
        const b = Math.min(sisaTagihan(i), sisaBayar);
        i.dibayar += b;
        sisaBayar -= b;
        ops.push({ op: 'update', tabel: 'tagihan', id: i.id, data: { dibayar: i.dibayar } });
        kena.push(`${i.periode} ${rp(b)}${sisaTagihan(i) > 0 ? ' (sisa ' + rp(sisaTagihan(i)) + ')' : ' — lunas'}`);
      }
      let trxId: string | undefined;
      if (a.catatTransaksi !== false) {
        trxId = trxBaru({
          tipe: 'masuk',
          nominal: bayar,
          kategori: 'Retainer klien',
          klien_id: kl.id,
          rekening_id: cariRekening(a.rekening)?.id ?? null,
          tagihan_id: inv[0].id,
          tanggal: tgl,
          keterangan: `Pembayaran ${kl.nama}${ada(a.periode) ? ' ' + str(a.periode) : ''}`,
          metode: 'Transfer bank',
          sumber: 'ai',
          dibuat_oleh: k.pengguna.id,
        });
      }
      return { ok: true, trxId, teks: `${kl.nama} dibayar ${rp(bayar)} → ${kena.join(', ')}` };
    },

    tagihan_baru(a) {
      const kl = cariKlien(a.klien);
      const nominal = ada(a.nominal) ? intPositif(a.nominal) : kl.nilai_bulanan;
      if (!nominal) throw new Tolak(`Nilai tagihan ${kl.nama} belum disebut dan nilai bulanannya kosong`);
      const tt = tanggal(a.jatuhTempo, tambahHari(k.hariIni, kl.tempo_hari ?? 7), 'Jatuh tempo');
      const id = randomUUID();
      const data = {
        klien_id: kl.id,
        periode: str(a.periode, 60) || bulanLabel(bulanIni()),
        nominal,
        dibayar: 0,
        tgl_invoice: k.hariIni < tt ? k.hariIni : tt,
        jatuh_tempo: tt,
      };
      ops.push({ op: 'insert', tabel: 'tagihan', id, data });
      d.tagihan.push({ ...(data as unknown as Tagihan), id, pph23_dipotong: 0 });
      return { ok: true, teks: `Tagihan baru ${kl.nama} ${data.periode} ${rp(nominal)}` };
    },

    klien_baru(a) {
      const nama = str(a.nama, 120);
      if (!nama) throw new Tolak('Nama klien kosong');
      if (d.klien.some((x) => skorCocok(nama, x.nama) >= 80)) throw new Tolak(`Klien "${nama}" sudah ada`);
      const id = randomUUID();
      const data = {
        nama,
        pic: str(a.pic, 120) || null,
        wa: str(a.wa, 30).replace(/\D/g, '') || null,
        paket: str(a.paket, 200) || null,
        nilai_bulanan: intNonNeg(a.nilai, 'Nilai bulanan'),
        tanggal_tagih: Math.min(28, Math.max(1, intNonNeg(a.tanggalTagih, 'Tanggal tagih') || 1)),
        tempo_hari: Math.min(90, ada(a.tempoHari) ? intNonNeg(a.tempoHari, 'Tempo') : 7),
      };
      ops.push({ op: 'insert', tabel: 'klien', id, data });
      d.klien.push({ ...(data as unknown as Klien), id });
      return { ok: true, teks: `Klien baru: ${nama}` };
    },

    klien_ubah(a) {
      const kl = cariKlien(a.nama);
      const ubah: Record<string, unknown> = {};
      if (ada(a.pic)) ubah.pic = str(a.pic, 120);
      if (ada(a.paket)) ubah.paket = str(a.paket, 200);
      if (ada(a.wa)) ubah.wa = str(a.wa, 30).replace(/\D/g, '');
      if (ada(a.nilai)) ubah.nilai_bulanan = intNonNeg(a.nilai, 'Nilai bulanan');
      if (!Object.keys(ubah).length) throw new Tolak('Tidak ada yang diubah');
      ops.push({ op: 'update', tabel: 'klien', id: kl.id, data: ubah });
      Object.assign(kl, ubah);
      return { ok: true, teks: `Data ${kl.nama} diperbarui` };
    },

    vendor_baru(a) {
      const nama = str(a.nama, 120);
      if (!nama) throw new Tolak('Nama vendor kosong');
      if (d.vendor.some((x) => skorCocok(nama, x.nama) >= 80)) throw new Tolak(`Vendor "${nama}" sudah ada`);
      return { ok: true, teks: `Vendor baru: ${buatVendor(nama, a).nama}` };
    },

    utang_baru(a) {
      const nominal = intPositif(a.nominal);
      const h = cariVendor(a.vendor);
      if (!h.ok && h.alasan === 'ambigu') wajibCocok(h, 'vendor', a.vendor, (x: Vendor) => x.nama);
      const v = h.ok ? h.data : buatVendor(str(a.vendor, 120), {});
      const id = randomUUID();
      const data = {
        vendor_id: v.id,
        keterangan: str(a.keterangan, 200) || 'Tagihan',
        nominal,
        dibayar: 0,
        jatuh_tempo: tanggal(a.jatuhTempo, k.hariIni, 'Jatuh tempo'),
      };
      ops.push({ op: 'insert', tabel: 'utang_vendor', id, data });
      d.utang.push({ ...(data as unknown as UtangVendor), id });
      return { ok: true, teks: `Utang ke ${v.nama} ${rp(nominal)} dicatat${h.ok ? '' : ' (vendor baru)'}` };
    },

    utang_bayar(a) {
      const v = wajibCocok(cariVendor(a.vendor), 'vendor', a.vendor, (x: Vendor) => x.nama);
      const buka = d.utang
        .filter((u) => u.vendor_id === v.id && u.nominal - u.dibayar > 0)
        .sort((x, y) => (x.jatuh_tempo || '').localeCompare(y.jatuh_tempo || ''));
      if (!buka.length) throw new Tolak(`${v.nama} tidak punya utang terbuka`);
      const totalSisa = buka.reduce((s, u) => s + u.nominal - u.dibayar, 0);
      const bayar = ada(a.nominal) ? intPositif(a.nominal) : totalSisa;
      if (bayar > totalSisa) throw new Tolak(`${rp(bayar)} melebihi sisa utang ke ${v.nama} (${rp(totalSisa)})`);
      let sisaBayar = bayar;
      for (const u of buka) {
        if (sisaBayar <= 0) break;
        const b = Math.min(u.nominal - u.dibayar, sisaBayar);
        u.dibayar += b;
        sisaBayar -= b;
        ops.push({ op: 'update', tabel: 'utang_vendor', id: u.id, data: { dibayar: u.dibayar } });
      }
      let trxId: string | undefined;
      if (a.catatTransaksi !== false) {
        trxId = trxBaru({
          tipe: 'keluar',
          nominal: bayar,
          kategori: v.jenis === 'KOL / affiliate' ? 'Komisi KOL/affiliate' : 'Operasional kantor',
          klien_id: null,
          rekening_id: d.rekening[0]?.id ?? null,
          tagihan_id: null,
          tanggal: k.hariIni,
          keterangan: `Bayar ${v.nama}`,
          metode: 'Transfer bank',
          sumber: 'ai',
          dibuat_oleh: k.pengguna.id,
        });
      }
      return { ok: true, trxId, teks: `Bayar ${v.nama} ${rp(bayar)}` };
    },

    aset_baru(a) {
      const nama = str(a.nama, 120);
      if (!nama) throw new Tolak('Nama aset kosong');
      const harga = intPositif(a.hargaPerolehan, 'Harga perolehan');
      // Di bawah batas kapitalisasi → inventaris (dibebankan langsung, tetap tercatat)
      const inv = a.jenisAset === 'inventaris' || harga < k.batasKapitalisasi;
      const id = randomUUID();
      const kel = str(a.kelompok);
      const data = {
        nama,
        kategori: KATEGORI_ASET.includes(str(a.kategori)) ? str(a.kategori) : 'Lain-lain',
        jenis: inv ? 'inventaris' : 'tetap',
        kelompok: KELOMPOK.includes(kel) ? kel : '1',
        tgl_perolehan: tanggal(a.tglPerolehan, k.hariIni, 'Tanggal perolehan'),
        harga_perolehan: harga,
        nilai_residu: 0,
        metode: 'garis_lurus',
        qty: 1,
        lokasi: 'Kantor Bandung',
        penanggung_jawab: str(a.penanggungJawab, 120) || null,
        kondisi: 'Baik',
        status: 'Aktif',
      };
      ops.push({ op: 'insert', tabel: 'aset', id, data });
      d.aset.push({ ...(data as unknown as Aset), id });
      return { ok: true, teks: `${inv ? 'Inventaris' : 'Aset tetap'} baru: ${nama} ${rp(harga)}` };
    },

    aset_ubah(a) {
      const s = wajibCocok(cariSatu(d.aset, str(a.nama), (x) => x.nama), 'aset', a.nama, (x: Aset) => x.nama);
      const ubah: Record<string, unknown> = {};
      if (ada(a.kondisi)) {
        if (!KONDISI.includes(str(a.kondisi))) throw new Tolak(`Kondisi "${str(a.kondisi)}" tidak dikenal`);
        ubah.kondisi = str(a.kondisi);
      }
      if (ada(a.status)) {
        if (!STATUS_ASET.includes(str(a.status))) throw new Tolak(`Status "${str(a.status)}" tidak dikenal`);
        ubah.status = str(a.status);
      }
      if (ada(a.penanggungJawab)) ubah.penanggung_jawab = str(a.penanggungJawab, 120);
      if (ada(a.lokasi)) ubah.lokasi = str(a.lokasi, 120);
      if (!Object.keys(ubah).length) throw new Tolak('Tidak ada yang diubah');
      ops.push({ op: 'update', tabel: 'aset', id: s.id, data: ubah });
      Object.assign(s, ubah);
      return { ok: true, teks: `${s.nama}: ${Object.values(ubah).join(' · ')}` };
    },

    pajak_setor(a) {
      const jenis = str(a.jenisPajak || a.jenis);
      const periode = str(a.periode);
      if (periode && !/^\d{4}-\d{2}$/.test(periode)) throw new Tolak(`Periode "${periode}" harus YYYY-MM`);
      const kand = d.pajak
        .filter((p) => !p.tgl_setor && skorCocok(jenis, p.jenis) >= 40 && (!periode || p.periode === periode))
        .sort((x, y) => x.periode.localeCompare(y.periode));
      if (!kand.length) throw new Tolak(`Tidak ada ${jenis || 'pajak'} yang belum disetor`);
      const p = kand[0];
      const tgl = tanggal(a.tanggal, k.hariIni);
      const ubah: Record<string, unknown> = { tgl_setor: tgl, tgl_lapor: p.tgl_lapor ?? tgl };
      if (ada(a.ntpn)) ubah.ntpn = str(a.ntpn, 40);
      ops.push({ op: 'update', tabel: 'pajak', id: p.id, data: ubah });
      Object.assign(p, ubah);
      return { ok: true, teks: `${p.jenis} ${bulanLabel(p.periode)} ditandai sudah setor ${rp(p.nominal)}` };
    },

    pajak_baru(a) {
      const jenis = str(a.jenisPajak || a.jenis);
      if (!JENIS_PAJAK[jenis]) throw new Tolak(`Jenis pajak "${jenis}" tidak dikenal`);
      const periode = ada(a.periode) ? str(a.periode) : geserBulan(bulanIni(), -1);
      if (!/^\d{4}-\d{2}$/.test(periode)) throw new Tolak(`Periode "${periode}" harus YYYY-MM`);
      if (d.pajak.some((p) => p.periode === periode && p.jenis === jenis))
        throw new Tolak(`${jenis} ${bulanLabel(periode)} sudah tercatat`);
      const nominal = intPositif(a.nominal);
      const id = randomUUID();
      const data = { periode, jenis, dpp: intNonNeg(a.dpp, 'DPP'), nominal };
      ops.push({ op: 'insert', tabel: 'pajak', id, data });
      d.pajak.push({ ...(data as unknown as (typeof d.pajak)[number]), id, tgl_setor: null, tgl_lapor: null });
      return { ok: true, teks: `Kewajiban ${jenis} ${bulanLabel(periode)} ${rp(nominal)}` };
    },

    rekening_baru(a) {
      const nama = str(a.nama, 100);
      if (!nama) throw new Tolak('Nama rekening kosong');
      if (d.rekening.some((x) => skorCocok(nama, x.nama) >= 80)) throw new Tolak(`Rekening "${nama}" sudah ada`);
      const id = randomUUID();
      const jenis = (JENIS_REKENING as readonly string[]).includes(str(a.jenis)) ? str(a.jenis) : 'Bank';
      const data = { nama, jenis, bank: str(a.bank, 60) || null, saldo_awal: intNonNeg(a.saldoAwal, 'Saldo awal') };
      ops.push({ op: 'insert', tabel: 'rekening', id, data });
      d.rekening.push({ ...(data as unknown as Rekening), id });
      return { ok: true, teks: `Rekening baru: ${nama}` };
    },
  };

  function cariTransaksi(q: unknown): Transaksi {
    const kueri = str(q);
    if (!kueri) throw new Tolak('Transaksi yang dimaksud tidak disebut');
    let best: Transaksi | null = null;
    let bs = 0;
    // urutan terbaru dulu → kalau skor sama, yang terbaru yang dipilih (sama dengan prototipe)
    for (const t of d.transaksi) {
      const s = Math.max(skorCocok(kueri, t.keterangan), skorCocok(kueri, t.kategori));
      if (s > bs) {
        bs = s;
        best = t;
      }
    }
    if (!best || bs < 40) throw new Tolak(`Transaksi "${kueri}" tidak ketemu`);
    return best;
  }

  function buatVendor(nama: string, a: A): Vendor {
    const id = randomUUID();
    const data = { nama, jenis: str(a.jenis, 60) || 'Lain-lain', wa: str(a.wa, 30).replace(/\D/g, '') || null, npwp: a.npwp === true };
    ops.push({ op: 'insert', tabel: 'vendor', id, data });
    const v = { ...(data as unknown as Vendor), id };
    d.vendor.push(v);
    return v;
  }

  const daftar = Array.isArray(aksiMentah) ? aksiMentah.slice(0, 20) : [];
  for (const mentah of daftar) {
    const a = (mentah && typeof mentah === 'object' ? mentah : {}) as A;
    const nama = str(a.aksi ?? a.jenis_aksi, 40);
    const fn = EKSEKUTOR[nama];
    if (!fn) {
      log.push({ ok: false, teks: `Aksi tidak dikenali: ${nama || '(kosong)'}` });
      continue;
    }
    if (!bolehKelola && !AKSI_STAF.has(nama)) {
      log.push({ ok: false, teks: `${nama.replace('_', ' ')}: hanya pemilik atau admin yang boleh` });
      continue;
    }
    // Aksi yang ditolak tidak boleh meninggalkan operasi setengah jadi.
    const panjang = ops.length;
    const snapshot = JSON.stringify(d);
    try {
      log.push(fn(a));
    } catch (e) {
      ops.length = panjang;
      Object.assign(d, JSON.parse(snapshot));
      log.push({ ok: false, teks: e instanceof Tolak ? `Ditolak: ${e.message}` : `Gagal: ${nama}` });
    }
  }
  return { ops, log };
}
