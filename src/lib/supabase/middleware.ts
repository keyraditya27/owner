import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseSiap } from '@/lib/env';

/** Rute yang boleh dibuka tanpa login. */
// /api/cron & /api/kalender dijaga token rahasia di route-nya sendiri, bukan sesi login
// (Vercel Cron dan Google Calendar tidak bisa login).
const RUTE_TERBUKA = ['/login', '/mulai', '/offline', '/belum-siap', '/api/cron', '/api/kalender'];

export async function segarkanSesi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const terbuka = RUTE_TERBUKA.some((r) => pathname === r || pathname.startsWith(r + '/'));

  if (!supabaseSiap()) {
    if (terbuka) return NextResponse.next();
    return NextResponse.redirect(new URL('/belum-siap', request.url));
  }

  let respons = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (daftar) => {
        daftar.forEach(({ name, value }) => request.cookies.set(name, value));
        respons = NextResponse.next({ request });
        daftar.forEach(({ name, value, options }) => respons.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() memverifikasi tanda tangan token (sekaligus menyegarkan sesi yang kedaluwarsa).
  // Proyek Supabase dengan kunci tanda tangan asimetris memeriksanya di sini tanpa bolak-balik
  // ke server Auth; kunci simetris lama otomatis jatuh ke getUser(). Jangan diganti getSession().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  if (!user && !terbuka) {
    // API dipanggil lewat fetch — jawab 401, jangan dialihkan ke halaman login.
    if (pathname.startsWith('/api/')) return NextResponse.json({ galat: 'Sesi habis, silakan masuk lagi' }, { status: 401 });
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('lanjut', pathname);
    return NextResponse.redirect(url);
  }
  // Pengguna yang sudah login tapi membuka /login ditangani halaman login sendiri,
  // karena bisa jadi akunnya belum terdaftar di tabel `pengguna`.
  return respons;
}
