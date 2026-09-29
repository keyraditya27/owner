import 'server-only';

import { GalatAI, type Gambar } from './gemini';

/**
 * Panggilan NVIDIA (build.nvidia.com, API gaya OpenAI) — HANYA di server.
 *
 * Teks: Nemotron 3 Super (±5–10 detik, JSON rapi) diberi jatah 25 detik; kalau sedang
 * lambat, cadangan gpt-oss-20b (±17 detik). DeepSeek juga benar tapi ±40 detik — terlalu
 * lambat untuk batas 60 detik Vercel.
 * Foto bukti: model vision di NVIDIA lambat dan tidak patuh format JSON, jadi dua tahap —
 * model vision kecil hanya MENYALIN teks yang terlihat di foto, lalu model teks yang
 * menyusun aksinya dengan instruksi sistem lengkap. Hasil diuji September 2026.
 *
 * NVIDIA_MODEL (dipisah koma) dan NVIDIA_MODEL_GAMBAR bisa memaksa model lain.
 */
const BASE = 'https://integrate.api.nvidia.com/v1';
const MODEL_TEKS = ['nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b'];
/** Jatah waktu model pertama, supaya cadangan masih sempat dicoba. */
const JATAH_PERTAMA = 25_000;
const MODEL_GAMBAR = 'meta/llama-3.2-11b-vision-instruct';

const kunci = () => {
  const k = process.env.NVIDIA_API_KEY;
  if (!k) throw new GalatAI('NVIDIA_API_KEY belum diisi di server');
  return k;
};

const daftarModel = () =>
  process.env.NVIDIA_MODEL?.split(',')
    .map((m) => m.trim())
    .filter(Boolean) ?? MODEL_TEKS;

type Pesan = { role: 'system' | 'user'; content: string | object[] };

async function selesaikan(model: string, messages: Pesan[], maks: number, batasMs: number): Promise<string> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kunci()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: maks }),
    cache: 'no-store',
    signal: AbortSignal.timeout(Math.max(5_000, batasMs)),
  });
  if (r.status === 401 || r.status === 403) throw new GalatAI('Kunci API NVIDIA ditolak');
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return d.choices?.[0]?.message?.content ?? '';
}

/** Tahap 1 untuk foto: salin teks yang terlihat. Tidak menafsirkan apa pun. */
async function bacaGambar(g: Gambar, batasMs: number): Promise<string> {
  if (g.mime === 'application/pdf') {
    throw new GalatAI('PDF belum bisa dibaca AI NVIDIA — kirim foto atau screenshot buktinya');
  }
  const model = process.env.NVIDIA_MODEL_GAMBAR || MODEL_GAMBAR;
  try {
    return await selesaikan(
      model,
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              // Jangan menyebut daftar kolom (tanggal, pengirim, bank…) — model vision kecil
              // lalu MENGARANG isinya kalau tidak ada di foto. Terbukti saat diuji.
              text: 'Transkripsikan teks yang benar-benar tercetak di gambar ini, persis kata per kata, satu baris per baris teks. Jangan menambah, melengkapi, atau menebak apa pun. Kalau hanya ada dua baris teks, tulis dua baris itu saja.',
            },
            { type: 'image_url', image_url: { url: `data:${g.mime};base64,${g.base64}` } },
          ],
        },
      ],
      800,
      batasMs,
    );
  } catch (e) {
    if (e instanceof GalatAI) throw e;
    throw new GalatAI('Foto bukti tidak terbaca oleh AI NVIDIA — coba lagi atau ketik rinciannya');
  }
}

export async function panggilNvidia(sistem: string, teks: string, gambar?: Gambar | null): Promise<{ teks: string; model: string }> {
  const batas = Date.now() + 50_000;
  let perintah = teks || 'Ekstrak transaksi dari bukti ini.';
  if (gambar) {
    const salinan = await bacaGambar(gambar, 28_000); // vision NVIDIA 6–30 detik saat diuji
    perintah +=
      `\n\n[Teks yang terbaca dari foto bukti terlampir]\n${salinan.slice(0, 3000)}\n[akhir teks foto]\n` +
      'Pakai tanggal dari foto HANYA kalau tanggalnya tertulis jelas di teks foto di atas; kalau tidak ada, pakai tanggal dari kalimat pengguna atau hari ini.';
  }

  let terakhir = '';
  const daftar = daftarModel();
  for (const [i, model] of daftar.entries()) {
    if (Date.now() > batas - 3_000) break;
    const sisa = batas - Date.now();
    try {
      const isi = await selesaikan(
        model,
        [
          { role: 'system', content: sistem },
          { role: 'user', content: perintah },
        ],
        2048,
        i < daftar.length - 1 ? Math.min(sisa, JATAH_PERTAMA) : sisa,
      );
      return { teks: isi, model };
    } catch (e) {
      if (e instanceof GalatAI) throw e;
      terakhir = e instanceof Error && e.name === 'TimeoutError' ? 'waktu habis' : e instanceof Error ? e.message : 'jaringan';
      // 404 (model tidak tersedia untuk akun ini), 429, 5xx, waktu habis → coba model berikutnya
    }
  }
  throw new GalatAI(terakhir === '429' ? 'Kuota NVIDIA habis untuk sekarang' : `AI NVIDIA tidak merespons (${terakhir || 'tanpa keterangan'})`);
}
