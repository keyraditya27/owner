import LogoARL from '@/components/LogoARL';

/** Kartu di tengah layar untuk halaman di luar aplikasi utama (login, setup, offline). */
export default function LayarTengah({
  judul,
  sub,
  children,
}: {
  judul: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="pt-aman pb-aman flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-halaman">
        <div className="bg-hero px-7 py-6 text-white">
          <LogoARL varian="putih" tinggi={48} denganTeks />
          <h1 className="mt-4 font-serif text-[23px] font-bold">{judul}</h1>
          {sub ? <p className="mt-1 text-[13.5px] text-langit-2">{sub}</p> : null}
        </div>
        <div className="flex flex-col gap-3 px-7 py-6">{children}</div>
      </div>
    </main>
  );
}
