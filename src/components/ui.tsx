/**
 * Potongan tampilan kecil dari prototipe v7: pill, judul seksi, KPI, insight,
 * kotak kosong. Server component — tanpa state.
 */
import IkonSvg from '@/components/IkonSvg';
import type { WarnaPill } from '@/lib/hitung';
import type { Ikon } from '@/lib/navigasi';

const WARNA_PILL: Record<WarnaPill, string> = {
  hijau: 'bg-hijau',
  merah: 'bg-merah',
  amber: 'bg-amber',
  biru: 'bg-biru',
  abu: 'bg-muted',
  navy: 'bg-navy',
};

export function Pill({ warna, children }: { warna: WarnaPill; children: React.ReactNode }) {
  return <span className={`pill ${WARNA_PILL[warna]}`}>{children}</span>;
}

const WARNA_IKON = { biru: 'bg-biru', hijau: 'bg-hijau', amber: 'bg-amber', merah: 'bg-merah' };

/** Satu blok <section> dengan judul berikon bulat — fungsi sec() di prototipe. */
export function Seksi({
  ikon,
  warna = 'biru',
  judul,
  desk,
  children,
}: {
  ikon: Ikon;
  warna?: keyof typeof WARNA_IKON;
  judul: string;
  desk?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-garis px-[18px] py-[22px] last:border-b-0 lebar:px-9 lebar:py-7">
      <div className="mb-1.5 flex items-center gap-3">
        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${WARNA_IKON[warna]}`}>
          <IkonSvg nama={ikon} className="h-[17px] w-[17px] text-white" />
        </div>
        <h2 className="font-serif text-[19px] font-bold">{judul}</h2>
      </div>
      {desk ? <p className="mb-[18px] text-[13px] text-muted lebar:ml-[46px]">{desk}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Section polos tanpa judul. */
export function Blok({ children }: { children: React.ReactNode }) {
  return <section className="border-b border-garis px-[18px] py-[22px] last:border-b-0 lebar:px-9 lebar:py-7">{children}</section>;
}

const KPI_KONDISI = {
  biasa: 'border-t-biru bg-krem',
  hl: 'border-t-hijau bg-hijau-muda',
  bad: 'border-t-merah bg-merah-muda',
  warn: 'border-t-amber bg-amber-muda',
};

export function Kpis({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3.5 min-[621px]:grid-cols-2 min-[1081px]:grid-cols-4">{children}</div>;
}

export function Kpi({
  label,
  nilai,
  catatan,
  kondisi = 'biasa',
}: {
  label: string;
  nilai: React.ReactNode;
  catatan?: React.ReactNode;
  kondisi?: keyof typeof KPI_KONDISI;
}) {
  return (
    <div className={`rounded-[10px] border border-t-[3px] border-garis p-4 ${KPI_KONDISI[kondisi]}`}>
      <div className="text-[11px] font-bold uppercase tracking-[.6px] text-muted">{label}</div>
      <div className="num mt-1.5 font-serif text-[20px] font-bold">{nilai}</div>
      {catatan ? <div className="mt-[3px] text-[11.5px] text-muted">{catatan}</div> : null}
    </div>
  );
}

export function Insight({
  jenis,
  judul,
  children,
  className = '',
}: {
  jenis?: 'good' | 'warn' | 'bad' | '';
  judul?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`ins ${jenis ? 'ins-' + jenis : ''} ${className}`}>
      {judul ? <h4>{judul}</h4> : null}
      <p>{children}</p>
    </div>
  );
}

export function Kosong({ judul, children }: { judul: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{judul}</b>
      {children}
    </div>
  );
}

/** Pembungkus tabel supaya bisa digeser menyamping di HP. */
export function GulirX({ children }: { children: React.ReactNode }) {
  return <div className="-mx-[18px] overflow-x-auto px-[18px] lebar:mx-0 lebar:px-0">{children}</div>;
}

export const Sub = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11.5px] font-normal text-muted">{children}</div>
);
