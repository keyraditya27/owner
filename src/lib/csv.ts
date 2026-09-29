import { NextResponse } from 'next/server';
import { hariIni } from '@/lib/format';

/**
 * CSV untuk Excel: BOM UTF-8, setiap sel dikutip. Sel teks yang diawali
 * = + - @ diberi tanda kutip tunggal supaya tidak dijalankan sebagai rumus
 * (formula injection) saat dibuka di Excel/Sheets.
 */
export function responsCSV(rows: (string | number | null | undefined)[][], nama: string) {
  const sel = (c: string | number | null | undefined) => {
    let s = String(c ?? '');
    if (typeof c === 'string' && /^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = '﻿' + rows.map((r) => r.map(sel).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="arl-${nama}-${hariIni()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
