/**
 * Logika perhitungan — disalin dari prototipe v7 (bagian "derived",
 * "helper rekening", "helper vendor", "helper pajak"). Jangan menciptakan
 * cara hitung baru di sini; kalau berubah, ubah di prototipe dulu.
 *
 * Semua fungsi murni: menerima data, mengembalikan angka. Bisa dipakai di
 * server maupun browser.
 */
import { KATEGORI_TITIPAN, JENIS_PAJAK } from '@/lib/konstanta';
import { hariSelisih, tanggalBulanBerikut } from '@/lib/format';
import type { Aset, Klien, Pajak, Perusahaan, Rekening, Tagihan, Transaksi, UtangVendor, Vendor } from '@/lib/tipe-db';

export type DataKeuangan = {
  transaksi: Transaksi[];
  klien: Klien[];
  tagihan: Tagihan[];
  rekening: Rekening[];
  vendor: Vendor[];
  utang: UtangVendor[];
  pajak: Pajak[];
  aset: Aset[];
  perusahaan: Perusahaan | null;
  namaPerusahaan: string;
};

const arus = (t: Pick<Transaksi, 'tipe' | 'nominal'>) => (t.tipe === 'masuk' ? t.nominal : -t.nominal);

export const totalTipe = (arr: Transaksi[], tipe: 'masuk' | 'keluar') =>
  arr.filter((x) => x.tipe === tipe).reduce((s, x) => s + x.nominal, 0);

/* ---------------- rekening ---------------- */
export function saldoRekening(d: DataKeuangan, id: string) {
  const r = d.rekening.find((x) => x.id === id);
  if (!r) return 0;
  return (r.saldo_awal || 0) + d.transaksi.filter((t) => t.rekening_id === id).reduce((s, t) => s + arus(t), 0);
}

/** Total kas = saldo semua rekening + transaksi yang belum ditandai rekeningnya. */
export const totalKas = (d: DataKeuangan) =>
  d.rekening.reduce((s, r) => s + saldoRekening(d, r.id), 0) +
  d.transaksi.filter((t) => !t.rekening_id).reduce((s, t) => s + arus(t), 0);

/* ---------------- tagihan klien ---------------- */
export type TagihanTerbuka = Tagihan & { sisa: number; klien: string; pic: string | null; wa: string | null; paket: string | null };

/**
 * Sisa tagihan. PPh 23 yang dipotong klien ikut mengurangi sisa: invoice Rp10 jt,
 * masuk Rp9,8 jt, potongan Rp200 rb = kredit pajak, bukan piutang (CLAUDE.md).
 */
export const sisaTagihan = (i: Pick<Tagihan, 'nominal' | 'dibayar'> & { pph23_dipotong?: number }) =>
  i.nominal - (i.dibayar || 0) - (i.pph23_dipotong || 0);

export function tagihanTerbuka(d: DataKeuangan): TagihanTerbuka[] {
  const o: TagihanTerbuka[] = [];
  d.tagihan.forEach((i) => {
    const s = sisaTagihan(i);
    if (s <= 0) return;
    const k = d.klien.find((x) => x.id === i.klien_id);
    o.push({ ...i, sisa: s, klien: k?.nama ?? '(terhapus)', pic: k?.pic ?? null, wa: k?.wa ?? null, paket: k?.paket ?? null });
  });
  return o.sort((a, b) => (a.jatuh_tempo || '').localeCompare(b.jatuh_tempo || ''));
}

export const totalPiutang = (d: DataKeuangan) => tagihanTerbuka(d).reduce((s, i) => s + i.sisa, 0);
export const telat = (d: DataKeuangan) => tagihanTerbuka(d).filter((i) => hariSelisih(i.jatuh_tempo) < 0);

export type WarnaPill = 'hijau' | 'merah' | 'amber' | 'biru' | 'abu' | 'navy';

