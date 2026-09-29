'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import IkonSvg from '@/components/IkonSvg';
import LogoARL from '@/components/LogoARL';
import type { PenggunaAktif } from '@/lib/pengguna';
import { keluar } from '@/app/login/actions';

/**
 * Bilah atas khusus HP/tablet (di bawah 1080px): logo + menu akun.
 * Menu halaman ada di NavBawah supaya mudah dijangkau jempol.
 */
export default function HeaderHP({ pengguna }: { pengguna: PenggunaAktif }) {
  const [buka, setBuka] = useState(false);
  const path = usePathname();
  return (
    <header className="pt-aman sticky top-0 z-30 bg-sidebar text-white lebar:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/ringkasan" className="text-white no-underline">
          <LogoARL varian="putih" tinggi={34} denganTeks />
        </Link>
        <button
          onClick={() => setBuka((v) => !v)}
          aria-expanded={buka}
          className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold"
        >
          {pengguna.nama.split(' ')[0]}
        </button>
      </div>
      {buka ? (
        <div className="flex flex-col gap-1 border-t border-white/[.14] px-4 py-3 text-[13px]">
          <span className="text-langit-5">
            {pengguna.email} · {pengguna.peran}
          </span>
          {pengguna.peran === 'pemilik' ? (
            <Link
              href="/tim"
              onClick={() => setBuka(false)}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 no-underline ${
                path === '/tim' ? 'bg-white text-navy' : 'text-langit-1'
              }`}
            >
              <IkonSvg nama="tim" /> Kelola tim
            </Link>
          ) : null}
          <form action={keluar}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-langit-1">
              <IkonSvg nama="keluar" /> Keluar
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
