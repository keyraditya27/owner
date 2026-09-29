/**
 * Struktur tab di sheet KEUANGAN ARL — lihat integrasi-google-sheets.md.
 * Pola tetap untuk semua tab: kolom pertama ID, tiga kolom terakhir Diubah, Sumber, Status.
 * Karena polanya sama, mesin sinkronnya (sinkron.ts) satu fungsi untuk delapan tab.
 *
 * Tiap kolom punya dua arah:
 *   ke()  : nilai database → isi sel
 *   dari(): isi sel → nilai database (melempar GalatSel kalau tidak valid)
 * Sidik baris dihitung dari ke(dari(sel)) — jadi "1.500.000" dan 1500000 dianggap sama.
 *
 * Payroll & karyawan TIDAK punya tab di sini, dan transaksi berkategori gaji disaring.
 */
import { JENIS_REKENING, JENIS_VENDOR, KATEGORI_GAJI, METODE, SEMUA_KATEGORI, kategoriUntuk, JENIS_PAJAK } from '@/lib/konstanta';
import { tanggalValid } from '@/lib/format';
import type { Sel } from './google';

export type Rec = Record<string, unknown>;
export class GalatSel extends Error {}

export type Rujukan = { id: string; nama: string };
export type Konteks = {
  klien: Rujukan[];
  vendor: Rujukan[];
  rekening: Rujukan[];
  /** periode "YYYY-MM" yang sudah tutup buku */
  tertutup: Set<string>;
  /** alamat aplikasi, untuk tautan bukti */
  urlAplikasi: string;
};

export type Kolom = {
  judul: string;
  /** kolom di database; undefined = kolom tampilan saja (tidak dibaca balik) */
  field?: string;
  ke: (r: Rec, k: Konteks) => Sel;
  dari?: (s: Sel, k: Konteks) => unknown;
  /** ikut dihitung di sidik baris (default ya untuk kolom yang punya dari()) */
  sidik?: boolean;
};

export type Tab = {
  judul: string;
  tabel: string;
  kolom: Kolom[];
  /** baris database yang boleh tampil di sheet */
  tampil?: (r: Rec) => boolean;
  /** aturan antar-kolom; kembalikan alasan penolakan atau null */
  cek?: (baru: Rec, lama: Rec | null, k: Konteks, semua: Rec[]) => string | null;
  /** nilai tambahan saat baris baru dibuat dari sheet */
  bawaanBaru?: Rec;
};

/* ------------------------------------------------------------------ bantu */
export const PREFIKS_TOLAK = '⚠ DITOLAK: ';
const kosong = (s: Sel) => s === null || s === undefined || String(s).trim() === '';
const str = (s: Sel) => (kosong(s) ? '' : String(s).trim());
const sama = (a: string, b: string) => a.localeCompare(b, 'id', { sensitivity: 'accent' }) === 0;

/** Catatan asli tanpa prefiks alasan tolak yang ditulis sinkron sebelumnya. */
export function catatanAsli(s: Sel): string {
  const t = str(s);
  if (!t.startsWith(PREFIKS_TOLAK.trim())) return t;
  const i = t.indexOf(' | ');
  return i < 0 ? '' : t.slice(i + 3).trim();
}

/** Nomor seri tanggal Sheets (hari sejak 30 Des 1899) → YYYY-MM-DD */
function dariSeri(n: number) {
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000).toISOString().slice(0, 10);
}

/** Cap waktu ISO dalam WIB, dibulatkan ke detik: 2026-09-29T17:00:00+07:00 */
export function isoWib(ts: string | number | Date | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 19) + '+07:00';
}

/* --------------------------------------------------------- pembuat kolom */
function teks(judul: string, field: string, o: { wajib?: boolean; maks?: number; bawaan?: string } = {}): Kolom {
  return {
    judul,
    field,
    ke: (r) => (r[field] as string | null) ?? '',
    dari: (s) => {
      const t = str(s).slice(0, o.maks ?? 500);
      if (!t && o.wajib) throw new GalatSel(`${judul} wajib diisi`);
      return t || (o.bawaan ?? null);
    },
  };
}

function catatan(): Kolom {
  return {
    judul: 'Catatan',
    field: 'catatan',
    ke: (r) => (r.catatan as string | null) ?? '',
    dari: (s) => catatanAsli(s).slice(0, 1000) || null,
  };
}

