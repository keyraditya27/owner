'use client';

import { useEffect } from 'react';

/** Modal gaya prototipe: kepala navy, isi, kaki berisi tombol. Di HP tampil hampir layar penuh. */
export default function Modal({
  judul,
  onTutup,
  children,
  kaki,
  lebar = 600,
}: {
  judul: string;
  onTutup: () => void;
  children: React.ReactNode;
  kaki?: React.ReactNode;
  lebar?: number;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onTutup();
    document.addEventListener('keydown', esc);
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = lama;
    };
  }, [onTutup]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-end bg-navy/60 sm:place-items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onTutup()}
      role="dialog"
      aria-modal="true"
      aria-label={judul}
    >
      <div
        className="pb-aman flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[14px] bg-white sm:max-h-[88vh] sm:rounded-[14px]"
        style={{ maxWidth: lebar }}
      >
        <div className="flex items-center justify-between gap-2.5 bg-navy px-5 py-4 text-white">
          <h3 className="font-serif text-base font-bold">{judul}</h3>
          <button onClick={onTutup} aria-label="Tutup" className="text-[22px] leading-none text-langit-4">
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {kaki ? <div className="flex flex-wrap justify-end gap-2 border-t border-garis px-5 py-3.5">{kaki}</div> : null}
      </div>
    </div>
  );
}
