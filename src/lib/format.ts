/**
 * Format angka & tanggal — padanan rp, rpS, tgl, bulanLabel, hariSelisih di prototipe v7.
 *
 * Beda sengaja dengan prototipe: "hari ini" dihitung menurut WIB (Asia/Jakarta),
 * dan tanggal diolah sebagai tanggal murni (UTC) supaya tidak bergeser satu
 * hari tergantung zona waktu server/HP. Prototipe memakai toISOString() yang
 * di WIB bisa mundur ke bulan/tanggal sebelumnya.
 */

const ZONA = 'Asia/Jakarta';

/** YYYY-MM-DD hari ini menurut WIB. */
export const hariIni = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );

export const bulanIni = () => hariIni().slice(0, 7);

const keUTC = (iso: string) => new Date(iso + 'T00:00:00Z');

export const rp = (n: number | null | undefined) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

/** Rupiah ringkas: Rp 5,5 jt · Rp 750 rb */
export function rpS(n: number | null | undefined) {
  const v = Math.round(n || 0);
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  const angka = (x: number, d: number) => (x % d ? (x / d).toFixed(1) : String(x / d)).replace('.', ',');
  if (a >= 1e9) return `${s}Rp ${angka(a, 1e9)} M`;
  if (a >= 1e6) return `${s}Rp ${angka(a, 1e6)} jt`;
  if (a >= 1e3) return `${s}Rp ${Math.round(a / 1e3)} rb`;
  return `${s}Rp ${a}`;
}

export const tgl = (iso: string | null | undefined) =>
  iso
    ? keUTC(iso.slice(0, 10)).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

export const bulanLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** Selisih hari dari hari ini ke tanggal iso. Negatif = sudah lewat. */
export const hariSelisih = (iso: string) =>
  Math.round((keUTC(iso.slice(0, 10)).getTime() - keUTC(hariIni()).getTime()) / 864e5);

/** Geser YYYY-MM sebanyak n bulan. */
export function geserBulan(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Tambah n hari ke tanggal iso. */
export const tambahHari = (iso: string, n: number) =>
  new Date(keUTC(iso).getTime() + n * 864e5).toISOString().slice(0, 10);

/** Tanggal ke-`hari` di bulan berikutnya dari periode YYYY-MM. hari=0 → akhir bulan berikutnya. */
export function tanggalBulanBerikut(ym: string, hari: number) {
  const [y, m] = ym.split('-').map(Number);
  if (hari === 0) return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return new Date(Date.UTC(y, m, hari)).toISOString().slice(0, 10);
}

export const pct = (a: number, b: number): number | null => (!b ? null : ((a - b) / b) * 100);

export const tanggalValid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && keUTC(v).toISOString().startsWith(v);