/** Rupiah bulat ≥ 0. Buang "Rp", spasi, dan titik/koma pemisah ribuan. Pecahan ditolak. */
export function bacaRupiah(s: Sel, judul: string): number | null {
  if (kosong(s)) return null;
  if (typeof s === 'number') {
    if (!Number.isInteger(s) || s < 0) throw new GalatSel(`${judul} harus angka bulat ≥ 0 (tanpa sen)`);
    return s;
  }
  let t = String(s).replace(/rp\.?/gi, '').replace(/\s/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  if (!/^\d+$/.test(t)) throw new GalatSel(`${judul} harus angka bulat ≥ 0, tanpa sen — "${str(s)}" tidak bisa dibaca`);
  const n = Number(t);
  if (n > 1e14) throw new GalatSel(`${judul} terlalu besar`);
  return n;
}

function rupiah(judul: string, field: string, o: { wajib?: boolean; bolehNull?: boolean } = {}): Kolom {
  return {
    judul,
    field,
    ke: (r) => (r[field] === null || r[field] === undefined ? '' : Number(r[field])),
    dari: (s) => {
      const n = bacaRupiah(s, judul);
      if (n === null && o.wajib) throw new GalatSel(`${judul} wajib diisi`);
      return n ?? (o.bolehNull ? null : 0);
    },
  };
}

function bulat(judul: string, field: string, min: number, maks: number, bawaan: number): Kolom {
  return {
    judul,
    field,
    ke: (r) => Number(r[field] ?? bawaan),
    dari: (s) => {
      if (kosong(s)) return bawaan;
      const n = typeof s === 'number' ? s : Number(str(s));
      if (!Number.isInteger(n) || n < min || n > maks) throw new GalatSel(`${judul} harus angka bulat ${min}–${maks}`);
      return n;
    },
  };
}

export function bacaTanggal(s: Sel, judul: string): string | null {
  if (kosong(s)) return null;
  if (typeof s === 'number') return dariSeri(s);
  const t = str(s);
  if (!tanggalValid(t)) throw new GalatSel(`${judul} harus tanggal valid berformat YYYY-MM-DD — "${t}" tidak bisa dibaca`);
  return t;
}

function tgl(judul: string, field: string, o: { wajib?: boolean } = {}): Kolom {
  return {
    judul,
    field,
    ke: (r) => (r[field] as string | null) ?? '',
    dari: (s) => {
      const d = bacaTanggal(s, judul);
      if (!d && o.wajib) throw new GalatSel(`${judul} wajib diisi`);
      return d;
    },
  };
}

/** Pilihan tetap. peta: [label di sheet, nilai di database]. Cocok tanpa peduli huruf besar/kecil. */
function pilih(judul: string, field: string, peta: readonly (readonly [string, string])[], o: { bawaan?: string } = {}): Kolom {
  return {
    judul,
    field,
    ke: (r) => peta.find(([, v]) => v === r[field])?.[0] ?? String(r[field] ?? ''),
    dari: (s) => {
      const t = str(s);
      if (!t) {
        if (o.bawaan !== undefined) return o.bawaan;
        throw new GalatSel(`${judul} wajib diisi`);
      }
      const h = peta.find(([l, v]) => sama(l, t) || sama(v, t));
      if (!h) throw new GalatSel(`${judul} "${t}" tidak ada di daftar (${peta.map(([l]) => l).join(', ')})`);
      return h[1];
    },
  };
}
const sendiri = (xs: readonly string[]) => xs.map((x) => [x, x] as const);

function yaTidak(judul: string, field: string, bawaan: boolean): Kolom {
  return {
    judul,
    field,
    ke: (r) => ((r[field] ?? bawaan) ? 'Ya' : 'Tidak'),
    dari: (s) => {
      const t = str(s).toLowerCase();
      if (!t) return bawaan;
      if (['ya', 'y', 'true', '1'].includes(t) || s === true) return true;
      if (['tidak', 't', 'false', '0'].includes(t) || s === false) return false;
      throw new GalatSel(`${judul} harus Ya atau Tidak`);
    },
  };
}

/** Nama klien/vendor/rekening harus cocok dengan data yang ada — tidak pernah membuat data baru dari salah ketik. */
function rujuk(judul: string, field: string, jenis: 'klien' | 'vendor' | 'rekening', o: { wajib?: boolean } = {}): Kolom {
  return {
    judul,
    field,
    ke: (r, k) => k[jenis].find((x) => x.id === r[field])?.nama ?? '',
    dari: (s, k) => {
      const t = str(s);
      if (!t) {
        if (o.wajib) throw new GalatSel(`${judul} wajib diisi`);
        return null;
      }
      // Satu id bisa muncul dua kali: nama baru + nama lama yang baru saja diganti di putaran ini
      const cocok = [...new Set(k[jenis].filter((x) => sama(x.nama.trim(), t)).map((x) => x.id))];
      if (!cocok.length) throw new GalatSel(`${judul} "${t}" tidak ditemukan — tulis persis seperti di aplikasi`);
      if (cocok.length > 1) throw new GalatSel(`${judul} "${t}" ada lebih dari satu — ganti namanya di aplikasi dulu`);
      return cocok[0];
    },
  };
}

const kolomId: Kolom = { judul: 'ID', ke: (r) => (r.id as string) ?? '' };
const kolomDiubah: Kolom = { judul: 'Diubah', ke: (r) => isoWib(r.diubah_pada as string) };
const kolomSumber = (fn?: (r: Rec) => string): Kolom => ({
  judul: 'Sumber',
  ke: (r) => (r.sheet_sumber === 'sheet' ? 'sheet' : fn ? fn(r) : 'aplikasi'),
});
const kolomStatus: Kolom = {
  judul: 'Status',
  field: 'arsip',
  ke: (r) => (r.arsip ? 'dihapus' : 'aktif'),
  dari: (s) => {
    const t = str(s).toLowerCase();
    if (!t || t === 'aktif') return false;
    if (t === 'dihapus') return true;
    throw new GalatSel('Status harus aktif atau dihapus');
  },
};

const tab = (judul: string, tabel: string, isi: Kolom[], lain: Partial<Tab> = {}, sumber?: (r: Rec) => string): Tab => ({
  judul,
  tabel,
  kolom: [kolomId, ...isi, kolomDiubah, kolomSumber(sumber), kolomStatus],
  ...lain,
});

const unik = (semua: Rec[], baru: Rec, lama: Rec | null, field: string) =>
  baru[field] != null && semua.some((r) => r.id !== lama?.id && String(r[field] ?? '').trim().toLowerCase() === String(baru[field]).trim().toLowerCase());

/* ------------------------------------------------------------------ tab */
export const TAB: Tab[] = [
  tab(
    'Transaksi',
    'transaksi',
    [
      tgl('Tanggal', 'tanggal', { wajib: true }),
      pilih('Tipe', 'tipe', [
        ['Masuk', 'masuk'],
        ['Keluar', 'keluar'],
      ]),
      teks('Keterangan', 'keterangan', { wajib: true, maks: 300 }),
      pilih('Kategori', 'kategori', sendiri(SEMUA_KATEGORI)),
      rujuk('Klien', 'klien_id', 'klien'),
      rujuk('Rekening', 'rekening_id', 'rekening'),
      rupiah('Nominal', 'nominal', { wajib: true }),
      pilih('Metode', 'metode', sendiri(METODE), { bawaan: 'Transfer bank' }),
      // Tautan ke aplikasi (wajib login), BUKAN tautan langsung ke file —
      // sheet bisa dibuka siapa saja yang punya tautannya.
      { judul: 'Bukti', ke: (r, k) => (r.bukti_url ? `${k.urlAplikasi}/bukti/${r.id}` : '') },
      catatan(),
    ],
    {
      tampil: (r) => r.kategori !== KATEGORI_GAJI,
      bawaanBaru: { sumber: 'sheet' },
      cek: (b, lama, k) => {
        if (b.kategori === KATEGORI_GAJI) return 'Data gaji tidak boleh ada di sheet — hapus baris ini dan catat lewat aplikasi';
        if (!kategoriUntuk(b.tipe as 'masuk' | 'keluar').includes(b.kategori as string))
          return `Kategori "${b.kategori}" bukan kategori ${b.tipe === 'masuk' ? 'Masuk' : 'Keluar'}`;
        for (const t of [lama?.tanggal, b.tanggal]) {
          const p = String(t ?? '').slice(0, 7);
          if (p && k.tertutup.has(p)) return `Periode ${p} sudah tutup buku`;
        }
        return null;
      },
    },
    (r) => (r.sumber === 'ai' ? 'ai' : 'aplikasi'),
  ),
  tab(
    'Klien',
    'klien',
    [
      teks('Nama', 'nama', { wajib: true, maks: 120 }),
      teks('PIC', 'pic'),
      teks('WA', 'wa', { maks: 30 }),
      teks('NPWP', 'npwp', { maks: 30 }),
      teks('Paket', 'paket'),
      rupiah('Nilai Bulanan', 'nilai_bulanan'),
      bulat('Tgl Tagih', 'tanggal_tagih', 1, 28, 1),
      bulat('Tempo (hari)', 'tempo_hari', 0, 90, 7),
      yaTidak('Aktif', 'aktif', true),
      catatan(),
    ],
    { cek: (b, l, _k, s) => (unik(s, b, l, 'nama') ? `Nama klien "${b.nama}" sudah dipakai` : null) },
  ),
  tab(
    'Tagihan',
    'tagihan',
    [
      teks('No Invoice', 'nomor_invoice', { maks: 60 }),
      rujuk('Klien', 'klien_id', 'klien', { wajib: true }),
      teks('Periode', 'periode', { wajib: true, maks: 40 }),
      rupiah('Nominal', 'nominal', { wajib: true }),
      rupiah('PPN', 'ppn'),
      rupiah('PPh 23 Dipotong', 'pph23_dipotong'),
      rupiah('Dibayar', 'dibayar'),
      tgl('Tgl Invoice', 'tgl_invoice', { wajib: true }),
      tgl('Jatuh Tempo', 'jatuh_tempo', { wajib: true }),
      catatan(),
    ],
    {
      cek: (b, l, _k, s) => {
        if (Number(b.dibayar) > Number(b.nominal) + Number(b.ppn)) return 'Dibayar melebihi nominal + PPN';
        if (unik(s, b, l, 'nomor_invoice')) return `No invoice "${b.nomor_invoice}" sudah dipakai`;
        return null;
      },
    },
  ),
  tab(
    'Vendor',
    'vendor',
    [
      teks('Nama', 'nama', { wajib: true, maks: 120 }),
      pilih('Jenis', 'jenis', sendiri(JENIS_VENDOR), { bawaan: 'Lain-lain' }),
      teks('WA', 'wa', { maks: 30 }),
      yaTidak('Punya NPWP', 'npwp', false),
      catatan(),
    ],
    { cek: (b, l, _k, s) => (unik(s, b, l, 'nama') ? `Nama vendor "${b.nama}" sudah dipakai` : null) },
  ),
  tab(
    'Utang',
    'utang_vendor',
    [
      rujuk('Vendor', 'vendor_id', 'vendor', { wajib: true }),
      teks('Keterangan', 'keterangan', { wajib: true, maks: 300 }),
      rupiah('Nominal', 'nominal', { wajib: true }),
      rupiah('Dibayar', 'dibayar'),
      tgl('Jatuh Tempo', 'jatuh_tempo', { wajib: true }),
      catatan(),
    ],
    { cek: (b) => (Number(b.dibayar) > Number(b.nominal) ? 'Dibayar melebihi nominal' : null) },
  ),
  tab(
    'Aset',
    'aset',
    [
      teks('Kode', 'kode', { maks: 40 }),
      teks('Nama', 'nama', { wajib: true, maks: 200 }),
      teks('Kategori', 'kategori', { maks: 60, bawaan: 'Lain-lain' }),
      pilih('Jenis', 'jenis', [
        ['Tetap', 'tetap'],
        ['Inventaris', 'inventaris'],
      ], { bawaan: 'tetap' }),
      pilih('Kelompok', 'kelompok', [
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['4', '4'],
        ['Bangunan permanen', 'bp'],
        ['Bangunan tidak permanen', 'bnp'],
      ], { bawaan: '1' }),
      tgl('Tgl Perolehan', 'tgl_perolehan', { wajib: true }),
      rupiah('Harga Perolehan', 'harga_perolehan', { wajib: true }),
      rupiah('Nilai Residu', 'nilai_residu'),
      pilih('Metode', 'metode', [
        ['Garis lurus', 'garis_lurus'],
        ['Saldo menurun', 'saldo_menurun'],
      ], { bawaan: 'garis_lurus' }),
      bulat('Qty', 'qty', 1, 100000, 1),
      teks('Lokasi', 'lokasi'),
      teks('Penanggung Jawab', 'penanggung_jawab'),
      pilih('Kondisi', 'kondisi', sendiri(['Baik', 'Perlu perbaikan', 'Rusak']), { bawaan: 'Baik' }),
      pilih('Status Aset', 'status', sendiri(['Aktif', 'Dilepas', 'Hilang']), { bawaan: 'Aktif' }),
      tgl('Tgl Lepas', 'tgl_lepas'),
      rupiah('Nilai Jual', 'nilai_jual', { bolehNull: true }),
      catatan(),
    ],
    {
      cek: (b, l, _k, s) => {
        if (Number(b.nilai_residu) > Number(b.harga_perolehan)) return 'Nilai residu melebihi harga perolehan';
        if ((b.kelompok === 'bp' || b.kelompok === 'bnp') && b.metode !== 'garis_lurus') return 'Bangunan hanya boleh disusutkan garis lurus';
        if (unik(s, b, l, 'kode')) return `Kode aset "${b.kode}" sudah dipakai`;
        return null;
      },
    },
  ),
  tab(
    'Pajak',
    'pajak',
    [
      {
        judul: 'Periode',
        field: 'periode',
        ke: (r) => String(r.periode ?? ''),
        dari: (s) => {
          // Sheets suka mengubah "2026-08" jadi tanggal → terima juga nomor seri tanggal
          const t = typeof s === 'number' ? dariSeri(s).slice(0, 7) : str(s);
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) throw new GalatSel('Periode harus berformat YYYY-MM');
          return t;
        },
      },
      pilih('Jenis', 'jenis', sendiri(Object.keys(JENIS_PAJAK))),
      rupiah('DPP', 'dpp'),
      rupiah('Nominal', 'nominal'),
      tgl('Tgl Setor', 'tgl_setor'),
      teks('NTPN', 'ntpn', { maks: 40 }),
      tgl('Tgl Lapor', 'tgl_lapor'),
      catatan(),
    ],
    {
      cek: (b, l, _k, s) =>
        s.some((r) => r.id !== l?.id && r.periode === b.periode && r.jenis === b.jenis)
          ? `${b.jenis} periode ${b.periode} sudah ada`
          : null,
    },
  ),
  tab('Rekening', 'rekening', [
    teks('Nama', 'nama', { wajib: true, maks: 80 }),
    pilih('Jenis', 'jenis', sendiri(JENIS_REKENING), { bawaan: 'Bank' }),
    teks('Bank', 'bank', { maks: 60 }),
    {
      // Hanya 4 digit terakhir (schema.sql). Nomor lengkap yang terlanjur diketik dipotong.
      judul: 'No Rek (4 digit akhir)',
      field: 'no_rek',
      ke: (r) => (r.no_rek as string | null) ?? '',
      dari: (s) => str(s).replace(/\D/g, '').slice(-4) || null,
    },
    rupiah('Saldo Awal', 'saldo_awal'),
    bulat('Urutan', 'urutan', 0, 999, 0),
    yaTidak('Aktif', 'aktif', true),
    catatan(),
  ]),
];

