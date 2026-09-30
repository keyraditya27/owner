/**
 * Penyusutan fiskal — disalin dari "helper aset" di prototipe v7.
 * CLAUDE.md: penyusutan DIHITUNG, TIDAK DISIMPAN. Semua fungsi di sini
 * murni dari kolom tabel aset.
 * Kelompok mengikuti Pasal 11 UU PPh jo. PMK 72/2023.
 */
import { bulanIni, geserBulan } from '@/lib/format';
import type { Aset } from '@/lib/tipe-db';

export const KELOMPOK: Record<string, { label: string; th: number; gl: number; sm: number | null }> = {
  '1': { label: 'Kelompok 1 — 4 tahun', th: 4, gl: 0.25, sm: 0.5 },
  '2': { label: 'Kelompok 2 — 8 tahun', th: 8, gl: 0.125, sm: 0.25 },
  '3': { label: 'Kelompok 3 — 16 tahun', th: 16, gl: 0.0625, sm: 0.125 },
  '4': { label: 'Kelompok 4 — 20 tahun', th: 20, gl: 0.05, sm: 0.1 },
  bp: { label: 'Bangunan permanen — 20 tahun', th: 20, gl: 0.05, sm: null },
  bnp: { label: 'Bangunan tidak permanen — 10 tahun', th: 10, gl: 0.1, sm: null },
};

export const KATEGORI_ASET = [
  'Komputer & laptop',
  'Kamera & peralatan produksi',
  'Peralatan kantor',
  'Furnitur',
  'Kendaraan',
  'Bangunan',
  'Perangkat lunak & lisensi',
  'Lain-lain',
] as const;
export const KONDISI = ['Baik', 'Perlu perbaikan', 'Rusak'] as const;
export const STATUS_ASET = ['Aktif', 'Dilepas', 'Hilang'] as const;

/** Jumlah bulan yang sudah disusutkan sampai ym (termasuk bulan perolehan). */
export function bulanJalan(a: Aset, sampaiYM?: string) {
  if (!a.tgl_perolehan) return 0;
  const [y1, m1] = a.tgl_perolehan.slice(0, 7).split('-').map(Number);
  const [y2, m2] = (sampaiYM || bulanIni()).split('-').map(Number);
  let n = (y2 - y1) * 12 + (m2 - m1) + 1; // penyusutan mulai bulan perolehan
  const maks = (KELOMPOK[a.kelompok]?.th || 4) * 12;
  if (a.status === 'Dilepas' && a.tgl_lepas) {
    const [y3, m3] = a.tgl_lepas.slice(0, 7).split('-').map(Number);
    n = Math.min(n, (y3 - y1) * 12 + (m3 - m1) + 1);
  }
  return Math.max(0, Math.min(n, maks));
}

export function susutBulanan(a: Aset) {
  const K = KELOMPOK[a.kelompok];
  if (!K || a.jenis === 'inventaris') return 0;
  const dasar = Math.max(0, (a.harga_perolehan || 0) - (a.nilai_residu || 0));
  if (a.metode === 'saldo_menurun' && K.sm) return Math.round((dasar * K.sm) / 12); // pendekatan rata bulanan
  return Math.round(dasar / (K.th * 12));
}

export function akumulasi(a: Aset, ym?: string) {
  if (a.jenis === 'inventaris') return 0;
  const dasar = Math.max(0, (a.harga_perolehan || 0) - (a.nilai_residu || 0));
  const K = KELOMPOK[a.kelompok];
  // Garis lurus: dibulatkan sekali dari total, bukan susut-bulanan-yang-sudah-dibulatkan × bulan.
  // Beda dengan prototipe yang menumpuk selisih pembulatan (Rp32 jt, 3 bulan → Rp2.000.001).
  if (K && !(a.metode === 'saldo_menurun' && K.sm)) {
    return Math.min(dasar, Math.round((dasar * bulanJalan(a, ym)) / (K.th * 12)));
  }
  return Math.min(dasar, susutBulanan(a) * bulanJalan(a, ym));
}

export const nilaiBuku = (a: Aset, ym?: string) =>
  a.jenis === 'inventaris' ? 0 : Math.max(a.nilai_residu || 0, (a.harga_perolehan || 0) - akumulasi(a, ym));

export const asetAktif = (arr: Aset[]) => arr.filter((a) => a.status !== 'Dilepas' && a.status !== 'Hilang');
export const asetTetap = (arr: Aset[]) => asetAktif(arr).filter((a) => a.jenis !== 'inventaris');
export const totalPerolehan = (arr: Aset[]) => asetTetap(arr).reduce((s, a) => s + (a.harga_perolehan || 0), 0);
export const totalAkumulasi = (arr: Aset[], ym?: string) => asetTetap(arr).reduce((s, a) => s + akumulasi(a, ym), 0);
export const totalNilaiBuku = (arr: Aset[], ym?: string) => asetTetap(arr).reduce((s, a) => s + nilaiBuku(a, ym), 0);

/**
 * Beban penyusutan dalam rentang bulan (inklusif) = akumulasi di akhir − akumulasi sebelum awal.
 * Aset yang dibeli di tengah rentang hanya disusutkan sejak bulan perolehannya.
 */
export const susutAntara = (arr: Aset[], dariYM: string, sampaiYM: string) =>
  Math.max(0, totalAkumulasi(arr, sampaiYM) - totalAkumulasi(arr, geserBulan(dariYM, -1)));

/** Beban penyusutan bulan ini (aset yang masih dalam masa manfaat). */
export const susutBulanIni = (arr: Aset[]) =>
  asetTetap(arr)
    .filter((a) => bulanJalan(a) > 0 && bulanJalan(a) < (KELOMPOK[a.kelompok]?.th || 4) * 12 + 1)
    .reduce((s, a) => s + susutBulanan(a), 0);

export const labelKelompokPendek = (k: string) => (KELOMPOK[k]?.label ?? '').split('—')[0].trim();
