import Link from 'next/link';
import type { Halaman } from '@/lib/navigasi';

/** Sub-tab di bawah hero. Tab aktif disimpan di URL (?tab=...) supaya bisa dibagikan & tombol Back jalan. */
export default function SubTab({ halaman, aktif }: { halaman: Halaman; aktif: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-garis bg-white px-[18px] [scrollbar-width:none] lebar:px-9 [&::-webkit-scrollbar]:hidden">
      {halaman.tabs.map((t, i) => {
        const on = t.kunci === aktif;
        return (
          <Link
            key={t.kunci}
            href={i === 0 ? halaman.href : `${halaman.href}?tab=${t.kunci}`}
            aria-current={on ? 'page' : undefined}
            scroll={false}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-[15px] py-[13px] text-[13px] font-semibold no-underline ${
              on ? 'border-biru text-navy' : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
