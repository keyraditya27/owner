import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import TabelTransaksi from '@/components/halaman/TabelTransaksi';
import { TombolForm } from '@/components/form/PusatForm';
import { Blok, Insight } from '@/components/ui';
import { ambilData, ambilPeriode, urlBukti } from '@/lib/data';
import { rp } from '@/lib/format';
import { totalTipe, urutTerbaru } from '@/lib/hitung';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { dalamPeriode, periodeLabel } from '@/lib/periode';

export const metadata = { title: 'Transaksi' };

const H = halamanDari('/transaksi');

export default async function HalamanTransaksi({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode] = await Promise.all([searchParams, ambilData(), ambilPeriode()]);
  const aktif = tabAktif(H, tab);

  const per = d.transaksi.filter((t) => dalamPeriode(periode, t.tanggal));
  let arr = per;
  if (aktif === 'masuk') arr = arr.filter((t) => t.tipe === 'masuk');
  if (aktif === 'keluar') arr = arr.filter((t) => t.tipe === 'keluar');
  if (aktif === 'bukti') arr = arr.filter((t) => !t.bukti_url);
  arr = urutTerbaru(arr);
  const tanpaBukti = per.filter((t) => !t.bukti_url).length;
  const url = await urlBukti(arr.map((t) => t.bukti_url ?? ''));

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        periode={periode}
        transaksi={d.transaksi}
        sub={
          <>
            {periodeLabel(periode)} · Masuk <b>{rp(totalTipe(per, 'masuk'))}</b> · Keluar <b>{rp(totalTipe(per, 'keluar'))}</b> ·{' '}
            {per.length} baris
          </>
        }
        aksi={
          <>
            <TombolForm buka={{ jenis: 'transaksi' }} varian="btn-hero">
              Catat transaksi
            </TombolForm>
            <a href="/api/transaksi.csv" className="btn-hero no-underline" download>
              Unduh CSV
            </a>
          </>
        }
        lencana={{
          semua: per.length,
          masuk: per.filter((t) => t.tipe === 'masuk').length,
          keluar: per.filter((t) => t.tipe === 'keluar').length,
          bukti: tanpaBukti || '',
        }}
      />
      <Blok>
        {aktif === 'bukti' ? (
          <Insight
            jenis={tanpaBukti ? 'warn' : 'good'}
            judul={tanpaBukti ? `${tanpaBukti} transaksi belum ada buktinya` : 'Semua transaksi sudah berbukti'}
          >
            {tanpaBukti
              ? 'Sebagai PT, beban tanpa bukti sah berisiko dikoreksi saat pemeriksaan pajak dan menaikkan pajak terutang. Lampirkan struk atau bukti transfernya.'
              : 'Bagus — semua beban di periode ini punya dokumen pendukung.'}
          </Insight>
        ) : null}
        <TabelTransaksi baris={arr} urlBukti={url} denganFilter denganKaki />
      </Blok>
    </>
  );
}
