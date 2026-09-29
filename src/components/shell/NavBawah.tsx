'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import IkonSvg from '@/components/IkonSvg';
import { HALAMAN } from '@/lib/navigasi';

/** Menu bawah di HP — enam halaman yang sama dengan sidebar desktop. */
export default function NavBawah() {
  const path = usePathname();
  return (
    <nav
      aria-label="Menu utama"
      className="cetak-sembunyi pb-aman fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy lebar:hidden"
    >
      <ul className="grid grid-cols-6">
        {HALAMAN.map((h) => {
          const on = path === h.href || path.startsWith(h.href + '/');
          return (
            <li key={h.href}>
              <Link
                href={h.href}
                aria-current={on ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-0.5 pb-2 pt-2.5 text-[10px] font-semibold no-underline ${
                  on ? 'text-white' : 'text-langit-5'
                }`}
              >
                <span className={`rounded-full px-3 py-1 ${on ? 'bg-white/15' : ''}`}>
                  <IkonSvg nama={h.ikon} className="h-[18px] w-[18px]" />
                </span>
                <span className="w-full truncate text-center">{h.labelPendek}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
