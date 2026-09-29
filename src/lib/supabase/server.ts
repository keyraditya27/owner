import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Klien untuk server component, server action, dan route handler.
 * Tetap memakai anon key + sesi login pengguna, jadi aturan RLS berlaku.
 */
export async function klienServer() {
  const toples = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => toples.getAll(),
      setAll: (daftar) => {
        try {
          daftar.forEach(({ name, value, options }) => toples.set(name, value, options));
        } catch {
          // Dipanggil dari server component (read-only). Sesi disegarkan di middleware.
        }
      },
    },
  });
}
