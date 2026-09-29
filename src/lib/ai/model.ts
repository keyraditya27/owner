import 'server-only';

import { panggilGemini, type Gambar } from './gemini';
import { panggilNvidia } from './nvidia';

/**
 * Pilih penyedia AI dari kunci yang terpasang di server:
 * NVIDIA_API_KEY ada → NVIDIA, selain itu Gemini. AI_PENYEDIA=gemini|nvidia bisa memaksa.
 */
export function panggilAI(sistem: string, teks: string, gambar?: Gambar | null) {
  const paksa = process.env.AI_PENYEDIA?.trim().toLowerCase();
  const pakaiNvidia = paksa ? paksa === 'nvidia' : !!process.env.NVIDIA_API_KEY;
  return pakaiNvidia ? panggilNvidia(sistem, teks, gambar) : panggilGemini(sistem, teks, gambar);
}
