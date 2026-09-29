import { NextResponse, type NextRequest } from 'next/server';
import { buatBackup } from '@/lib/backup';
import { cronSah } from '@/lib/cron';

export const maxDuration = 60;

/**
 * Backup mingguan — dipanggil Cron Vercel (lihat vercel.json).
 * Vercel mengirim header "Authorization: Bearer <CRON_SECRET>" otomatis.
 */
export async function GET(req: NextRequest) {
  if (!cronSah(req)) return NextResponse.json({ galat: 'Tidak diizinkan' }, { status: 401 });
  try {
    const h = await buatBackup('cron');
    return NextResponse.json({ ok: true, ...h });
  } catch (e) {
    return NextResponse.json({ galat: e instanceof Error ? e.message : 'gagal' }, { status: 500 });
  }
}
