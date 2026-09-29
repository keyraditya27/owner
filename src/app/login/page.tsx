import { redirect } from 'next/navigation';
import Link from 'next/link';
import LayarTengah from '@/components/LayarTengah';
import { penggunaSaatIni } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';
import { keluar } from './actions';
import FormLogin from './FormLogin';

export const metadata = { title: 'Masuk' };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ lanjut?: string }>;
}) {
  const { lanjut } = await searchParams;
  if (await penggunaSaatIni()) redirect('/ringkasan');

  // Sudah login di Supabase Auth tapi tidak terdaftar / dinonaktifkan di tabel pengguna.
  const supabase = await klienServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <LayarTengah judul="Akun belum aktif" sub={user.email}>
        <div className="ins ins-warn">
          <h4>Belum terdaftar di tim</h4>
          <p>Akun ini bisa login, tapi belum ditambahkan pemilik ke daftar tim atau sudah dinonaktifkan. Minta Key menambahkannya lewat halaman Tim.</p>
        </div>
        <form action={keluar}>
          <button className="btn-ghost w-full">Keluar dan pakai akun lain</button>
        </form>
      </LayarTengah>
    );
  }

  return (
    <LayarTengah judul="Masuk" sub="Keuangan internal PT Arah Ruang Langit">
      <FormLogin lanjut={lanjut ?? '/ringkasan'} />
      <p className="text-center text-xs text-muted">
        Belum punya akun? Minta pemilik menambahkan kamu ke tim.
        <br />
        Pertama kali memasang aplikasi? <Link href="/mulai">Buat akun pemilik</Link>
      </p>
    </LayarTengah>
  );
}
