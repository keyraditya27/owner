'use client';

import { usePusat } from '@/components/form/PusatForm';

/** Kotak tautan hanya-baca + tombol salin. */
export default function SalinTautan({ url }: { url: string }) {
  const { kabar } = usePusat();
  return (
    <div className="flex flex-wrap gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 font-mono !text-[12px]" aria-label="Tautan kalender" />
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            kabar('Tautan disalin');
          } catch {
            kabar('Salin manual dari kotak tautan');
          }
        }}
      >
        Salin tautan
      </button>
    </div>
  );
}
