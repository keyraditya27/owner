'use server';

import { redirect } from 'next/navigation';
import { klienAdmin } from '@/lib/supabase/admin';
import { klienServer } from '@/lib/supabase/server';
import { catatAudit } from '@/lib/audit';
import { sudahAdaPengguna } from '@/lib/setup';

export type HasilMulai = { galat?: string };

/**
 * Membuat akun PEMILIK pertama. Hanya berjalan kalau tabel `pengguna` masih
 * kosong — setelah itu anggota tim ditambahkan pemilik lewat halaman Tim.
 */
export async function buatPemilik(_: HasilMulai, form: FormData): Promise<HasilMulai> {
  const nama = String(form.get('nama') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  if (!nama) return { galat: 'Nama wajib diisi.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { galat: 'Format email tidak valid.' };
  if (password.length < 10) return { galat: 'Password minimal 10 karakter.' };

  if (await sudahAdaPengguna()) return { galat: 'Akun pemilik sudah dibuat. Silakan masuk.' };

  const admin = klienAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama },
  });
  if (error || !data.user) return { galat: 'Gagal membuat akun: ' + (error?.message ?? 'tanpa keterangan') };

  const baris = { id: data.user.id, nama, peran: 'pemilik' as const };
  const { error: e2 } = await admin.from('pengguna').insert(baris);
  if (e2) {
    // Jangan tinggalkan akun Auth yatim tanpa profil.
    await admin.auth.admin.deleteUser(data.user.id);
    return { galat: 'Gagal menyimpan profil pemilik: ' + e2.message };
  }
  await catatAudit(admin, {
    penggunaId: data.user.id,
    tabel: 'pengguna',
    recordId: data.user.id,
    aksi: 'insert',
    nilaiBaru: { ...baris, email },
  });

  const supabase = await klienServer();
  await supabase.auth.signInWithPassword({ email, password });
  redirect('/ringkasan');
}
