import 'server-only';

/**
 * Skema aksi, konteks data, dan prompt sistem — disalin dari bagian
 * "MESIN AI v2" di prototipe v7 (SKEMA_AKSI, konteksSingkat, instruksiSistem).
 */
import { KATEGORI_KELUAR, KATEGORI_MASUK } from '@/lib/konstanta';
import {
  pajakBelumSetor,
  saldoRekening,
  sisaTagihan,
  totalKas,
  totalPiutang,
  totalUtang,
  urutTerbaru,
  type DataKeuangan,
} from '@/lib/hitung';
import type { Aset } from '@/lib/tipe-db';

/* ---------- daftar aksi yang boleh dijalankan AI (salinan apa adanya) ---------- */
export const SKEMA_AKSI = `
transaksi_baru      {tipe:"masuk|keluar", nominal:int, kategori:str, klien:str?, rekening:str?, tanggal:"YYYY-MM-DD", keterangan:str, metode:str?}
transaksi_ubah      {cari:str, nominal:int?, tanggal:str?, kategori:str?, klien:str?, keterangan:str?, rekening:str?}
transaksi_hapus     {cari:str}
tagihan_lunas       {klien:str, periode:str?, nominal:int?, tanggal:"YYYY-MM-DD"?, catatTransaksi:bool?}
tagihan_baru        {klien:str, periode:str, nominal:int, jatuhTempo:"YYYY-MM-DD"?}
klien_baru          {nama:str, pic:str?, wa:str?, paket:str?, nilai:int?, tanggalTagih:int?, tempoHari:int?}
klien_ubah          {nama:str, pic:str?, wa:str?, paket:str?, nilai:int?}
vendor_baru         {nama:str, jenis:str?, wa:str?, npwp:bool?}
utang_baru          {vendor:str, keterangan:str, nominal:int, jatuhTempo:"YYYY-MM-DD"?}
utang_bayar         {vendor:str, nominal:int?, catatTransaksi:bool?}
aset_baru           {nama:str, kategori:str?, hargaPerolehan:int, tglPerolehan:str?, kelompok:"1|2|3|4|bp|bnp"?, penanggungJawab:str?, jenisAset:"tetap|inventaris"?}
aset_ubah           {nama:str, kondisi:str?, status:str?, penanggungJawab:str?, lokasi:str?}
pajak_setor         {jenisPajak:"PPh 21|PPh 23|PPh 4(2)|PPN Keluaran|PPh 25", periode:"YYYY-MM"?, tanggal:str?, ntpn:str?}
pajak_baru          {jenisPajak:str, periode:"YYYY-MM", dpp:int?, nominal:int}
rekening_baru       {nama:str, jenis:"Bank|Kas|E-wallet"?, bank:str?, saldoAwal:int?}
`;

export function konteksSingkat(d: DataKeuangan, aset: Aset[], hariIni: string) {
  return {
    hariIni,
    saldoKas: totalKas(d),
    rekening: d.rekening.map((r) => ({ nama: r.nama, jenis: r.jenis, saldo: saldoRekening(d, r.id) })),
    klien: d.klien.map((k) => ({
      nama: k.nama,
      pic: k.pic,
      paket: k.paket,
      nilaiBulanan: k.nilai_bulanan,
      tagihanTerbuka: d.tagihan
        .filter((i) => i.klien_id === k.id && sisaTagihan(i) > 0)
        .map((i) => ({ periode: i.periode, nilai: i.nominal, dibayar: i.dibayar, sisa: sisaTagihan(i), jatuhTempo: i.jatuh_tempo })),
    })),
    vendor: d.vendor.map((v) => ({
      nama: v.nama,
      jenis: v.jenis,
      utangTerbuka: d.utang
        .filter((u) => u.vendor_id === v.id && u.nominal - u.dibayar > 0)
        .map((u) => ({ ket: u.keterangan, sisa: u.nominal - u.dibayar, jatuhTempo: u.jatuh_tempo })),
    })),
    aset: aset.map((a) => ({ nama: a.nama, kode: a.kode, kondisi: a.kondisi, status: a.status, pj: a.penanggung_jawab })),
    pajakBelumSetor: pajakBelumSetor(d).map((p) => ({ jenis: p.jenis, periode: p.periode, nominal: p.nominal })),
    totalPiutang: totalPiutang(d),
    totalUtangVendor: totalUtang(d),
    transaksiTerakhir: urutTerbaru(d.transaksi)
      .slice(0, 8)
      .map((t) => ({ tgl: t.tanggal, tipe: t.tipe, nominal: t.nominal, ket: t.keterangan, kategori: t.kategori })),
  };
}

