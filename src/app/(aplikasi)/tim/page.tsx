import Hero from '@/components/halaman/Hero';
import SalinTautan from '@/components/halaman/SalinTautan';
import TombolAksi from '@/components/halaman/TombolAksi';
import { aktifkanKaryawan, ubahGaji } from '@/app/(aplikasi)/aksi/gaji';
import { ambilData } from '@/lib/data';
import { rp } from '@/lib/format';
import { daftarKaryawan, sudahDigaji } from '@/lib/gaji';
import { urlKalender } from '@/lib/kalender';
import { wajibPemilik } from '@/lib/pengguna';
import FormKaryawan from './FormKaryawan';
import { klienAdmin } from '@/lib/supabase/admin';
import AturAnggota from './AturAnggota';
import FormAnggota from './FormAnggota';

export const metadata = { title: 'Tim' };
export const dynamic = 'force-dynamic';

const WARNA_PERAN: Record<string, string> = { pemilik: 'bg-navy', admin: 'bg-biru', staf: 'bg-muted' };

export default async function Tim() {
  const saya = await wajibPemilik();
  const admin = klienAdmin();

  const [{ data: daftar, error }, { data: akun }, karyawan, d] = await Promise.all([
    admin.from('pengguna').select('id, nama, peran, aktif, dibuat_pada').order('dibuat_pada'),
    admin.auth.admin.listUsers({ perPage: 200 }),
    daftarKaryawan(),
    ambilData(),
  ]);
  const kalender = urlKalender();
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
      <section className="border-b border-garis px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <h2 className="mb-1.5 font-serif text-[19px] font-bold">Gaji rutin</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Tiap tanggal 1, Ringkasan menampilkan pengingat untuk gaji yang belum tercatat bulan itu, lengkap dengan tombol
          &quot;Catat gaji&quot;. Hanya pemilik dan admin yang bisa melihat data ini; tidak pernah dikirim ke Google Sheet.
        </p>
        {karyawan.length ? (
          <div className="mb-5 overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Posisi</th>
                  <th className="!text-right">Gaji / bulan</th>
                  <th>Bulan ini</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {karyawan.map((k) => (
                  <tr key={k.id} className={k.aktif ? '' : 'opacity-60'}>
                    <td className="font-semibold">{k.nama}</td>
                    <td>{k.posisi || '—'}</td>
                    <td className="num text-right">{rp(k.gaji_pokok)}</td>
                    <td>
                      {!k.aktif ? (
                        <span className="pill bg-muted">nonaktif</span>
                      ) : sudahDigaji(k, d.transaksi) ? (
                        <span className="pill bg-hijau">sudah dicatat</span>
                      ) : (
                        <span className="pill bg-amber">belum</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <TombolAksi aksi={ubahGaji.bind(null, k.id)} className="btn-sm" minta={`Gaji baru ${k.nama} per bulan:`} wajibIsi>
                          Ubah gaji
                        </TombolAksi>
                        <TombolAksi
                          aksi={aktifkanKaryawan.bind(null, k.id, !k.aktif)}
                          className="btn-sm"
                          konfirmasi={k.aktif ? `Hentikan pengingat gaji ${k.nama}?` : `Aktifkan lagi pengingat gaji ${k.nama}?`}
                        >
                          {k.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </TombolAksi>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <FormKaryawan />
      </section>

      <section className="border-b border-garis px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <h2 className="mb-1.5 font-serif text-[19px] font-bold">Google Calendar</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Jadwal tagih tiap klien (sesuai tanggal tagihnya), jatuh tempo tagihan yang belum lunas, dan pengingat gaji
          tanggal 1 — otomatis ikut berubah saat data di aplikasi berubah.
        </p>
        {kalender ? (
          <>
            <SalinTautan url={kalender} />
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] text-teks2">
              <li>Buka calendar.google.com di laptop (tidak bisa dari aplikasi HP).</li>
              <li>
                Di kiri, sebelah <b>Other calendars</b>, klik <b>+</b> → <b>From URL</b>.
              </li>
              <li>
                Tempel tautan di atas → <b>Add calendar</b>. Selesai — muncul juga di Google Calendar HP.
              </li>
            </ol>
            <div className="ins ins-warn !mb-0 mt-4">
              <p>
                Tautan ini rahasia: siapa pun yang memegangnya bisa melihat jadwal tagih dan nominalnya. Google memperbarui
                kalender langganan beberapa jam sekali, jadi perubahan hari ini bisa baru muncul nanti.
              </p>
            </div>
          </>
        ) : (
          <div className="ins ins-warn !mb-0">
            <p>Isi CRON_SECRET dan NEXT_PUBLIC_APP_URL di Vercel dulu — tautan kalender dibuat dari keduanya.</p>
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
