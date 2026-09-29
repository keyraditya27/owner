import 'server-only';

/**
 * Panggilan Gemini — HANYA di server. Kunci dikirim lewat header
 * x-goog-api-key (bukan query string) supaya tidak tercatat di log URL.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

let modelTersimpan: { daftar: string[]; sampai: number } | null = null;

const kunci = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new GalatAI('GEMINI_API_KEY belum diisi di server');
  return k;
};

export class GalatAI extends Error {}

/**
 * Urutan model lewat ListModels: Flash stabil dari versi tertinggi
 * (mis. gemini-3.8-flash, lalu 3.7, 3.6, …), lalu gemini-flash-latest,
 * lalu varian lite sebagai cadangan terakhir. Model pertama yang dipakai;
 * sisanya dicoba kalau model pertama sedang sibuk (503).
 * Disimpan 1 jam. GEMINI_MODEL di env bisa memaksa model tertentu.
 */
export async function daftarModel(): Promise<string[]> {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (modelTersimpan && modelTersimpan.sampai > Date.now()) return modelTersimpan.daftar;

  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': kunci() }, cache: 'no-store' });
  if (!r.ok) throw new GalatAI(r.status === 400 || r.status === 403 ? 'Kunci API Gemini ditolak' : `Gemini ${r.status}`);
  const d = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const ada = (d.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''));

  const urut = (re: RegExp) =>
    ada
      .filter((n) => re.test(n))
      .sort((a, b) => Number(b.match(re)![1]) - Number(a.match(re)![1]));
  const daftar = [
    ...urut(/^gemini-(\d+(?:\.\d+)?)-flash$/).slice(0, 3),
    ...(ada.includes('gemini-flash-latest') ? ['gemini-flash-latest'] : []),
    ...urut(/^gemini-(\d+(?:\.\d+)?)-flash-lite$/).slice(0, 1),
  ];
  if (!daftar.length) throw new GalatAI('Tidak ada model Gemini Flash yang tersedia untuk kunci ini');
  modelTersimpan = { daftar, sampai: Date.now() + 3600_000 };
  return daftar;
}

export type Gambar = { mime: string; base64: string };

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function panggilGemini(sistem: string, teks: string, gambar?: Gambar | null): Promise<{ teks: string; model: string }> {
  const parts: object[] = [];
  if (gambar) parts.push({ inline_data: { mime_type: gambar.mime, data: gambar.base64 } });
  parts.push({ text: teks || 'Ekstrak transaksi dari bukti ini.' });
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: sistem }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, response_mime_type: 'application/json', maxOutputTokens: 2048 },
  });

  const batas = Date.now() + 50_000;
  let terakhir = '';
  for (const model of await daftarModel()) {
    if (Date.now() > batas) break;
    const r = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': kunci() },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.max(5_000, batas - Date.now())),
    }).catch((e) => {
      terakhir = e instanceof Error && e.name === 'TimeoutError' ? 'waktu habis' : 'jaringan';
      return null;
    });
    if (!r) continue;
    if (r.ok) {
      const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return { teks: (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''), model };
    }
    terakhir = String(r.status);
    if (r.status === 401 || r.status === 403) throw new GalatAI('Kunci API Gemini ditolak');
    if (r.status === 400) {
      const isi = await r.text();
      throw new GalatAI(/api key/i.test(isi) ? 'Kunci API Gemini ditolak' : 'Permintaan ditolak Gemini (mungkin lampirannya tidak terbaca)');
    }
    if (r.status === 404) modelTersimpan = null; // model ditarik — susun ulang daftar lain kali
    // 429 / 5xx: model ini sibuk atau kuota habis → coba model berikutnya
    await tidur(600);
  }
  throw new GalatAI(
    terakhir === '429'
      ? 'Kuota Gemini habis untuk sekarang'
      : terakhir === '503'
        ? 'Server Gemini sedang sibuk'
        : `Gemini tidak merespons (${terakhir || 'tanpa keterangan'})`,
  );
}
