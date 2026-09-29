'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { bulanLabel, bulanIni, geserBulan, hariIni } from '@/lib/format';
import { COOKIE_PERIODE, type ModePeriode, type Periode } from '@/lib/periode';

/**
 * Bar periode global. Pilihan disimpan di cookie lalu halaman di-refresh dari
 * server — ganti sekali, semua halaman ikut (Tahap 2 poin 3).
 */
export default function BarPeriode({ periode, opsiBulan }: { periode: Periode; opsiBulan: string[] }) {
  const router = useRouter();
  const [proses, mulai] = useTransition();

  const simpan = (p: Periode) => {
    document.cookie = `${COOKIE_PERIODE}=${encodeURIComponent(JSON.stringify(p))}; path=/; max-age=31536000; samesite=lax`;
    mulai(() => router.refresh());
  };
  const setMode = (mode: ModePeriode) => simpan({ ...periode, mode });
  const geser = (n: number) =>
    simpan(
      periode.mode === 'bulan'
        ? { ...periode, ym: geserBulan(periode.ym, n) }
        : { ...periode, tahun: String(+periode.tahun + n) },
    );
  const kini = () => simpan({ ...periode, ym: bulanIni(), tahun: hariIni().slice(0, 4) });

  const bulan = opsiBulan.includes(periode.ym) ? opsiBulan : [...opsiBulan, periode.ym].sort().reverse();
  const tahunOpsi = [...new Set([...bulan.map((b) => b.slice(0, 4)), periode.tahun])].sort().reverse();
  const tombolNav =
    'flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-garis bg-white text-base leading-none text-navy hover:bg-krem';

  return (
    <div
      className={`cetak-sembunyi flex flex-wrap items-center justify-between gap-3 border-b border-garis bg-[#F8FAFD] px-[18px] py-2.5 lebar:px-9 lebar:py-3 ${
        proses ? 'opacity-70' : ''
      }`}
    >
      <div className="inline-flex overflow-hidden rounded-[9px] border border-garis bg-white">
        {(
          [
            ['bulan', 'Per Bulan'],
            ['tahun', 'Per Tahun'],
            ['semua', 'Semua'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            aria-pressed={periode.mode === k}
            className={`border-r border-garis px-[15px] py-[7px] text-[12.5px] font-semibold last:border-r-0 ${
              periode.mode === k ? 'bg-navy text-white' : 'text-muted hover:bg-krem hover:text-navy'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {periode.mode !== 'semua' ? (
        <div className="flex items-center gap-1.5">
          <button onClick={() => geser(-1)} title="Sebelumnya" className={tombolNav}>
            ‹
          </button>
          {periode.mode === 'bulan' ? (
            <select
              value={periode.ym}
              onChange={(e) => simpan({ ...periode, ym: e.target.value })}
              className="!w-auto min-w-[150px] !px-2.5 !py-1.5 font-serif !text-[13px] font-semibold"
            >
              {bulan.map((b) => (
                <option key={b} value={b}>
                  {bulanLabel(b)}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={periode.tahun}
              onChange={(e) => simpan({ ...periode, tahun: e.target.value })}
              className="!w-auto min-w-[150px] !px-2.5 !py-1.5 font-serif !text-[13px] font-semibold"
            >
              {tahunOpsi.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => geser(1)} title="Berikutnya" className={tombolNav}>
            ›
          </button>
          <button onClick={kini} className={`${tombolNav} !w-auto px-3 !text-xs font-semibold`}>
            Kini
          </button>
        </div>
      ) : (
        <span className="text-[11.5px] text-muted">Menampilkan seluruh data sejak awal pencatatan</span>
      )}
    </div>
  );
}
