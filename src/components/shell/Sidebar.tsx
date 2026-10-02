'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import IkonSvg from '@/components/IkonSvg';
import LogoARL from '@/components/LogoARL';
import { HALAMAN, HALAMAN_DOKUMEN } from '@/lib/navigasi';
import type { PenggunaAktif } from '@/lib/pengguna';
import { keluar } from '@/app/login/actions';

const aktif = (path: string, href: string) => path === href || path.startsWith(href + '/');

/** Sidebar navy desktop — mengikuti <aside> di prototipe v7. Disembunyikan di bawah 1080px. */
export default function Sidebar({
  pengguna,
  tunggakan = 0,
  menunggu = 0,
}: {
  pengguna: PenggunaAktif;
  tunggakan?: number;
  menunggu?: number;
}) {
  const path = usePathname();
  const kelasTombol = (on: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] no-underline ${
      on ? 'bg-white font-bold text-navy' : 'text-langit-1 hover:bg-white/[.09] hover:text-white'
    }`;

  return (
    <aside className="cetak-sembunyi sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar px-4 py-6 text-white lebar:flex">
      <div className="px-1.5 pb-1.5">
        <LogoARL varian="putih" tinggi={56} denganTeks sub="KEUANGAN INTERNAL" />
      </div>
      <div className="mx-1.5 mb-5 mt-3.5 text-[11px] font-bold tracking-[1.4px] text-hijau">#ZeroToHero</div>

      <nav className="flex flex-col gap-[3px]" aria-label="Menu utama">
        {HALAMAN.map((h) => {
          const on = aktif(path, h.href);
          return (
            <Link key={h.href} href={h.href} aria-current={on ? 'page' : undefined} className={kelasTombol(on)}>
              <IkonSvg nama={h.ikon} className="h-[15px] w-[15px] shrink-0 opacity-85" />
              {h.label}
              {h.href === '/klien' && tunggakan > 0 ? (
                <span className="ml-auto rounded-xl bg-merah px-2 py-px text-[10.5px] font-bold text-white">{tunggakan}</span>
              ) : null}
            </Link>
          );
        })}
        <div className="mx-3 mb-1 mt-3 text-[10.5px] font-bold tracking-[1.4px] text-langit-5">DOKUMEN</div>
        {HALAMAN_DOKUMEN.map((h) => {
          const on = aktif(path, h.href);
          return (
            <Link key={h.href} href={h.href} aria-current={on ? 'page' : undefined} className={kelasTombol(on)}>
              <IkonSvg nama={h.ikon} className="h-[15px] w-[15px] shrink-0 opacity-85" />
              {h.label}
            </Link>
          );
        })}
        <div className="mx-3 my-2 border-t border-white/[.12]" />
        <Link
          href="/kontrol"
          aria-current={aktif(path, '/kontrol') ? 'page' : undefined}
          className={kelasTombol(aktif(path, '/kontrol'))}
        >
          <IkonSvg nama="kunci" className="h-[15px] w-[15px] shrink-0 opacity-85" />
          Kontrol
          {menunggu > 0 ? (
            <span className="ml-auto rounded-xl bg-amber px-2 py-px text-[10.5px] font-bold text-white">{menunggu}</span>
          ) : null}
        </Link>
        {pengguna.peran === 'pemilik' ? (
          <Link
            href="/tim"
            aria-current={aktif(path, '/tim') ? 'page' : undefined}
            className={kelasTombol(aktif(path, '/tim'))}
          >
            <IkonSvg nama="tim" className="h-[15px] w-[15px] shrink-0 opacity-85" />
            Tim
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto flex flex-col gap-[5px] border-t border-white/[.14] px-1.5 pt-4">
        <form action={keluar}>
          <button className="w-full rounded-[7px] border border-white/[.16] bg-white/[.07] px-2.5 py-[7px] text-left text-xs text-[#D6E5F5] hover:bg-white/[.15] hover:text-white">
            Keluar
          </button>
        </form>
        <div className="pt-2 text-[11px] text-langit-5">
          {pengguna.nama} · {pengguna.peran}
          <br />
          Arah Ruang Langit · Bandung
        </div>
      </div>
    </aside>
  );
}
