/**
 * Perhitungan laporan — lapNeraca, lapLabaRugi, lapArusKas, lapKategori,
 * pajakTabTahunan, dan pphBadan() dari prototipe v7. Dipakai halaman Laporan,
 * halaman Pajak, dan unduhan CSV supaya angkanya selalu sama.
 */
import { BUKAN_BEBAN, KATEGORI_ASET_TETAP, KATEGORI_TITIPAN, KOREKSI_FISKAL } from '@/lib/konstanta';
import { asetTetap, susutBulanan, totalAkumulasi, totalNilaiBuku, totalPerolehan } from '@/lib/aset';
import {
  danaTitipan,
  pajakBelumSetor,
  saldoRekening,
  tagihanTerbuka,
  totalKas,
  totalPiutang,
  totalUtang,
  totalUtangPajak,
  utangTerbuka,
  type DataKeuangan,
} from '@/lib/hitung';
import { dalamPeriode, ymPatokan, type Periode } from '@/lib/periode';

/* ---------------------------------------------------------------- NERACA */
export function neraca(d: DataKeuangan, p: Periode) {
  const ym = ymPatokan(p);
  const kas = totalKas(d);
  const piutang = totalPiutang(d);
  const nb = totalNilaiBuku(d.aset, ym);
  const titipan = Math.max(0, danaTitipan(d));
  const utangV = totalUtang(d);
  const utangP = totalUtangPajak(d);
  const totalAset = kas + piutang + nb;
  const totalLiab = titipan + utangV + utangP;
  const modal = d.perusahaan?.modal_disetor || 0;
  const tanpaRekening = d.transaksi.filter((t) => !t.rekening_id);
  return {
    rekening: d.rekening.map((r) => ({ nama: r.nama, saldo: saldoRekening(d, r.id) })),
    tanpaRekening: tanpaRekening.length
      ? tanpaRekening.reduce((s, t) => s + (t.tipe === 'masuk' ? t.nominal : -t.nominal), 0)
      : null,
    piutang,
    jumlahTagihan: tagihanTerbuka(d).length,
    perolehan: totalPerolehan(d.aset),
    akumulasi: totalAkumulasi(d.aset, ym),
    nilaiBuku: nb,
    totalAset,
    titipan,
    utangVendor: utangV,
    jumlahUtang: utangTerbuka(d).length,
    utangPajak: utangP,
    jumlahPajak: pajakBelumSetor(d).length,
    modal,
    // Penyajian ringkas: laba ditahan = selisih penyeimbang, bukan hasil jurnal berpasangan (PRD §2).
    labaDitahan: totalAset - totalLiab - modal,
  };
}

/* ---------------------------------------------------------------- LABA RUGI */
export function labaRugi(d: DataKeuangan, p: Periode) {
  const arr = d.transaksi.filter((t) => dalamPeriode(p, t.tanggal));
  const pend: Record<string, number> = {};
  const beb: Record<string, number> = {};
  let prive = 0;
  let belanjaAset = 0;
  arr.forEach((t) => {
    if (t.tipe === 'masuk') {
      if (t.kategori === KATEGORI_TITIPAN) return; // dana titipan = kewajiban, bukan pendapatan
      pend[t.kategori] = (pend[t.kategori] || 0) + t.nominal;
    } else if (BUKAN_BEBAN.includes(t.kategori)) prive += t.nominal; // pengurang ekuitas
    else if (t.kategori === KATEGORI_ASET_TETAP) belanjaAset += t.nominal; // masuk lewat penyusutan
    else beb[t.kategori] = (beb[t.kategori] || 0) + t.nominal;
  });
  const bulan =
    p.mode === 'tahun' ? 12 : p.mode === 'bulan' ? 1 : Math.max(1, new Set(d.transaksi.map((t) => t.tanggal.slice(0, 7))).size);
  const susut = asetTetap(d.aset).reduce((s, a) => s + susutBulanan(a), 0) * bulan;
  const totalP = Object.values(pend).reduce((a, b) => a + b, 0);
  const totalB = Object.values(beb).reduce((a, b) => a + b, 0) + susut;
  const urut = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return { pendapatan: urut(pend), beban: urut(beb), susut, bulan, totalP, totalB, laba: totalP - totalB, prive, belanjaAset };
}

