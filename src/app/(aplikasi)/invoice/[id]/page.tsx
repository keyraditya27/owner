import { notFound } from 'next/navigation';
import Hero from '@/components/halaman/Hero';
import { ambilData } from '@/lib/data';
import { ambilDokumen, ambilKatalog } from '@/lib/dokumen';
import { hariIni } from '@/lib/format';
import Penyusun from './Penyusun';

export const metadata = { title: 'Penyusun Invoice' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HalamanDokumen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jenis?: string }>;
}) {
  const [{ id }, { jenis }, d, k] = await Promise.all([params, searchParams, ambilData(), ambilKatalog()]);
  let isi = null;
  if (id !== 'baru') {
    if (!UUID.test(id)) notFound();
    isi = await ambilDokumen(id);
    if (!isi) notFound();
  }
  const j = isi?.dok.jenis ?? (jenis === 'penawaran' ? 'penawaran' : 'invoice');

  return (
    <>
      <div className="cetak-sembunyi">
        <Hero
          judul={j === 'invoice' ? 'Invoice' : 'Penawaran Harga'}
          badge="Penyusun Layanan"
          sub={isi?.dok.nomor ?? 'Dokumen baru — nomor diberikan saat diterbitkan'}
        />
      </div>
      <Penyusun
        jenis={j}
        awal={isi}
        hariIni={hariIni()}
        klien={d.klien.filter((x) => x.aktif)}
        rekening={d.rekening.map((r) => ({ id: r.id, nama: r.nama }))}
        perusahaan={d.perusahaan}
        kelompok={k.kelompok}
        layanan={k.layanan.filter((l) => l.aktif)}
      />
    </>
  );
}