export function statusInv(i: Pick<Tagihan, 'nominal' | 'dibayar' | 'jatuh_tempo' | 'pph23_dipotong'>): { c: WarnaPill; t: string } {
  const s = sisaTagihan(i);
  if (s <= 0) return { c: 'hijau', t: 'Lunas' };
  const d = hariSelisih(i.jatuh_tempo);
  if (d < 0) return { c: 'merah', t: 'Telat ' + Math.abs(d) + ' hari' };
  if ((i.dibayar || 0) > 0) return { c: 'amber', t: 'Dibayar sebagian' };
  if (d <= 3) return { c: 'amber', t: d === 0 ? 'Jatuh tempo hari ini' : 'H-' + d };
  return { c: 'biru', t: 'Belum jatuh tempo' };
}

/* ---------------- vendor ---------------- */
export type UtangTerbuka = UtangVendor & { sisa: number; vendor: string; jenis: string };

export function utangTerbuka(d: DataKeuangan): UtangTerbuka[] {
  const o: UtangTerbuka[] = [];
  d.utang.forEach((u) => {
    const s = u.nominal - (u.dibayar || 0);
    if (s <= 0) return;
    const v = d.vendor.find((x) => x.id === u.vendor_id);
    o.push({ ...u, sisa: s, vendor: v?.nama ?? '(terhapus)', jenis: v?.jenis ?? '' });
  });
  return o.sort((a, b) => (a.jatuh_tempo || '').localeCompare(b.jatuh_tempo || ''));
}
export const totalUtang = (d: DataKeuangan) => utangTerbuka(d).reduce((s, u) => s + u.sisa, 0);

/* ---------------- pajak ---------------- */
/** Batas setor: tanggal 15 bulan berikutnya (PMK 81/2024). periode = "YYYY-MM". */
export const deadlineSetor = (periode: string) => tanggalBulanBerikut(periode, JENIS_PAJAK['PPh 23'].setor);

export function deadlineLapor(periode: string, jenis: string) {
  const L = JENIS_PAJAK[jenis]?.lapor;
  if (!L) return null;
  return tanggalBulanBerikut(periode, L === 'akhir' ? 0 : L);
}

export const pajakBelumSetor = (d: DataKeuangan) => d.pajak.filter((p) => !p.tgl_setor);
export const totalUtangPajak = (d: DataKeuangan) => pajakBelumSetor(d).reduce((s, p) => s + (p.nominal || 0), 0);

/* ---------------- dana titipan ---------------- */
/** Budget iklan klien yang belum dibelanjakan — kewajiban, bukan uang ARL. */
export const danaTitipan = (d: DataKeuangan) =>
  d.transaksi.filter((t) => t.kategori === KATEGORI_TITIPAN && t.tipe === 'masuk').reduce((s, t) => s + t.nominal, 0) -
  d.transaksi
    .filter((t) => t.tipe === 'keluar' && t.kategori === 'Ads spend' && t.klien_id)
    .reduce((s, t) => s + t.nominal, 0);

/* ---------------- ringkasan per kategori ---------------- */
export function pengeluaranPerKategori(arr: Transaksi[]) {
  const perKat: Record<string, number> = {};
  arr.filter((x) => x.tipe === 'keluar').forEach((x) => (perKat[x.kategori] = (perKat[x.kategori] || 0) + x.nominal));
  return Object.entries(perKat).sort((x, y) => y[1] - x[1]);
}

/** Pendapatan per klien — tanpa dana titipan iklan (blokKontribusi di prototipe). */
export function kontribusiKlien(arr: Transaksi[]) {
  const per: Record<string, number> = {};
  arr
    .filter((t) => t.tipe === 'masuk' && t.klien_id && t.kategori !== KATEGORI_TITIPAN)
    .forEach((t) => (per[t.klien_id!] = (per[t.klien_id!] || 0) + t.nominal));
  return Object.entries(per).sort((a, b) => b[1] - a[1]);
}

export const urutTerbaru = (arr: Transaksi[]) =>
  arr.slice().sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.dibuat_pada || '').localeCompare(a.dibuat_pada || ''));
