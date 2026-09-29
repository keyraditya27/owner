import 'server-only';

import { createSign } from 'node:crypto';

/**
 * Klien Google Sheets API v4 yang minimal — hanya empat panggilan yang dipakai sinkron.
 * Sengaja tidak memakai paket `googleapis` (puluhan MB) — cukup satu JWT RS256
 * dari service account lalu fetch biasa. Kredensial hanya dibaca di server.
 */

const LINGKUP = 'https://www.googleapis.com/auth/spreadsheets';
// Bisa diarahkan ke server tiruan saat pengujian lokal.
const URL_TOKEN = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const URL_API = (process.env.GOOGLE_SHEETS_BASE_URL || 'https://sheets.googleapis.com').replace(/\/$/, '');

export type KonfigSheet = { sheetId: string; email: string; kunci: string };

/**
 * null kalau env Google belum lengkap — sinkron dimatikan tanpa error.
 * Dua cara mengisi kredensial:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON: tempel SELURUH isi file JSON service account (paling mudah), atau
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY terpisah.
 */
export function konfigSheet(): KonfigSheet | null {
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let kunciMentah = process.env.GOOGLE_PRIVATE_KEY;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const j = JSON.parse(json) as { client_email?: string; private_key?: string };
      email = email || j.client_email?.trim();
      kunciMentah = kunciMentah || j.private_key;
    } catch {
      console.error('GOOGLE_SERVICE_ACCOUNT_JSON bukan JSON yang valid — tempel isi file apa adanya');
    }
  }
  // Vercel/.env menyimpan private key dengan "\n" literal — kembalikan jadi baris baru.
  const kunci = kunciMentah?.replace(/\\n/g, '\n').trim();
  if (!sheetId || !email || !kunci) return null;
  return { sheetId, email, kunci };
}

let tokenSimpan: { nilai: string; sampai: number; email: string } | null = null;

async function token(k: KonfigSheet): Promise<string> {
  const kini = Math.floor(Date.now() / 1000);
  if (tokenSimpan && tokenSimpan.email === k.email && tokenSimpan.sampai > kini + 60) return tokenSimpan.nilai;

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const isi = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: k.email, scope: LINGKUP, aud: URL_TOKEN, iat: kini, exp: kini + 3600 })}`;
  const tanda = createSign('RSA-SHA256').update(isi).sign(k.kunci, 'base64url');

  const r = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${isi}.${tanda}` }),
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new Error(`Login service account Google gagal: ${j.error_description ?? r.status}. Periksa GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY.`);
  }
  tokenSimpan = { nilai: j.access_token, sampai: kini + (j.expires_in ?? 3600), email: k.email };
  return j.access_token;
}

async function panggil<T>(k: KonfigSheet, jalur: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${URL_API}/v4/spreadsheets/${encodeURIComponent(k.sheetId)}${jalur}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${await token(k)}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!r.ok) {
    const pesan = j.error?.message ?? String(r.status);
    if (r.status === 403) throw new Error(`Google menolak akses ke sheet (${pesan}). Pastikan sheet sudah dibagikan ke email service account sebagai Editor.`);
    if (r.status === 404) throw new Error('Sheet tidak ditemukan. Periksa GOOGLE_SHEET_ID.');
    if (r.status === 429) throw new Error('Kuota Google Sheets API habis sementara. Dicoba lagi di putaran berikutnya.');
    throw new Error(`Google Sheets API: ${pesan}`);
  }
  return j;
}

export type InfoTab = { sheetId: number; title: string; rowCount: number; columnCount: number };

export async function daftarTab(k: KonfigSheet): Promise<InfoTab[]> {
  const j = await panggil<{ sheets?: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] }>(
    k,
    '?fields=sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))',
  );
  return (j.sheets ?? []).map((s) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount ?? 0,
    columnCount: s.properties.gridProperties?.columnCount ?? 0,
  }));
}

/** spreadsheets.batchUpdate — struktur & format (tambah tab, tambah baris, warna latar). */
export async function ubahStruktur(k: KonfigSheet, requests: object[]) {
  if (!requests.length) return null;
  return panggil<{ replies?: { addSheet?: { properties: { sheetId: number; title: string } } }[] }>(k, ':batchUpdate', {
    method: 'POST',
    body: { requests },
  });
}

export type Sel = string | number | boolean | null;

/**
 * Baca banyak tab sekaligus dalam SATU permintaan.
 * Angka apa adanya, tanggal sebagai nomor seri (bukan teks sesuai locale).
 */
export async function bacaTab(k: KonfigSheet, judul: string[]): Promise<Sel[][][]> {
  const q = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
  judul.forEach((t) => q.append('ranges', rentang(t)));
  const j = await panggil<{ valueRanges?: { values?: Sel[][] }[] }>(k, `/values:batchGet?${q}`);
  return judul.map((_, i) => j.valueRanges?.[i]?.values ?? []);
}

/**
 * Tulis banyak rentang dalam SATU permintaan. RAW: teks tetap teks
 * (tidak ditafsirkan jadi rumus atau tanggal). null = sel dibiarkan.
 */
export async function tulisNilai(k: KonfigSheet, data: { range: string; values: Sel[][] }[], opsi: 'RAW' | 'USER_ENTERED' = 'RAW') {
  if (!data.length) return;
  await panggil(k, '/values:batchUpdate', { method: 'POST', body: { valueInputOption: opsi, data } });
}

export const rentang = (tab: string, a1?: string) => `'${tab.replace(/'/g, "''")}'${a1 ? '!' + a1 : ''}`;

/** Indeks kolom 0-based → huruf (0 → A, 26 → AA). */
export function hurufKolom(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