/** Kolom data yang dibaca dari sheet (punya field + dari). */
export const kolomData = (t: Tab) => t.kolom.filter((k) => k.field && k.dari);

/* ---------------------------------------------------------- tab Ringkasan */
export const JUDUL_RINGKASAN = 'Ringkasan';

/** Ditulis sekali saat tab dibuat (USER_ENTERED supaya jadi rumus). Aplikasi tidak pernah membaca tab ini. */
export const ISI_RINGKASAN: (string | number)[][] = [
  ['RINGKASAN — dihitung otomatis dari tab lain. JANGAN diedit manual.'],
  ['Hanya baris berstatus "aktif". Data gaji tidak ada di sheet, jadi total keluar di sini lebih kecil dari aplikasi.'],
  [],
  ['Pos', 'Nilai'],
  ['Total kas masuk', '=SUMIFS(Transaksi!H:H,Transaksi!C:C,"Masuk",Transaksi!N:N,"aktif")'],
  ['Total kas keluar (tanpa gaji)', '=SUMIFS(Transaksi!H:H,Transaksi!C:C,"Keluar",Transaksi!N:N,"aktif")'],
  ['Selisih', '=B5-B6'],
  ['Dana titipan klien masuk (kewajiban, bukan pendapatan)', '=SUMIFS(Transaksi!H:H,Transaksi!E:E,"Ads budget titipan",Transaksi!C:C,"Masuk",Transaksi!N:N,"aktif")'],
  ['Prive founder (bukan beban)', '=SUMIFS(Transaksi!H:H,Transaksi!E:E,"Prive founder",Transaksi!N:N,"aktif")'],
  ['Piutang klien (nominal − dibayar − PPh 23)', '=SUMIFS(Tagihan!E:E,Tagihan!N:N,"aktif")-SUMIFS(Tagihan!H:H,Tagihan!N:N,"aktif")-SUMIFS(Tagihan!G:G,Tagihan!N:N,"aktif")'],
  ['Utang vendor (nominal − dibayar)', '=SUMIFS(Utang!D:D,Utang!J:J,"aktif")-SUMIFS(Utang!E:E,Utang!J:J,"aktif")'],
  ['Jumlah transaksi aktif', '=COUNTIFS(Transaksi!N:N,"aktif")'],
];
