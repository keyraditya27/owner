import type { Ikon } from '@/lib/navigasi';

/** Path ikon disalin dari konstanta ICON di prototipe v7. */
const PATH: Record<Ikon | 'plus' | 'kirim' | 'chat' | 'tutup' | 'keluar' | 'kecilkan', string> = {
  bar: 'M3 13h4v8H3v-8zm7-9h4v17h-4V4zm7 5h4v12h-4V9z',
  daftar: 'M4 5h16v3H4V5zm0 5h16v3H4v-3zm0 5h10v3H4v-3z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
  dompet: 'M3 6h15a3 3 0 013 3v9a3 3 0 01-3 3H3V6zm14 6a2 2 0 100 4 2 2 0 000-4zM3 3h12v2H3V3z',
  lonceng: 'M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z',
  dok: 'M5 3h9l5 5v13H5V3zm8 1.5V9h4.5L13 4.5zM7 12h10v2H7v-2zm0 4h10v2H7v-2z',
  tim: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7 0a3 3 0 100-6 3 3 0 000 6zM9 13c-3.3 0-7 1.7-7 4.5V20h14v-2.5C16 14.7 12.3 13 9 13zm7 0c-.6 0-1.2.1-1.8.2 1.1.9 1.8 2.1 1.8 3.3V20h6v-2.5c0-2.6-3.3-4.5-6-4.5z',
  kunci: 'M12 2a5 5 0 00-5 5v3H5v12h14V10h-2V7a5 5 0 00-5-5zm-3 5a3 3 0 016 0v3H9V7zm3 7a2 2 0 011 3.7V20h-2v-2.3A2 2 0 0112 14z',
  plus: 'M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  kirim: 'M12 4l7 7h-4v9h-6v-9H5l7-7z',
  chat: 'M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z',
  tutup: 'M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  kecilkan: 'M5 17h14v2H5z',
  keluar: 'M10 3h9a2 2 0 012 2v14a2 2 0 01-2 2h-9v-2h9V5h-9V3zm-.5 5.5L11 7l5 5-5 5-1.5-1.5L12 13H3v-2h9L9.5 8.5z',
};

export default function IkonSvg({
  nama,
  className = 'h-[15px] w-[15px]',
}: {
  nama: keyof typeof PATH;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-current ${className}`}>
      <path d={PATH[nama]} />
    </svg>
  );
}
