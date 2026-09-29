import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseSiap } from '@/lib/env';

/** Rute yang boleh dibuka tanpa login. */
const RUTE_TERBUKA = ['/login', '/mulai', '/offline', '/belum-siap'];

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

  // getUser() memverifikasi token ke server Supabase — jangan diganti getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !terbuka) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('lanjut', pathname);
    return NextResponse.redirect(url);
  }
  // Pengguna yang sudah login tapi membuka /login ditangani halaman login sendiri,
  // karena bisa jadi akunnya belum terdaftar di tabel `pengguna`.
  return respons;
}
