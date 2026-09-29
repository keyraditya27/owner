/**
 * Tipe TypeScript untuk skema database — ditulis tangan dari schema.sql +
 * schema-tambahan-sheets.sql. Kalau skema berubah, ubah file ini juga.
 * (Bisa diganti hasil `supabase gen types typescript` nanti; nama & bentuknya sama.)
 *
 * Semua uang bertipe number: Postgres bigint dikirim PostgREST sebagai angka
 * JSON, aman sampai 9 kuadriliun rupiah.
 */

export type Peran = 'pemilik' | 'admin' | 'staf';
export type TipeTransaksi = 'masuk' | 'keluar';
export type JenisRekening = 'Bank' | 'Kas' | 'E-wallet';
export type JenisAset = 'tetap' | 'inventaris';
export type KelompokFiskal = '1' | '2' | '3' | '4' | 'bp' | 'bnp';
export type MetodeSusut = 'garis_lurus' | 'saldo_menurun';
export type KondisiAset = 'Baik' | 'Perlu perbaikan' | 'Rusak';
export type StatusAset = 'Aktif' | 'Dilepas' | 'Hilang';
export type JenisPajak = 'PPh 21' | 'PPh 23' | 'PPh 4(2)' | 'PPN Keluaran' | 'PPh 25';

/** Kolom tambahan dari schema-tambahan-sheets.sql + schema-tahap6.sql */
type KolomSinkron = {
  sheet_diubah: string | null;
  sheet_sumber: string | null;
  arsip: boolean;
  /** sidik baris saat terakhir sama dengan sheet — hanya dipakai mesin sinkron */
  sheet_hash?: string | null;
  diubah_pada?: string;
};

export type Perusahaan = {
  id: string;
  nama: string;
  npwp: string | null;
  pkp: boolean;
  alamat: string | null;
  modal_disetor: number;
  batas_kapitalisasi: number;
  tahun_buku: number;
  logo_url: string | null;
  dibuat_pada: string;
};

export type Pengguna = {
  id: string;
  nama: string;
  peran: Peran;
  aktif: boolean;
  dibuat_pada: string;
};

export type Rekening = KolomSinkron & {
  id: string;
  nama: string;
  jenis: JenisRekening;
  bank: string | null;
  no_rek: string | null;
  saldo_awal: number;
  catatan: string | null;
  urutan: number;
  aktif: boolean;
  dibuat_pada: string;
};

export type Klien = KolomSinkron & {
  id: string;
  nama: string;
  pic: string | null;
  wa: string | null;
  npwp: string | null;
  paket: string | null;
  nilai_bulanan: number;
  tanggal_tagih: number;
  tempo_hari: number;
  catatan: string | null;
  aktif: boolean;
  dibuat_pada: string;
};

export type Tagihan = KolomSinkron & {
  id: string;
  klien_id: string;
  nomor_invoice: string | null;
  periode: string;
  nominal: number;
  ppn: number;
  pph23_dipotong: number;
  bukti_potong_url: string | null;
  dibayar: number;
  tgl_invoice: string;
  jatuh_tempo: string;
  catatan: string | null;
  dibuat_pada: string;
};

export type Vendor = KolomSinkron & {
  id: string;
  nama: string;
  jenis: string;
  wa: string | null;
  npwp: boolean;
  catatan: string | null;
  dibuat_pada: string;
};

export type UtangVendor = KolomSinkron & {
  id: string;
  vendor_id: string;
  keterangan: string;
  nominal: number;
  dibayar: number;
  jatuh_tempo: string;
  catatan: string | null;
  dibuat_pada: string;
};

export type Transaksi = KolomSinkron & {
  id: string;
  tanggal: string;
  tipe: TipeTransaksi;
  nominal: number;
  kategori: string;
  keterangan: string;
  metode: string;
  klien_id: string | null;
  vendor_id: string | null;
  rekening_id: string | null;
  tagihan_id: string | null;
  ppn: number;
  pph_dipotong: number;
  bukti_url: string | null;
  bukti_nama: string | null;
  /** kolom K tab Transaksi (schema-tahap6.sql) */
  catatan?: string | null;
  sumber: string;
  dibuat_oleh: string | null;
  dibuat_pada: string;
  diubah_pada: string;
};

export type Aset = KolomSinkron & {
  id: string;
  kode: string | null;
  nama: string;
  kategori: string;
  jenis: JenisAset;
  kelompok: KelompokFiskal;
  tgl_perolehan: string;
  harga_perolehan: number;
  nilai_residu: number;
  metode: MetodeSusut;
  qty: number;
  lokasi: string | null;
  penanggung_jawab: string | null;
  kondisi: KondisiAset;
  status: StatusAset;
  tgl_lepas: string | null;
  nilai_jual: number | null;
  catatan: string | null;
  transaksi_id: string | null;
  dibuat_pada: string;
};

export type Pajak = KolomSinkron & {
  id: string;
  periode: string;
  jenis: JenisPajak;
  dpp: number;
  nominal: number;
  tgl_setor: string | null;
  ntpn: string | null;
  tgl_lapor: string | null;
  bukti_url: string | null;
  catatan: string | null;
  dibuat_pada: string;
};

export type TutupBuku = {
  periode: string;
  ditutup_pada: string;
  ditutup_oleh: string | null;
  catatan: string | null;
};

export type AuditLog = {
  id: number;
  pengguna_id: string | null;
  tabel: string;
  record_id: string | null;
  aksi: string;
  nilai_lama: unknown;
  nilai_baru: unknown;
  sumber: string | null;
  waktu: string;
};

export type Pengajuan = {
  id: string;
  tanggal: string;
  nominal: number;
  kategori: string;
  keterangan: string;
  metode: string;
  rekening_id: string | null;
  klien_id: string | null;
  bukti_url: string | null;
  bukti_nama: string | null;
  diajukan_oleh: string;
  status: 'menunggu' | 'disetujui' | 'ditolak';
  diputus_oleh: string | null;
  diputus_pada: string | null;
  alasan: string | null;
  transaksi_id: string | null;
  dibuat_pada: string;
};
