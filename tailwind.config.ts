import type { Config } from 'tailwindcss';

/**
 * Design token ARL — sumbernya CLAUDE.md bagian "Desain visual" dan
 * variabel :root di arl-keuangan-v7.html. Komponen memakai nama token ini
 * (bg-navy, text-muted, border-garis, ...), bukan kode warna mentah.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0A2540', 2: '#0d2c4d', 3: '#123a63', kepala: '#12395F' },
        biru: { DEFAULT: '#1B6FE3', tua: '#1560CC' },
        horizon: '#4FA3F7',
        hijau: { DEFAULT: '#0FB88F', tua: '#0CA37E', muda: '#F0FBF8' },
        amber: { DEFAULT: '#F5A623', muda: '#FEF8EE' },
        merah: { DEFAULT: '#E5484D', muda: '#FEF3F3', garis: '#F3CDCE' },
        krem: '#F5F7FA',
        garis: '#E3E9F0',
        muted: '#6B7C93',
        latar: '#EEF2F7',
        teks2: '#3D4F63',
        // warna teks di atas latar navy
        langit: { 1: '#C3D8EF', 2: '#BBD4F2', 3: '#8FB5DE', 4: '#A9C6E6', 5: '#7FA0C4' },
      },
      fontFamily: {
        serif: ['Cambria', 'Georgia', 'serif'],
        sans: ['Calibri', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        sidebar: 'linear-gradient(160deg,#0A2540 0%,#0d2c4d 60%,#123a63 100%)',
        hero: 'linear-gradient(135deg,#0A2540 0%,#123a63 55%,#1B6FE3 140%)',
      },
      boxShadow: {
        halaman: '0 8px 32px rgba(10,37,64,.10)',
        toast: '0 6px 20px rgba(10,37,64,.3)',
      },
      screens: {
        // Di bawah 1080px prototipe melipat sidebar & chat — di sini jadi tata letak HP.
        lebar: '1080px',
        xl2: '1240px',
      },
    },
  },
  plugins: [],
};

export default config;
