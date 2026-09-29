import Hero from '@/components/halaman/Hero';
import SubTab from '@/components/halaman/SubTab';
import { halamanDari, tabAktif } from '@/lib/navigasi';

/**
 * Kerangka satu halaman Tahap 1: hero + sub-tab + isi kosong.
 * Isinya diganti di Tahap 2 (Ringkasan, Transaksi, Klien) dan Tahap 4 (Aset, Pajak, Laporan).
 */
export default function HalamanKerangka({
  href,
  tab,
  tahap,
}: {
  href: string;
  tab: string | string[] | undefined;
  tahap: 2 | 4;
}) {
  const h = halamanDari(href);
  const aktif = tabAktif(h, tab);
  const labelTab = h.tabs.find((t) => t.kunci === aktif)!.label;
  return (
    <>
      <Hero judul={h.judul} badge={h.badge} sub="PT Arah Ruang Langit" />
      <SubTab halaman={h} aktif={aktif} />
      <section className="px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <div className="empty">
          <b>{labelTab}</b>
          Isi bagian ini dibangun di Tahap {tahap}.
        </div>
      </section>
    </>
  );
}
