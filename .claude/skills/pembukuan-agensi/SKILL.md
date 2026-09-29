---
name: pembukuan-agensi
description: Aturan pembukuan dan pajak PT Arah Ruang Langit sebagai agensi performance marketing berbentuk PT — dana titipan iklan klien, PPh 23 yang dipotong klien, prive founder, koreksi fiskal, kapitalisasi aset, penyusutan fiskal, kalender dan tarif pajak. Pakai setiap kali menghitung, mencatat, menganalisis, atau melaporkan angka keuangan ARL (laba rugi, neraca, invoice, arus kas, PPh badan), termasuk saat menulis kode yang mengolah angka itu.
---

# Pembukuan agensi ARL

ARL berbentuk **PT**, bukan UMKM perorangan. Sejak PP 20/2026 (berlaku 22 April 2026), PT tidak bisa lagi memakai PPh final UMKM 0,5% — wajib pembukuan penuh dan **PPh badan 22%** dengan fasilitas **Pasal 31E**. Karena itu laporan harus bisa sampai neraca dan laba rugi, bukan sekadar catatan kas.

> Aturan pajak berubah. Sebelum dipakai untuk pelaporan resmi, cocokkan dengan konsultan pajak. Yang di sini adalah pegangan kerja tim, bukan nasihat pajak.

## Lima hal yang khas agensi dan sering salah dicatat

1. **Dana titipan klien = kewajiban, bukan pendapatan.**
   Budget iklan yang ditransfer klien untuk dibelanjakan ke Shopee/TikTok/Meta dicatat di kategori `Ads budget titipan`. Jangan pernah masuk ke pendapatan di laba rugi — omzet menggelembung dan PPh badan ikut naik. Belanja iklan dari dana itu mengurangi kewajiban, bukan beban ARL. Idealnya ditampung di rekening terpisah (Mandiri Budget Klien).

2. **PPh 23 dipotong klien = kredit pajak, bukan piutang macet.**
   Klien berbentuk PT memotong **2%** dari nilai jasa (4% kalau ARL tidak ber-NPWP). Invoice Rp10.000.000 → masuk Rp9.800.000. Selisih Rp200.000 adalah kredit pajak yang mengurangi PPh badan terutang. Catat di kolom `pph23_dipotong` tagihan dan **kejar bukti potongnya** — tanpa bukti potong, kreditnya tidak bisa diklaim.
   Sisa tagihan = nominal − dibayar − PPh 23 dipotong.

3. **Prive founder bukan beban.**
   Uang yang diambil Key dan Imam masuk kategori `Prive founder` — pengurang ekuitas. Dikeluarkan dari laba rugi dan ditampilkan terpisah **di bawah** baris laba. Kalau dicatat sebagai beban, laba terlihat kecil padahal usahanya sehat, dan saat pemeriksaan pajak pasti dikoreksi.

4. **Sedekah & donasi umum tidak bisa dikurangkan.**
   Tetap dicatat sebagai pengeluaran, tapi masuk **koreksi fiskal positif** saat menghitung PPh badan — kecuali disalurkan ke badan yang ditunjuk pemerintah dengan bukti setor resmi.

5. **Batas kapitalisasi Rp5.000.000.**
   Pembelian barang di atas Rp5 juta jadi **aset tetap** yang disusutkan. Di bawahnya dibebankan langsung, tapi tetap dicatat di register inventaris.

Nama konstanta di kode: `BUKAN_BEBAN = ['Prive founder']` dan `KOREKSI_FISKAL = ['Sedekah & donasi', 'Prive founder']`. Pertahankan namanya.

## Kategori transaksi

- **Masuk:** Retainer klien · Project fee · Ads budget titipan (kewajiban) · Bonus/insentif · Lain-lain
- **Keluar:** Ads spend · Gaji & fee tim · Komisi KOL/affiliate · Tools & langganan · Operasional kantor · Produksi konten · Prive founder (bukan beban) · Sedekah & donasi (koreksi fiskal) · Pajak · Lain-lain

Data **Gaji & fee tim** hanya untuk pemilik — jangan masuk laporan yang dibagikan ke tim atau klien.

## Penyusutan fiskal (Pasal 11 UU PPh jo. PMK 72/2023)

| Kelompok | Masa manfaat | Garis lurus | Saldo menurun |
|---|---|---|---|
| 1 | 4 tahun | 25% | 50% |
| 2 | 8 tahun | 12,5% | 25% |
| 3 | 16 tahun | 6,25% | 12,5% |
| 4 | 20 tahun | 5% | 10% |
| Bangunan permanen | 20 tahun | 5% | tidak boleh |
| Bangunan tidak permanen | 10 tahun | 10% | tidak boleh |

- Mulai disusutkan dari **bulan perolehan**. Bangunan hanya garis lurus.
- Laptop, kamera, HP kerja umumnya kelompok 1.
- **Penyusutan dihitung, tidak disimpan.** Hitung dari harga perolehan, tanggal, kelompok, dan metode setiap kali dibutuhkan. Kalau disimpan per periode, satu salah input menular ke semua periode.

## Tarif & kalender (PMK 81/2024)

| Pajak | Tarif |
|---|---|
| PPN jasa nonmewah | efektif 11% |
| PPh 23 jasa | 2% (4% tanpa NPWP) |
| PPh 4(2) sewa | 10% final |
| PPh badan | 22%, dengan fasilitas Pasal 31E |

- Setor: tanggal **15** bulan berikutnya
- Lapor SPT Masa PPh: tanggal **20**
- Lapor SPT Masa PPN: **akhir** bulan berikutnya
- SPT Tahunan Badan: **30 April**

## Susunan laba rugi yang benar

```
Pendapatan jasa (Retainer + Project fee + Bonus)   ← TANPA Ads budget titipan
− Beban usaha (semua keluar KECUALI Prive founder)
= Laba sebelum pajak (komersial)
+ Koreksi fiskal positif (Sedekah & donasi umum)
= Penghasilan kena pajak → PPh badan 22% (Pasal 31E) − kredit PPh 23
─────────────
Prive founder  ← ditampilkan terpisah, di bawah laba
```

## Aturan data

- Uang dalam **rupiah bulat** — simpan sebagai integer (`bigint`), tidak pernah float, tidak ada sen.
- Tanggal transaksi disimpan sebagai `date`, bukan timestamp.
- Setiap perubahan data keuangan dicatat (siapa, kapan, nilai lama, nilai baru).
- Periode yang sudah **tutup buku** tidak diubah tanpa dibuka kembali oleh pemilik.
