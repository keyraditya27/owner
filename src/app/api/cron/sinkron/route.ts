import { NextResponse, type NextRequest } from 'next/server';
import { cronSah } from '@/lib/cron';
import { sinkron } from '@/lib/sheets/sinkron';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Sinkron penuh aplikasi ⇄ sheet. Dipanggil cron (tiap 5 menit di Vercel Pro,
 * atau layanan cron luar seperti cron-job.org di paket Hobby) dengan
 * header "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  if (!cronSah(req)) return NextResponse.json({ galat: 'Tidak diizinkan' }, { status: 401 });
  try {
    const h = await sinkron('cron');
    return NextResponse.json({ ok: h.jalan, ...h });
  } catch (e) {
    return NextResponse.json({ galat: e instanceof Error ? e.message : 'gagal' }, { status: 500 });
  }
}
