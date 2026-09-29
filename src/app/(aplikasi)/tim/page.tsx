import Hero from '@/components/halaman/Hero';
import { wajibPemilik } from '@/lib/pengguna';
import { klienAdmin } from '@/lib/supabase/admin';
import AturAnggota from './AturAnggota';
import FormAnggota from './FormAnggota';

export const metadata = { title: 'Tim' };
export const dynamic = 'force-dynamic';

const WARNA_PERAN: Record<string, string> = { pemilik: 'bg-navy', admin: 'bg-biru', staf: 'bg-muted' };

export default async function Tim() {
  const saya = await wajibPemilik();
  const admin = klienAdmin();

  const [{ data: daftar, error }, { data: akun }] = await Promise.all([
    admin.from('pengguna').select('id, nama, peran, aktif, dibuat_pada').order('dibuat_pada'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const emailDari = new Map((akun?.users ?? []).map((u) => [u.id, u.email ?? '']));

  return (
    <>
      <Hero
        judul="Tim"
        badge="Hak Akses"
        sub={`${daftar?.length ?? 0} anggota · hanya pemilik yang bisa membuka halaman ini`}
      />
      <section className="border-b border-garis px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <h2 className="mb-1.5 font-serif text-[19px] font-bold">Anggota</h2>
        {error ? (
          <div className="ins ins-bad">
            <p>Gagal membaca daftar tim: {error.message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(daftar ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.nama}</td>
                    <td>{emailDari.get(p.id) ?? '—'}</td>
                    <td>
                      <span className={`pill ${WARNA_PERAN[p.peran] ?? 'bg-muted'}`}>{p.peran}</span>
                    </td>
                    <td>{p.aktif ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="text-right">
                      {p.id !== saya.id && p.peran !== 'pemilik' ? (
                        <AturAnggota id={p.id} nama={p.nama} peran={p.peran} aktif={p.aktif} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <h2 className="mb-1.5 font-serif text-[19px] font-bold">Tambah anggota</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Akun langsung aktif. Berikan email dan password sementara ke yang bersangkutan secara langsung, jangan lewat
          grup.
        </p>
        <FormAnggota />
      </section>
    </>
  );
}
