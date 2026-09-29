'use server';

import { revalidatePath } from 'next/cache';
import { catatAudit } from '@/lib/audit';
import { wajibPemilik } from '@/lib/pengguna';
import { klienAdmin } from '@/lib/supabase/admin';

export type HasilTambah = { galat?: string; sukses?: string };

const PERAN_BOLEH = ['admin', 'staf'] as const;

/**
 * Pemilik menambahkan anggota tim. Akun dibuat lewat service role di server —
 * kunci itu tidak pernah sampai ke browser. Peran "pemilik" sengaja tidak
 * bisa diberikan dari sini.
 */
export async function tambahAnggota(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const pemilik = await wajibPemilik();

  const nama = String(form.get('nama') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const peran = String(form.get('peran') ?? 'staf');

  if (!nama) return { galat: 'Nama wajib diisi.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { galat: 'Format email tidak valid.' };
  if (password.length < 10) return { galat: 'Password sementara minimal 10 karakter.' };
  if (!PERAN_BOLEH.includes(peran as (typeof PERAN_BOLEH)[number])) return { galat: 'Peran tidak dikenal.' };

  const admin = klienAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama },
  });
  if (error || !data.user) {
    const sudahAda = /already|registered|exists/i.test(error?.message ?? '');
    return { galat: sudahAda ? 'Email ini sudah punya akun.' : 'Gagal membuat akun: ' + (error?.message ?? '') };
  }

  const baris = { id: data.user.id, nama, peran };
  const { error: e2 } = await admin.from('pengguna').insert(baris);
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { galat: 'Gagal menyimpan profil: ' + e2.message };
  }
  await catatAudit(admin, {
    penggunaId: pemilik.id,
    tabel: 'pengguna',
    recordId: data.user.id,
    aksi: 'insert',
    nilaiBaru: { ...baris, email },
  });

  revalidatePath('/tim');
  return { sukses: `${nama} ditambahkan sebagai ${peran}. Kirim email & password sementara ke yang bersangkutan.` };
}

/**
 * Ubah peran atau nonaktifkan anggota. Pemilik tidak bisa mengubah dirinya
 * sendiri (supaya tidak terkunci keluar), dan peran "pemilik" tidak bisa diberikan.
 */
export async function ubahAnggota(id: string, ubah: { peran?: string; aktif?: boolean }): Promise<HasilTambah> {
  const pemilik = await wajibPemilik();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { galat: 'Anggota tidak dikenal.' };
  if (id === pemilik.id) return { galat: 'Akunmu sendiri tidak bisa diubah dari sini.' };

  const d: { peran?: string; aktif?: boolean } = {};
  if (ubah.peran !== undefined) {
    if (!PERAN_BOLEH.includes(ubah.peran as (typeof PERAN_BOLEH)[number])) return { galat: 'Peran tidak dikenal.' };
    d.peran = ubah.peran;
  }
  if (ubah.aktif !== undefined) d.aktif = !!ubah.aktif;
  if (!Object.keys(d).length) return { galat: 'Tidak ada yang diubah.' };

  const admin = klienAdmin();
  const { data: lama } = await admin.from('pengguna').select('*').eq('id', id).maybeSingle();
  if (!lama) return { galat: 'Anggota tidak ditemukan.' };
  if (lama.peran === 'pemilik') return { galat: 'Pemilik lain tidak bisa diubah dari sini.' };
  const { error } = await admin.from('pengguna').update(d).eq('id', id);
  if (error) return { galat: 'Gagal menyimpan: ' + error.message };
  await catatAudit(admin, { penggunaId: pemilik.id, tabel: 'pengguna', recordId: id, aksi: 'update', nilaiLama: lama, nilaiBaru: { ...lama, ...d } });

  revalidatePath('/tim');
  return { sukses: d.aktif === false ? `${lama.nama} dinonaktifkan — tidak bisa login lagi.` : `${lama.nama} diperbarui.` };
}
