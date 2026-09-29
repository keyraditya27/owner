/**
 * Bar periode global (Per Bulan / Per Tahun / Semua) — logika dari bagian
 * "PERIODE GLOBAL" di prototipe v7. Disimpan di cookie `periode` supaya
 * dibaca server dan berlaku di semua halaman sekaligus.
 */
import { bulanIni, bulanLabel, geserBulan, hariIni } from '@/lib/format';

export type ModePeriode = 'bulan' | 'tahun' | 'semua';
export type Periode = { mode: ModePeriode; ym: string; tahun: string };

export const COOKIE_PERIODE = 'periode';

export const periodeBawaan = (): Periode => ({ mode: 'semua', ym: bulanIni(), tahun: hariIni().slice(0, 4) });

export function bacaPeriode(nilai: string | undefined): Periode {
  const dasar = periodeBawaan();
  if (!nilai) return dasar;
  try {
    const p = JSON.parse(decodeURIComponent(nilai));
    return {
      mode: ['bulan', 'tahun', 'semua'].includes(p.mode) ? p.mode : dasar.mode,
      ym: /^\d{4}-\d{2}$/.test(p.ym) ? p.ym : dasar.ym,
      tahun: /^\d{4}$/.test(p.tahun) ? p.tahun : dasar.tahun,
    };
  } catch {
    return dasar;
  }
}

export const periodeLabel = (p: Periode) =>
  p.mode === 'bulan' ? bulanLabel(p.ym) : p.mode === 'tahun' ? 'Tahun ' + p.tahun : 'Sepanjang pencatatan';

export const periodePrefix = (p: Periode) => (p.mode === 'bulan' ? p.ym : p.mode === 'tahun' ? p.tahun : '');

export const dalamPeriode = (p: Periode, iso: string | null | undefined) => (iso || '').startsWith(periodePrefix(p));

/** Periode pembanding: bulan/tahun sebelumnya. null untuk mode Semua. */
export function periodeSebelum(p: Periode): string | null {
  if (p.mode === 'bulan') return geserBulan(p.ym, -1);
  if (p.mode === 'tahun') return String(+p.tahun - 1);
  return null;
}

export function labelBanding(p: Periode) {
  const pre = periodeSebelum(p);
  return !pre ? '' : p.mode === 'bulan' ? bulanLabel(pre) : 'Tahun ' + pre;
}

/** Patokan bulan untuk nilai aset: akhir periode aktif. */
export const ymPatokan = (p: Periode) => (p.mode === 'bulan' ? p.ym : p.mode === 'tahun' ? p.tahun + '-12' : bulanIni());

/** Pilihan bulan di dropdown: bulan yang punya transaksi + bulan ini, terbaru dulu. */
export function opsiBulan(tanggal: string[]) {
  return [...new Set([...tanggal.map((t) => t.slice(0, 7)), bulanIni()])].filter(Boolean).sort().reverse();
}
