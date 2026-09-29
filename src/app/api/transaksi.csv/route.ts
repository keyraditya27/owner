import { NextResponse } from 'next/server';
import { responsCSV } from '@/lib/csv';
import { ambilData } from '@/lib/data';
import { penggunaSaatIni } from '@/lib/pengguna';

/** Unduh semua transaksi sebagai CSV — unduhCSV() di prototipe. */
export async function GET() {
  if (!(await penggunaSaatIni())) return new NextResponse('Harus login', { status: 401 });
  const d = await ambilData();
  const rows: (string | number)[][] = [['tanggal', 'tipe', 'keterangan', 'kategori', 'klien', 'rekening', 'metode', 'nominal', 'ada_bukti']];
  d.transaksi
    .slice()
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .forEach((t) =>
      rows.push([
        t.tanggal,
        t.tipe,
        t.keterangan,
        t.kategori,
        d.klien.find((k) => k.id === t.klien_id)?.nama ?? '',
        d.rekening.find((r) => r.id === t.rekening_id)?.nama ?? '',
        t.metode,
        t.nominal,
        t.bukti_url ? 'ya' : 'tidak',
      ]),
    );
  return responsCSV(rows, 'transaksi');
}
