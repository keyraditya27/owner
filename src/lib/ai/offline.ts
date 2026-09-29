import 'server-only';

/**
 * Cadangan saat Gemini tidak bisa dihubungi — HANYA menjawab pertanyaan
 * (saldo, siapa belum bayar, rekap), memakai jawabPertanyaan() dari prototipe.
 *
 * Beda sengaja dengan prototipe: mode offline TIDAK menyimpan apa pun.
 * Saat diuji, parser kata kunci prototipe mencatat koreksi "bukan 750rb tapi
 * 800rb" sebagai transaksi BARU (dobel), dan mencatat pemasukan dari klien
 * yang tidak terdaftar. Lebih aman menolak lalu minta dicoba lagi.
 */
import { bulanIni, bulanLabel, rp } from '@/lib/format';
import { statusInv, tagihanTerbuka, totalKas, totalPiutang, totalTipe, type DataKeuangan } from '@/lib/hitung';

function jawabPertanyaan(text: string, d: DataKeuangan) {
  const t = text.toLowerCase();
  if (!t) return null;
  const bulan = d.transaksi.filter((x) => x.tanggal.startsWith(bulanIni()));
  if (/saldo|kas sekarang|uang kita/.test(t))
    return `Saldo kas ${rp(totalKas(d))}.\nBulan ini masuk ${rp(totalTipe(bulan, 'masuk'))}, keluar ${rp(totalTipe(bulan, 'keluar'))}.`;
  if (/belum bayar|piutang|nunggak|telat|tagihan/.test(t) && !/sudah|udah|lunas/.test(t)) {
    const l = tagihanTerbuka(d);
    if (!l.length) return 'Tidak ada tagihan terbuka. Semua klien lunas.';
    return (
      `${l.length} tagihan terbuka, total ${rp(totalPiutang(d))}:\n` +
      l.slice(0, 8).map((i) => `• ${i.klien} — ${rp(i.sisa)} (${statusInv(i).t})`).join('\n')
    );
  }
  if (/laporan|rekap|ringkasan/.test(t)) {
    const m = totalTipe(bulan, 'masuk');
    const k = totalTipe(bulan, 'keluar');
    const pk: Record<string, number> = {};
    bulan.filter((x) => x.tipe === 'keluar').forEach((x) => (pk[x.kategori] = (pk[x.kategori] || 0) + x.nominal));
    const top = Object.entries(pk)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([k2, v]) => `• ${k2}: ${rp(v)}`)
      .join('\n');
    return `${bulanLabel(bulanIni())}\nMasuk ${rp(m)}\nKeluar ${rp(k)}\nSelisih ${rp(m - k)}${top ? '\n\nPengeluaran terbesar:\n' + top : ''}`;
  }
  return null;
}

export function otakOffline(teks: string, d: DataKeuangan): { balas: string; aksi: [] } {
  const q = jawabPertanyaan(teks, d);
  if (q) return { balas: q, aksi: [] };
  return {
    balas:
      'Tidak ada yang disimpan. Kirim ulang pesannya sebentar lagi, atau catat lewat tombol "Catat transaksi" di halaman Transaksi.',
    aksi: [],
  };
}
