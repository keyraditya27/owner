/**
 * Variabel lingkungan yang boleh dibaca browser (berawalan NEXT_PUBLIC_).
 * Kunci rahasia (service role, Gemini, Google) sengaja TIDAK ada di sini —
 * lihat src/lib/supabase/admin.ts yang hanya jalan di server.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseSiap = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
