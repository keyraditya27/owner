import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { rp } from '@/lib/format';

/**
 * Tautan kalender (iCal) untuk Google Calendar — "Tambah kalender → Dari URL".
 * Kuncinya diturunkan dari CRON_SECRET, jadi tidak perlu variabel baru.
 * Siapa pun yang memegang tautan ini bisa membaca jadwal tagih (nama klien & nominal) —
 * simpan hanya di kalender pribadi pemilik.
 */
export function tokenKalender(): string | null {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia) return null;
  return createHmac('sha256', rahasia).update('kalender-arl-v1').digest('hex').slice(0, 32);
}

export function tokenSah(t: string): boolean {
  const benar = tokenKalender();
  if (!benar || t.length !== benar.length) return false;
  return timingSafeEqual(Buffer.from(t), Buffer.from(benar));
}

export const urlKalender = () => {
  const t = tokenKalender();
  const dasar = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return t && dasar ? `${dasar}/api/kalender/${t}.ics` : null;
};

/* ------------------------------------------------------------ penyusun iCal */
export type Acara = {
  uid: string;
  tanggal: string; // YYYY-MM-DD (acara sehari penuh)
  judul: string;
  isi?: string;
  bulanan?: number; // ulangi tiap bulan pada tanggal ini
  url?: string;
};

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Baris iCal maks 75 oktet — sisanya dilipat dengan spasi di awal baris lanjutan (RFC 5545). */
function lipat(baris: string) {
  const b = Buffer.from(baris, 'utf8');
  if (b.length <= 75) return baris;
  const hasil: string[] = [];
  let i = 0;
  while (i < b.length) {
    let akhir = Math.min(b.length, i + (hasil.length ? 74 : 75));
    while (akhir < b.length && (b[akhir] & 0xc0) === 0x80) akhir--; // jangan potong di tengah karakter UTF-8
    hasil.push((hasil.length ? ' ' : '') + b.subarray(i, akhir).toString('utf8'));
    i = akhir;
  }
  return hasil.join('\r\n');
}

const tglIcs = (iso: string) => iso.replace(/-/g, '');
const besok = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);

export function susunIcs(nama: string, acara: Acara[]): string {
  const cap = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const baris = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PT Arah Ruang Langit//ARL Keuangan//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(nama)}`,
    'X-WR-TIMEZONE:Asia/Jakarta',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const a of acara) {
    baris.push(
      'BEGIN:VEVENT',
      `UID:${a.uid}@arl-keuangan`,
      `DTSTAMP:${cap}`,
      `DTSTART;VALUE=DATE:${tglIcs(a.tanggal)}`,
      `DTEND;VALUE=DATE:${tglIcs(besok(a.tanggal))}`,
      `SUMMARY:${esc(a.judul)}`,
    );
    if (a.bulanan) baris.push(`RRULE:FREQ=MONTHLY;BYMONTHDAY=${a.bulanan}`);
    if (a.isi) baris.push(`DESCRIPTION:${esc(a.isi)}`);
    if (a.url) baris.push(`URL:${a.url}`);
    // Pengingat pukul 08.00 di hari-H (acara sehari penuh mulai 00.00)
    baris.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(a.judul)}`, 'TRIGGER:PT8H', 'END:VALARM', 'END:VEVENT');
  }
  baris.push('END:VCALENDAR');
  return baris.map(lipat).join('\r\n') + '\r\n';
}

export const judulTagih = (nama: string, nilai: number) => `Tagih ${nama}${nilai ? ` — ${rp(nilai)}` : ''}`;
