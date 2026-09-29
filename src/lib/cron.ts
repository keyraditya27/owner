import 'server-only';

import { timingSafeEqual } from 'node:crypto';

/** Cron Vercel mengirim "Authorization: Bearer <CRON_SECRET>". Dibandingkan waktu-konstan. */
export function cronSah(req: Request): boolean {
  const rahasia = process.env.CRON_SECRET;
  const kiriman = req.headers.get('authorization') ?? '';
  const harapan = `Bearer ${rahasia}`;
  return !!rahasia && kiriman.length === harapan.length && timingSafeEqual(Buffer.from(kiriman), Buffer.from(harapan));
}
