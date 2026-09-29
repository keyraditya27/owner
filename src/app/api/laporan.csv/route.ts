import { NextResponse, type NextRequest } from 'next/server';
import { responsCSV } from '@/lib/csv';
import { ambilData, ambilPeriode } from '@/lib/data';
import { bulanLabel } from '@/lib/format';
import { arusKas, labaRugi, neraca, perKategori } from '@/lib/laporan';
import { penggunaSaatIni } from '@/lib/pengguna';
import { periodeLabel } from '@/lib/periode';

/** CSV laporan yang sedang dibuka (?jenis=neraca|labarugi|aruskas|kategori), mengikuti bar periode. */
export async function GET(req: NextRequest) {
  if (!(await penggunaSaatIni())) return new NextResponse('Harus login', { status: 401 });
  const jenis = req.nextUrl.searchParams.get('jenis') ?? 'neraca';
  const [d, p] = await Promise.all([ambilData(), ambilPeriode()]);
  const judul = [[`${d.namaPerusahaan} — ${periodeLabel(p)}`], []];

  if (jenis === 'labarugi') {
    const r = labaRugi(d, p);
    return responsCSV(
      [
        ...judul,
        ['Pos', 'Nilai'],
        ['PENDAPATAN', ''],
        ...r.pendapatan.map(([k, v]) => [k, v]),
        ['Total pendapatan', r.totalP],
        ['BEBAN', ''],
        ...r.beban.map(([k, v]) => [k, -v]),
        [`Penyusutan aset tetap (${r.bulan} bulan)`, -r.susut],
        ['Total beban', -r.totalB],
        ['LABA / RUGI', r.laba],
        [],
        ['Di luar laba rugi: prive founder', -r.prive],
        ['Sisa laba setelah prive', r.laba - r.prive],
      ],
      'laba-rugi',
    );
  }
  if (jenis === 'aruskas') {
    const a = arusKas(d, p);
    return responsCSV(
      [...judul, ['Bulan', 'Masuk', 'Keluar', 'Selisih'], ...a.baris.map((b) => [bulanLabel(b.bulan), b.masuk, b.keluar, b.selisih]), ['Total', a.masuk, a.keluar, a.masuk - a.keluar]],
      'arus-kas',
    );
  }
  if (jenis === 'kategori') {
    const k = perKategori(d, p);
    return responsCSV([...judul, ['Kategori', 'Transaksi', 'Masuk', 'Keluar'], ...k.baris.map(([n, v]) => [n, v.n, v.masuk, v.keluar])], 'per-kategori');
  }
  const n = neraca(d, p);
  return responsCSV(
    [
      ...judul,
      ['Pos', 'Nilai'],
      ['ASET LANCAR', ''],
      ...n.rekening.map((r) => [r.nama, r.saldo]),
      ...(n.tanpaRekening !== null ? [['Belum ditandai rekening', n.tanpaRekening]] : []),
      ['Piutang usaha', n.piutang],
      ['ASET TETAP', ''],
      ['Harga perolehan', n.perolehan],
      ['Akumulasi penyusutan', -n.akumulasi],
      ['Nilai buku', n.nilaiBuku],
      ['TOTAL ASET', n.totalAset],
      [],
      ['KEWAJIBAN', ''],
      ['Dana titipan klien', n.titipan],
      ['Utang usaha', n.utangVendor],
      ['Utang pajak', n.utangPajak],
      ['EKUITAS', ''],
      ['Modal disetor', n.modal],
      ['Laba ditahan & berjalan', n.labaDitahan],
      ['TOTAL KEWAJIBAN & EKUITAS', n.totalAset],
    ],
    'neraca',
  );
}
