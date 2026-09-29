import { NextResponse } from 'next/server';
import { ambilData } from '@/lib/data';
import { hariIni } from '@/lib/format';
import { penggunaSaatIni } from '@/lib/pengguna';

/** Unduh semua transaksi sebagai CSV — unduhCSV() di prototipe. BOM supaya Excel membaca UTF-8. */
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
  // Cegah formula injection di Excel: sel teks yang diawali = + - @ diberi tanda kutip tunggal.
  const sel = (c: string | number) => {
    let s = String(c ?? '');
    if (typeof c === 'string' && /^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = '﻿' + rows.map((r) => r.map(sel).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="arl-transaksi-${hariIni()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
