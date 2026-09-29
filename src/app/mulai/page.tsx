import Link from 'next/link';
import LayarTengah from '@/components/LayarTengah';
import { supabaseSiap } from '@/lib/env';
import { sudahAdaPengguna } from '@/lib/setup';
import FormMulai from './FormMulai';

export const metadata = { title: 'Mulai' };
export const dynamic = 'force-dynamic';

export default async function Mulai() {
  if (!supabaseSiap() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <LayarTengah judul="Belum tersambung" sub="Kunci Supabase belum diisi.">
        <div className="ins ins-warn">
          <p>
            Isi <b>NEXT_PUBLIC_SUPABASE_URL</b>, <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>, dan{' '}
            <b>SUPABASE_SERVICE_ROLE_KEY</b> di <code>.env.local</code> (atau di Vercel), lalu buka ulang halaman ini.
          </p>
        </div>
      </LayarTengah>
    );
  }

  let terkunci = false;
  let galat = '';
  try {
    terkunci = await sudahAdaPengguna();
  } catch (e) {
    galat = e instanceof Error ? e.message : String(e);
  }

  if (galat) {
    return (
      <LayarTengah judul="Database belum siap">
        <div className="ins ins-bad">
          <p>{galat}</p>
        </div>
      </LayarTengah>
    );
  }

  if (terkunci) {
    return (
      <LayarTengah judul="Sudah diatur" sub="Akun pemilik sudah ada.">
        <p className="text-[13px] text-teks2">Anggota tim baru ditambahkan pemilik dari halaman Tim di dalam aplikasi.</p>
        <Link href="/login" className="btn w-full">
          Ke halaman masuk
        </Link>
      </LayarTengah>
    );
  }

  return (
    <LayarTengah judul="Buat akun pemilik" sub="Sekali saja, saat aplikasi baru dipasang.">
      <div className="ins">
        <p>Akun ini punya akses penuh. Setelah dibuat, halaman ini terkunci dan anggota tim ditambahkan dari dalam aplikasi.</p>
      </div>
      <FormMulai />
    </LayarTengah>
  );
}
