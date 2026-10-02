/**
 * Hitungan penawaran & invoice — disalin dari hitung()/subBaris() di
 * ARL-Workspace.html. Dipakai di browser (pratinjau) dan server (simpan),
 * supaya angkanya selalu sama. Semua rupiah bulat.
 */

export type Porsi = 'hemat' | 'standar' | 'premium';
export const PORSI: { id: Porsi; nama: string; desc: string }[] = [
  { id: 'hemat', nama: 'Hemat', desc: 'Esensial saja — cocok untuk brand yang baru mulai' },
  { id: 'standar', nama: 'Standar', desc: 'Porsi yang paling sering dipakai klien ARL' },
  { id: 'premium', nama: 'Premium', desc: 'Garap penuh semua kanal, volume konten maksimal' },
];

export const SATUAN = ['bulan', 'paket', 'sesi', 'video', 'konten', 'kreator', 'akun', 'titik', 'jam', 'hari', 'orang', 'unit'];
export const STATUS_DOKUMEN = ['Draf', 'Terkirim', 'Lunas', 'Batal'] as const;

export type BarisInv = {
  layanan_id: string | null; // null = baris bebas
  kelompok: string | null;
  nama: string;
  deskripsi: string | null;
  satuan: string;
  qty: number;
  harga: number;
  diskon_persen: number;
  berulang: boolean;
};

export type KepalaInv = {
  durasi_bulan: number;
  diskon: number;
  diskon_tipe: 'rp' | 'pct';
  ppn_aktif: boolean;
  pph23: boolean;
};

export const PPN_PERSEN = 11;
export const PPH23_PERSEN = 2;

export function nilaiBaris(b: BarisInv, durasi: number) {
  const kali = b.berulang ? Math.max(1, durasi || 1) : 1;
  return Math.round(b.qty * b.harga * kali * (1 - (b.diskon_persen || 0) / 100));
}

export function hitungInvoice(k: KepalaInv, baris: BarisInv[]) {
  const aktif = baris.filter((b) => b.qty > 0);
  const subtotal = aktif.reduce((s, b) => s + nilaiBaris(b, k.durasi_bulan), 0);
  const diskon = k.diskon_tipe === 'pct' ? Math.round((subtotal * (k.diskon || 0)) / 100) : Math.round(k.diskon || 0);
  const dpp = Math.max(0, subtotal - diskon);
  const ppn = k.ppn_aktif ? Math.round((dpp * PPN_PERSEN) / 100) : 0;
  const pph23_nilai = k.pph23 ? Math.round((dpp * PPH23_PERSEN) / 100) : 0;
  const total = dpp + ppn;
  return {
    subtotal,
    diskonRp: diskon,
    dpp,
    ppn,
    total,
    pph23_nilai,
    diterima: total - pph23_nilai,
    jml: aktif.length,
    perBulan: Math.round(dpp / Math.max(1, k.durasi_bulan || 1)),
  };
}
