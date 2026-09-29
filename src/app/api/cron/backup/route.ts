import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { buatBackup } from '@/lib/backup';

export const maxDuration = 60;

/**
 * Backup mingguan — dipanggil Cron Vercel (lihat vercel.json).
 * Vercel mengirim header "Authorization: Bearer <CRON_SECRET>" otomatis.
 */
export async function GET(req: NextRequest) {
  const rahasia = process.env.CRON_SECRET;
  const kiriman = req.headers.get('authorization') ?? '';
  const harapan = `Bearer ${rahasia}`;
  const cocok =
    !!rahasia && kiriman.length === harapan.length && timingSafeEqual(Buffer.from(kiriman), Buffer.from(harapan));
  if (!cocok) return NextResponse.json({ galat: 'Tidak diizinkan' }, { status: 401 });
  try {
    const h = await buatBackup('cron');
    return NextResponse.json({ ok: true, ...h });
  } catch (e) {
    return NextResponse.json({ galat: e instanceof Error ? e.message : 'gagal' }, { status: 500 });
  }
}
