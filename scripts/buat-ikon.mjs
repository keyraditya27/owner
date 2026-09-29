// Membuat aset gambar di public/ dari logo resmi di folder logo/.
// Jalankan ulang (`npm run ikon`) kalau file logo diganti.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const NAVY = '#0A2540';
const PUTIH = 'logo/ARL_Logo_tanpa_background_putih.png';
const GELAP = 'logo/ARL_Logo_tanpa_background.png';

await mkdir('public/logo', { recursive: true });
await mkdir('public/ikon', { recursive: true });

// Logo untuk antarmuka — tinggi 240px cukup tajam untuk tampilan 2x (maks. 56px di layar)
for (const [src, dst] of [
  [PUTIH, 'public/logo/arl-putih.png'],
  [GELAP, 'public/logo/arl-gelap.png'],
]) {
  await sharp(src).resize({ height: 240 }).png({ compressionLevel: 9 }).toFile(dst);
}

/** Ikon persegi: logo putih di tengah latar navy. `porsi` = tinggi logo relatif sisi ikon. */
async function ikon(sisi, porsi, dst) {
  const tinggi = Math.round(sisi * porsi);
  const logo = await sharp(PUTIH).resize({ height: tinggi }).png().toBuffer();
  await sharp({ create: { width: sisi, height: sisi, channels: 4, background: NAVY } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(dst);
}

await ikon(192, 0.66, 'public/ikon/ikon-192.png');
await ikon(512, 0.66, 'public/ikon/ikon-512.png');
// Maskable: Android memotong ikon jadi lingkaran/rounded — logo harus di zona aman 80% tengah.
await ikon(512, 0.5, 'public/ikon/ikon-maskable-512.png');
await ikon(180, 0.62, 'public/ikon/apple-touch-icon.png');

console.log('Ikon & logo dibuat di public/');
