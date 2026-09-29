'use server';

import { redirect } from 'next/navigation';
import { klienServer } from '@/lib/supabase/server';

export type HasilLogin = { galat?: string };

/** Hanya boleh lanjut ke rute internal — cegah open redirect lewat ?lanjut=. */
const tujuanAman = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/ringkasan';
};

export async function masuk(_: HasilLogin, form: FormData): Promise<HasilLogin> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { galat: 'Email dan password wajib diisi.' };

  const supabase = await klienServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      galat:
        error.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : 'Gagal masuk: ' + error.message,
    };
  }
  redirect(tujuanAman(form.get('lanjut')));
}

export async function keluar() {
  const supabase = await klienServer();
  await supabase.auth.signOut();
  redirect('/login');
}