/* ---------------------------------------------------------------- ARUS KAS */
export function arusKas(d: DataKeuangan, p: Periode) {
  const byM: Record<string, { masuk: number; keluar: number }> = {};
  d.transaksi.forEach((t) => {
    const m = t.tanggal.slice(0, 7);
    if (!m) return;
    if (p.mode === 'tahun' && !m.startsWith(p.tahun)) return;
    byM[m] = byM[m] || { masuk: 0, keluar: 0 };
    byM[m][t.tipe] += t.nominal;
  });
  const bulan = Object.keys(byM).sort().reverse();
  return {
    baris: bulan.map((m) => ({ bulan: m, ...byM[m], selisih: byM[m].masuk - byM[m].keluar })),
    masuk: bulan.reduce((s, m) => s + byM[m].masuk, 0),
    keluar: bulan.reduce((s, m) => s + byM[m].keluar, 0),
  };
}

/* ---------------------------------------------------------------- PER KATEGORI */
export function perKategori(d: DataKeuangan, p: Periode) {
  const kat: Record<string, { masuk: number; keluar: number; n: number }> = {};
  d.transaksi
    .filter((t) => dalamPeriode(p, t.tanggal))
    .forEach((t) => {
      kat[t.kategori] = kat[t.kategori] || { masuk: 0, keluar: 0, n: 0 };
      kat[t.kategori][t.tipe] += t.nominal;
      kat[t.kategori].n++;
    });
  const baris = Object.entries(kat).sort((a, b) => b[1].masuk + b[1].keluar - (a[1].masuk + a[1].keluar));
  return { baris, totalKeluar: baris.reduce((s, r) => s + r[1].keluar, 0) || 1 };
}

/* ---------------------------------------------------------------- PPh BADAN */
/** PPh badan 22% dengan fasilitas Pasal 31E (50% atas bagian laba s.d. omzet Rp4,8 M). */
export function pphBadan(labaSetahun: number, omzetSetahun: number) {
  if (labaSetahun <= 0) return 0;
  if (omzetSetahun <= 4.8e9) return Math.round(labaSetahun * 0.22 * 0.5);
  if (omzetSetahun < 50e9) {
    const bagianFasilitas = labaSetahun * (4.8e9 / omzetSetahun);
    return Math.round(bagianFasilitas * 0.22 * 0.5 + (labaSetahun - bagianFasilitas) * 0.22);
  }
  return Math.round(labaSetahun * 0.22);
}

export function estimasiPPhBadan(d: DataKeuangan, tahun: string) {
  const trx = d.transaksi.filter((t) => t.tanggal.startsWith(tahun));
  const omzet = trx.filter((t) => t.tipe === 'masuk' && t.kategori !== KATEGORI_TITIPAN).reduce((s, t) => s + t.nominal, 0);
  const bebanSemua = trx.filter((t) => t.tipe === 'keluar').reduce((s, t) => s + t.nominal, 0);
  const prive = trx.filter((t) => t.tipe === 'keluar' && BUKAN_BEBAN.includes(t.kategori)).reduce((s, t) => s + t.nominal, 0);
  const koreksi = trx
    .filter((t) => t.tipe === 'keluar' && KOREKSI_FISKAL.includes(t.kategori) && !BUKAN_BEBAN.includes(t.kategori))
    .reduce((s, t) => s + t.nominal, 0);
  const belanjaAset = trx.filter((t) => t.tipe === 'keluar' && t.kategori === KATEGORI_ASET_TETAP).reduce((s, t) => s + t.nominal, 0);
  const beban = bebanSemua - prive - belanjaAset;
  const susut = asetTetap(d.aset).reduce((s, a) => s + susutBulanan(a) * 12, 0);
  const laba = omzet - beban - susut;
  const labaFiskal = laba + koreksi;
  const pph = pphBadan(labaFiskal, omzet);
  // Tambahan dari CLAUDE.md: PPh 23 yang dipotong klien adalah kredit pajak, mengurangi PPh badan terutang.
  const tagihanTahun = d.tagihan.filter((i) => (i.tgl_invoice || '').startsWith(tahun));
  const kreditPph23 = tagihanTahun.reduce((s, i) => s + (i.pph23_dipotong || 0), 0);
  const tanpaBuktiPotong = tagihanTahun.filter((i) => i.pph23_dipotong > 0 && !i.bukti_potong_url).length;
  return {
    omzet,
    beban,
    susut,
    laba,
    koreksi,
    labaFiskal,
    pph,
    prive,
    kreditPph23,
    tanpaBuktiPotong,
    kurangBayar: Math.max(0, pph - kreditPph23),
  };
}
