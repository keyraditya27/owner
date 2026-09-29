import Hero from '@/components/halaman/Hero';
import SubTab from '@/components/halaman/SubTab';
import BarPeriode from '@/components/halaman/BarPeriode';
import type { Halaman } from '@/lib/navigasi';
import { opsiBulan, type Periode } from '@/lib/periode';
import type { Transaksi } from '@/lib/tipe-db';

/** Hero + bar periode + sub-tab — susunan atas tiap halaman di prototipe. */
export default function KepalaHalaman({
  halaman,
  aktif,
  sub,
  aksi,
  periode,
  transaksi,
  badge,
  lencana,
}: {
  halaman: Halaman;
  aktif: string;
  sub: React.ReactNode;
  aksi?: React.ReactNode;
  /** isi kalau halaman memakai bar periode */
  periode?: Periode;
  transaksi?: Transaksi[];
  badge?: string;
  lencana?: Record<string, number | string>;
}) {
  return (
    <>
      <Hero judul={halaman.judul} badge={badge ?? halaman.badge} sub={sub} aksi={aksi} />
      {periode ? <BarPeriode periode={periode} opsiBulan={opsiBulan((transaksi ?? []).map((t) => t.tanggal))} /> : null}
      <SubTab halaman={halaman} aktif={aktif} lencana={lencana} />
    </>
  );
}