export function instruksiSistem(d: DataKeuangan, aset: Aset[], hariIni: string) {
  return `Kamu asisten keuangan internal ${d.namaPerusahaan}, agensi performance marketing di Bandung.
Kamu BUKAN chatbot pasif — kamu mengubah data pembukuan sesuai perintah pengguna.

Balas HANYA satu objek JSON, tanpa markdown, tanpa penjelasan di luar JSON:
{"balas":"<1-3 kalimat bahasa Indonesia santai, langsung ke inti>","aksi":[ ... ]}

Aksi yang tersedia (pakai persis nama field-nya):
${SKEMA_AKSI}
Setiap aksi berbentuk {"aksi":"<nama aksi>", ...field}. Kalau tidak ada yang perlu diubah, "aksi" boleh array kosong.

ATURAN:
- Nominal selalu angka bulat rupiah. "500rb"=500000, "1,5jt"=1500000, "8,5 juta"=8500000.
- Nama klien/vendor/aset ditulis apa adanya; sistem yang mencocokkan ke data.
- "klien X sudah bayar" / "X udah transfer" → jenis "tagihan_lunas". Tagihan tertua yang dipotong. catatTransaksi default true (otomatis membuat transaksi uang masuk).
- Kalau pengguna menyebut nominal lebih kecil dari sisa tagihan, itu pembayaran sebagian — tetap pakai tagihan_lunas dengan nominal tersebut.
- Kalimat pengeluaran/pemasukan biasa → "transaksi_baru". Tebak kategori dari daftar berikut.
  Kategori masuk: ${KATEGORI_MASUK.join(', ')}.
  Kategori keluar: ${KATEGORI_KELUAR.join(', ')}.
- Budget iklan yang DITITIPKAN klien masuk kategori "Ads budget titipan", bukan pendapatan.
- Kalau ada gambar bukti transfer, ambil nominal dan tanggal dari gambar. Gambar mengalahkan teks.
- Untuk koreksi ("bukan 500rb tapi 750rb", "hapus yang tadi") pakai transaksi_ubah / transaksi_hapus dengan "cari" berisi potongan keterangan yang khas.
- Kalau pengguna hanya bertanya (saldo, siapa belum bayar, rekap), jawab di "balas" dengan angka dari konteks, dan biarkan "aksi" kosong.
- Jangan mengarang data yang tidak ada di konteks. Kalau nama klien tidak dikenali, katakan di "balas" dan jangan buat aksi.
- Ringkas. Jangan basa-basi, jangan minta maaf berlebihan.

CONTOH:
"EZCAT sudah bayar" → {"balas":"EZCAT ditandai lunas dan uang masuknya dicatat.","aksi":[{"aksi":"tagihan_lunas","klien":"EZCAT"}]}
"bayar iklan meta batik ayman 750rb" → {"balas":"Dicatat, Rp750.000 keluar untuk Meta Ads Batik Ayman.","aksi":[{"aksi":"transaksi_baru","tipe":"keluar","nominal":750000,"kategori":"Ads spend","klien":"Batik Ayman","keterangan":"Meta Ads Batik Ayman","tanggal":"${hariIni}"}]}
"yang top up shopee tadi bukan 4,2jt tapi 4,5jt" → {"balas":"Sudah dikoreksi jadi Rp4.500.000.","aksi":[{"aksi":"transaksi_ubah","cari":"top up shopee","nominal":4500000}]}
"pph 23 agustus udah disetor" → {"balas":"Ditandai sudah setor.","aksi":[{"aksi":"pajak_setor","jenisPajak":"PPh 23"}]}
"siapa belum bayar?" → {"balas":"<daftar dari konteks>","aksi":[]}

Hari ini ${hariIni}.
KONTEKS DATA SAAT INI:
${JSON.stringify(konteksSingkat(d, aset, hariIni))}`;
}

/** Ambil objek JSON dari balasan model (kadang dibungkus ```json). */
export function ambilJSON(raw: string): { balas?: unknown; aksi?: unknown } {
  const t = raw.replace(/```json|```/g, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Balasan AI bukan JSON');
  return JSON.parse(t.slice(a, b + 1));
}
