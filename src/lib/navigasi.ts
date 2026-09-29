/**
 * Struktur halaman & sub-tab — mengikuti tabel "Struktur halaman" di CLAUDE.md
 * dan urutan menu di prototipe arl-keuangan-v7.html.
 */
export type Ikon = 'bar' | 'daftar' | 'user' | 'dompet' | 'lonceng' | 'dok' | 'tim' | 'kunci';

export type SubTab = { kunci: string; label: string };

export type Halaman = {
  href: string;
  label: string;
  labelPendek: string; // untuk menu bawah di HP
  ikon: Ikon;
  judul: string;
  badge: string;
  tabs: SubTab[];
};

export const HALAMAN: Halaman[] = [
  {
    href: '/ringkasan',
    label: 'Ringkasan',
    labelPendek: 'Ringkasan',
    ikon: 'bar',
    judul: 'Ringkasan Keuangan',
    badge: 'Ikhtisar',
    tabs: [
      { kunci: 'ikhtisar', label: 'Ikhtisar' },
      { kunci: 'kas', label: 'Kas & Rekening' },
      { kunci: 'piutang', label: 'Piutang Klien' },
      { kunci: 'utang', label: 'Utang & Pajak' },
    ],
  },
  {
    href: '/transaksi',
    label: 'Transaksi',
    labelPendek: 'Transaksi',
    ikon: 'daftar',
    judul: 'Buku Transaksi',
    badge: 'Kas Masuk & Keluar',
    tabs: [
      { kunci: 'semua', label: 'Semua' },
      { kunci: 'masuk', label: 'Masuk' },
      { kunci: 'keluar', label: 'Keluar' },
      { kunci: 'bukti', label: 'Tanpa Bukti' },
    ],
  },
  {
    href: '/klien',
    label: 'Klien & Tagihan',
    labelPendek: 'Klien',
    ikon: 'user',
    judul: 'Klien & Tagihan',
    badge: 'Database Klien',
    tabs: [
      { kunci: 'aktif', label: 'Semua Klien' },
      { kunci: 'telat', label: 'Ada Tunggakan' },
      { kunci: 'kontribusi', label: 'Kontribusi' },
    ],
  },
  {
    href: '/aset',
    label: 'Aset & Inventaris',
    labelPendek: 'Aset',
    ikon: 'dompet',
    judul: 'Aset & Inventaris',
    badge: 'Register Harta',
    tabs: [
      { kunci: 'tetap', label: 'Aset Tetap' },
      { kunci: 'inventaris', label: 'Inventaris' },
      { kunci: 'penyusutan', label: 'Penyusutan' },
      { kunci: 'perhatian', label: 'Perlu Perhatian' },
    ],
  },
  {
    href: '/pajak',
    label: 'Pajak',
    labelPendek: 'Pajak',
    ikon: 'lonceng',
    judul: 'Kewajiban Pajak',
    badge: 'Compliance',
    tabs: [
      { kunci: 'kewajiban', label: 'Kewajiban' },
      { kunci: 'kalkulator', label: 'Kalkulator' },
      { kunci: 'tahunan', label: 'PPh Badan' },
      { kunci: 'panduan', label: 'Panduan' },
    ],
  },
  {
    href: '/laporan',
    label: 'Laporan',
    labelPendek: 'Laporan',
    ikon: 'dok',
    judul: 'Laporan Keuangan',
    badge: 'Rekap Internal',
    tabs: [
      { kunci: 'neraca', label: 'Neraca' },
      { kunci: 'labarugi', label: 'Laba Rugi' },
      { kunci: 'aruskas', label: 'Arus Kas' },
      { kunci: 'kategori', label: 'Per Kategori' },
    ],
  },
];

/** Halaman Kontrol (Tahap 5) — di luar enam menu utama. Tab yang tampil tergantung peran. */
export const KONTROL: Halaman = {
  href: '/kontrol',
  label: 'Kontrol',
  labelPendek: 'Kontrol',
  ikon: 'kunci',
  judul: 'Kontrol',
  badge: 'Pengaman',
  tabs: [
    { kunci: 'persetujuan', label: 'Persetujuan' },
    { kunci: 'tutupbuku', label: 'Tutup Buku' },
    { kunci: 'riwayat', label: 'Riwayat Perubahan' },
    { kunci: 'backup', label: 'Backup' },
  ],
};

/** Tab Kontrol yang boleh dibuka tiap peran. */
export const tabKontrolUntuk = (peran: 'pemilik' | 'admin' | 'staf') =>
  peran === 'pemilik' ? KONTROL.tabs : peran === 'admin' ? KONTROL.tabs.slice(0, 2) : KONTROL.tabs.slice(0, 1);

export const halamanDari = (href: string) => HALAMAN.find((h) => h.href === href)!;

/** Tab aktif dari ?tab=..., jatuh ke tab pertama kalau tidak dikenal. */
export function tabAktif(h: Halaman, nilai: string | string[] | undefined): string {
  const v = Array.isArray(nilai) ? nilai[0] : nilai;
  return h.tabs.some((t) => t.kunci === v) ? (v as string) : h.tabs[0].kunci;
}
