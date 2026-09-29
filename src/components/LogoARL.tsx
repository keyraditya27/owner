/* eslint-disable @next/next/no-img-element -- logo PNG kecil, tidak perlu optimasi next/image */

/**
 * Logo resmi ARL dari folder logo/ (disalin ke public/logo oleh `npm run ikon`).
 * Putih untuk latar navy, gelap untuk latar terang — sesuai CLAUDE.md.
 * Jangan diganti ikon lain atau digambar ulang.
 */
export default function LogoARL({
  varian = 'putih',
  tinggi = 56,
  denganTeks = false,
  sub,
}: {
  varian?: 'putih' | 'gelap';
  tinggi?: number;
  denganTeks?: boolean;
  sub?: string;
}) {
  const img = (
    <img
      src={varian === 'putih' ? '/logo/arl-putih.png' : '/logo/arl-gelap.png'}
      alt="Logo Arah Ruang Langit"
      style={{ height: tinggi, width: 'auto' }}
      className="block shrink-0 object-contain"
    />
  );
  if (!denganTeks) return img;
  return (
    <span className="flex items-center gap-[11px]">
      {img}
      <span>
        <span className="block font-serif text-[14.5px] font-bold leading-tight tracking-[.5px]">
          ARAH RUANG
          <br />
          <span className={varian === 'putih' ? 'text-horizon' : 'text-biru'}>LANGIT</span>
        </span>
        {sub ? (
          <span className="mt-[3px] block text-[10.5px] font-bold tracking-[1.4px] text-langit-3">{sub}</span>
        ) : null}
      </span>
    </span>
  );
}
