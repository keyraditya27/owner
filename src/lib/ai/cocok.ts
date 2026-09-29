/**
 * Pencocokan nama dari keluaran model ke data yang ada — skorCocok/cariSatu
 * di prototipe v7, ditambah penolakan kalau hasilnya ambigu (dua kandidat
 * sama kuat). Lebih baik bertanya daripada mencatat ke klien yang salah.
 */

export function skorCocok(kueri: string | null | undefined, target: string | null | undefined) {
  const a = (kueri || '').toLowerCase().trim();
  const b = (target || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80 - Math.abs(a.length - b.length);
  const ka = a.split(/\s+/);
  const kb = b.split(/\s+/);
  let n = 0;
  ka.forEach((x) => {
    if (x.length > 2 && kb.some((y) => y.startsWith(x) || x.startsWith(y))) n++;
  });
  return n ? 40 + n * 10 : 0;
}

export type HasilCari<T> = { ok: true; data: T } | { ok: false; alasan: 'tidak-ada' | 'ambigu'; kandidat: T[] };

/** Cari satu baris yang namanya cocok. Minimal skor 40 (sama dengan prototipe) dan harus unik. */
export function cariSatu<T>(arr: T[], kueri: string | null | undefined, nama: (x: T) => string | null): HasilCari<T> {
  if (!kueri) return { ok: false, alasan: 'tidak-ada', kandidat: [] };
  const skor = arr.map((o) => ({ o, s: skorCocok(kueri, nama(o)) })).filter((x) => x.s >= 40);
  if (!skor.length) return { ok: false, alasan: 'tidak-ada', kandidat: [] };
  skor.sort((a, b) => b.s - a.s);
  // Ambigu kalau kandidat kedua hampir sama kuat ("Batik" → Batik Ayman 74 vs Batik Nusantara 70).
  if (skor.length > 1 && skor[0].s < 100 && skor[1].s >= skor[0].s - 10) {
    return { ok: false, alasan: 'ambigu', kandidat: skor.filter((x) => x.s >= skor[0].s - 10).map((x) => x.o) };
  }
  return { ok: true, data: skor[0].o };
}
