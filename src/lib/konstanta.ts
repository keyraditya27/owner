/**
 * Konstanta bisnis — disalin apa adanya dari prototipe arl-keuangan-v7.html.
 * Nama BUKAN_BEBAN dan KOREKSI_FISKAL wajib dipertahankan (CLAUDE.md).
 */
export const KATEGORI_KELUAR = [
  'Ads spend',
  'Gaji & fee tim',
  'Komisi KOL/affiliate',
  'Tools & langganan',
  'Operasional kantor',
  'Produksi konten',
  'Prive founder',
  'Sedekah & donasi',
  'Pembelian aset tetap',
  'Pajak',
  'Lain-lain',
] as const;

/* Pengurang ekuitas, bukan biaya usaha — dikeluarkan dari laba rugi */
export const BUKAN_BEBAN = ['Prive founder'];

/*
 * Belanja modal ≥ batas kapitalisasi (Rp5 jt): uangnya keluar dari kas, tapi BUKAN beban —
 * nilainya jadi aset tetap dan masuk laba rugi pelan-pelan lewat penyusutan. Kalau dihitung
 * sebagai beban juga, pembelian yang sama terhitung dua kali.
 */
export const KATEGORI_ASET_TETAP = 'Pembelian aset tetap';

/* Tidak bisa dikurangkan saat menghitung pajak (koreksi fiskal positif) */
export const KOREKSI_FISKAL = ['Sedekah & donasi', 'Prive founder'];

export const KATEGORI_MASUK = [
  'Retainer klien',
  'Project fee',
  'Ads budget titipan',
  'Bonus/insentif',
  'Lain-lain',
] as const;

/** Dana titipan klien = kewajiban, bukan pendapatan. */
export const KATEGORI_TITIPAN = 'Ads budget titipan';

export const SEMUA_KATEGORI = [...new Set<string>([...KATEGORI_MASUK, ...KATEGORI_KELUAR])];

export const kategoriUntuk = (tipe: 'masuk' | 'keluar'): readonly string[] =>
  tipe === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;

export const METODE = ['Transfer bank', 'Cash', 'E-wallet', 'Kartu'] as const;

export const JENIS_REKENING = ['Bank', 'Kas', 'E-wallet'] as const;

export const JENIS_VENDOR = [
  'KOL / affiliate',
  'Freelancer',
  'Tools & langganan',
  'Sewa & utilitas',
  'Produksi',
  'Lain-lain',
] as const;

/** Jadwal setor/lapor per jenis pajak (PMK 81/2024). lapor: tanggal, 'akhir' bulan berikutnya, atau null. */
export const JENIS_PAJAK: Record<string, { setor: number; lapor: number | 'akhir' | null }> = {
  'PPh 21': { setor: 15, lapor: 20 },
  'PPh 23': { setor: 15, lapor: 20 },
  'PPh 4(2)': { setor: 15, lapor: 20 },
  'PPN Keluaran': { setor: 15, lapor: 'akhir' },
  'PPh 25': { setor: 15, lapor: null },
};

/** Bukti transfer: tipe & ukuran yang diterima. */
export const BUKTI_TIPE = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
export const BUKTI_MAKS_BYTE = 8 * 1024 * 1024;

/** Pengeluaran staf DI ATAS angka ini masuk antrean persetujuan pemilik (dijaga juga oleh trigger di schema-tahap5.sql). */
export const BATAS_PERSETUJUAN = 5_000_000;

/** Kategori yang tidak boleh dilihat/dicatat staf (CLAUDE.md: staf tidak bisa melihat gaji). */
export const KATEGORI_GAJI = 'Gaji & fee tim';
