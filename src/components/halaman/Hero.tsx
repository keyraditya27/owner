import LogoARL from '@/components/LogoARL';

/** Hero navy bergradien di atas tiap halaman — heroHTML() di prototipe v7. */
export default function Hero({
  judul,
  sub,
  badge,
  aksi,
}: {
  judul: string;
  sub?: React.ReactNode;
  badge: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="bg-hero px-[18px] py-6 text-white lebar:px-9 lebar:py-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Di HP logo sudah ada di bilah atas — di hero cukup badge-nya */}
        <div className="hidden items-center gap-[11px] font-serif text-[17px] font-bold tracking-[.5px] lebar:flex">
          <LogoARL varian="putih" tinggi={40} />
          <span>
            ARAH RUANG <span className="text-horizon">LANGIT</span>
          </span>
        </div>
        <div className="rounded-[20px] border border-white/25 bg-white/[.12] px-3.5 py-1.5 text-xs">{badge}</div>
      </div>
      <h1 className="mt-4 font-serif text-[23px] font-bold lebar:text-[27px]">{judul}</h1>
      {sub ? <div className="mt-1.5 text-[13.5px] text-langit-2">{sub}</div> : null}
      {aksi ? <div className="mt-[18px] flex flex-wrap gap-2">{aksi}</div> : null}
    </div>
  );
}
