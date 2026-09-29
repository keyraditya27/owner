import type { NextRequest } from 'next/server';
import { segarkanSesi } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return segarkanSesi(request);
}

export const config = {
  // Lewati file statis, ikon PWA, manifest, dan service worker.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|ikon/|logo/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
