import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import { Insight, Seksi } from '@/components/ui';
import { ambilData } from '@/lib/data';
import { ambilKatalog } from '@/lib/dokumen';
import { halamanDokumen, tabAktif } from '@/lib/navigasi';
import FormKop from './FormKop';
import KelolaKatalog from './KelolaKatalog';

export const metadata = { title: 'Katalog Layanan' };
const H = halamanDokumen('/katalog');

export default async function HalamanKatalog({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, k, d] = await Promise.all([searchParams, ambilKatalog(), ambilData()]);
  const aktif = tabAktif(H, tab);
  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        sub={
          <>
            {k.layanan.filter((l) => l.aktif).length} layanan aktif di {k.kelompok.length} kelompok
          </>
        }
      />
      {aktif === 'kop' ? (
        <Seksi ikon="dok" judul="Kop & Pembayaran" desk="Tampil di setiap invoice. Nama PT, alamat, dan NPWP diambil dari profil perusahaan di halaman Pajak.">
          {d.perusahaan ? (
            <FormKop p={d.perusahaan} />
          ) : (
            <Insight jenis="warn">Profil perusahaan belum ada. Isi dulu di halaman Pajak.</Insight>
          )}
        </Seksi>
      ) : (
        <Seksi
          ikon="daftar"
          judul="Layanan & Porsi"
          desk="Daftar harga ARL. Porsi Hemat/Standar/Premium adalah jumlah bawaan — satu klik di penyusun invoice mengisi semua baris. Mengubah harga di sini tidak mengubah invoice yang sudah dibuat."
        >
          <KelolaKatalog kelompok={k.kelompok} layanan={k.layanan} />
        </Seksi>
      )}
    </>
  );
}
