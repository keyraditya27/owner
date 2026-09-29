import { NextResponse } from 'next/server';
import { akumulasi, KELOMPOK, nilaiBuku, susutBulanan } from '@/lib/aset';
import { responsCSV } from '@/lib/csv';
import { ambilData } from '@/lib/data';
import { bulanIni } from '@/lib/format';
import { penggunaSaatIni } from '@/lib/pengguna';

/** Daftar aset & inventaris — unduhAsetCSV() di prototipe. Untuk stock opname dan konsultan pajak. */
export async function GET() {
  if (!(await penggunaSaatIni())) return new NextResponse('Harus login', { status: 401 });
  const d = await ambilData();
  const ym = bulanIni();
  const rows: (string | number | null)[][] = [
    ['kode', 'nama', 'jenis', 'kategori', 'kelompok', 'tgl_perolehan', 'harga_perolehan', 'residu', 'metode', 'susut_per_bulan', 'akumulasi', 'nilai_buku', 'qty', 'lokasi', 'penanggung_jawab', 'kondisi', 'status'],
  ];
  d.aset.forEach((a) =>
    rows.push([
      a.kode, a.nama, a.jenis, a.kategori, KELOMPOK[a.kelompok]?.label ?? '', a.tgl_perolehan, a.harga_perolehan, a.nilai_residu,
      a.metode, susutBulanan(a), akumulasi(a, ym), nilaiBuku(a, ym), a.qty, a.lokasi, a.penanggung_jawab, a.kondisi, a.status,
    ]),
  );
  return responsCSV(rows, 'aset');
}
