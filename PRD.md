# Sistem Keuangan PT Arah Ruang Langit

Dokumen ini menjelaskan cara menata keuangan ARL sebagai badan hukum PT, apa yang sudah ada di prototipe, dan apa yang perlu dibangun saat pindah ke Claude Code.

Disusun 3 September 2026. Aturan pajak yang dikutip berlaku per tanggal tersebut — sebelum dipakai untuk pelaporan resmi, konfirmasi ulang ke konsultan pajak.

---

## 1. Kenapa PT beda dari pencatatan UMKM

Sejak PP 20/2026 (berlaku 22 April 2026), skema PPh final UMKM 0,5% dipersempit: hanya untuk orang pribadi, perseroan perorangan, dan koperasi. PT yang baru terdaftar tidak bisa lagi memakainya. PT yang sudah memakai sebelumnya boleh melanjutkan sampai jatah waktunya habis (maksimal 3 tahun pajak sejak PP 23/2018).

Konsekuensinya untuk ARL:

- **Wajib pembukuan penuh**, bukan sekadar catatan omzet. Neraca dan laba rugi harus bisa disusun.
- **PPh badan dihitung dari laba fiskal**, tarif 22%. Ada fasilitas Pasal 31E: potongan 50% atas bagian laba yang proporsional dengan omzet sampai Rp4,8 miliar. Untuk omzet di bawah Rp4,8 miliar, tarif efektifnya 11%.
- **Setiap beban harus punya bukti sah.** Beban tanpa bukti akan dikoreksi saat pemeriksaan dan menaikkan pajak terutang.
- **Harta perusahaan harus terdaftar.** Aset tetap masuk neraca dan penyusutannya jadi pengurang penghasilan — kalau tidak dicatat, ARL kehilangan pengurang pajak yang sah.

---

## 2. Yang kurang dari versi sebelumnya, dan sudah ditambahkan

| Kekurangan | Kenapa penting untuk PT | Status |
|---|---|---|
| Saldo kas jadi satu angka | Tidak bisa direkonsiliasi dengan mutasi bank | Ditambah: multi rekening |
| Dana titipan klien dihitung sebagai pendapatan | Menggelembungkan omzet dan pajak | Ditambah: dicatat sebagai kewajiban |
| Tidak ada aset tetap | Kehilangan pengurang pajak dari penyusutan | Ditambah: register + penyusutan fiskal |
| Tidak ada inventaris | Barang hilang tanpa jejak pemegang | Ditambah: register non-kapitalisasi |
| Tidak ada utang vendor | Fee KOL dan sewa terlupa | Ditambah: vendor + jatuh tempo |
| Tidak ada kewajiban pajak | Telat setor kena sanksi | Ditambah: tracker + kalkulator |
| Tidak ada neraca dan laba rugi | Tidak bisa lapor SPT Tahunan Badan | Ditambah: neraca ringkas + L/R akrual |
| PPh 23 yang dipotong klien tidak tercatat | Kredit pajak hangus | Ditambah: catatan + kalkulator |

### Yang masih perlu dibangun di Claude Code

1. **Pembukuan berpasangan (double-entry) dengan chart of accounts.** Prototipe ini menyusun neraca secara ringkas dari saldo-saldo turunan. Untuk audit dan SPT Tahunan yang benar, perlu jurnal umum dan buku besar dengan COA standar.
2. **Payroll.** Daftar karyawan, komponen gaji, BPJS Kesehatan dan Ketenagakerjaan, PPh 21 dengan tarif efektif rata-rata (TER) bulanan dan perhitungan tahunan di Desember.
3. **Faktur pajak dan e-Bupot.** Kalau ARL naik status jadi PKP, perlu penomoran faktur dan integrasi ke Coretax.
4. **Rekonsiliasi bank otomatis.** Impor mutasi CSV dari bank, cocokkan dengan transaksi tercatat.
5. **Anggaran vs realisasi** per klien dan per pos beban.
6. **Multi-user dengan hak akses dan audit log.** Siapa mengubah apa dan kapan — wajib kalau Tasya, Caca, atau Ipii ikut input.
7. **Tutup buku bulanan.** Periode yang sudah ditutup dikunci supaya angka laporan tidak berubah setelah dikirim.

---

## 3. Aset tetap: cara menatanya

### Batas kapitalisasi

Tentukan satu angka lalu konsisten. Untuk agensi seukuran ARL, **Rp5 juta** wajar.

- **Di atas Rp5 juta** → aset tetap. Dikapitalisasi ke neraca, disusutkan bertahun-tahun.
- **Di bawah Rp5 juta** → dibebankan langsung di bulan pembelian, tapi tetap masuk daftar inventaris.

Alasannya sederhana: laptop Rp32 juta yang dipakai 4 tahun tidak masuk akal dibebankan sekaligus di satu bulan — laba bulan itu akan terlihat anjlok padahal tidak. Sebaliknya, headset Rp300 ribu tidak perlu dihitung penyusutannya tiap bulan selama 4 tahun.

### Kelompok penyusutan fiskal

Mengikuti Pasal 11 UU PPh jo. PMK 72/2023:

| Kelompok | Masa manfaat | Garis lurus | Saldo menurun | Contoh di ARL |
|---|---|---|---|---|
| Kelompok 1 | 4 tahun | 25%/th | 50%/th | Laptop, kamera, HP, lighting, printer |
| Kelompok 2 | 8 tahun | 12,5%/th | 25%/th | Meja kursi kantor, AC, kendaraan |
| Kelompok 3 | 16 tahun | 6,25%/th | 12,5%/th | Mesin berat (jarang di agensi) |
| Kelompok 4 | 20 tahun | 5%/th | 10%/th | Alat berat (tidak relevan) |
| Bangunan permanen | 20 tahun | 5%/th | — | Kalau ARL beli ruko |
| Bangunan tidak permanen | 10 tahun | 10%/th | — | Bangunan semi permanen |

Bangunan **hanya boleh garis lurus**. Aset selain bangunan boleh pilih garis lurus atau saldo menurun. Penyusutan dimulai dari bulan perolehan.

Saran untuk ARL: **pakai garis lurus untuk semuanya.** Lebih mudah dijelaskan ke pemeriksa pajak, dan bedanya hanya soal timing, total bebannya sama.

### Kode aset

Pakai pola `ARL-[KATEGORI]-[NOMOR]`:

- `ARL-LT-001` — laptop
- `ARL-CAM-001` — kamera
- `ARL-FUR-001` — furnitur
- `ARL-KND-001` — kendaraan
- `ARL-INV-001` — inventaris non-kapitalisasi

Tempel stiker kode fisik di barangnya. Tanpa ini, stock opname tahunan jadi tebak-tebakan.

### Field wajib per aset

Kode, nama, kategori, kelompok fiskal, tanggal perolehan, harga perolehan, nilai residu, metode penyusutan, lokasi, penanggung jawab, kondisi, status, catatan (serial number, garansi).

**Penanggung jawab adalah field yang paling sering diabaikan dan paling sering disesali.** Saat ada yang resign, tanpa data ini tidak ada yang tahu laptop mana yang harus dikembalikan.

### Siklus hidup aset

1. **Perolehan** — catat transaksi pembelian, buat entri aset, tempel kode.
2. **Penggunaan** — penyusutan berjalan otomatis tiap bulan.
3. **Perpindahan** — ubah penanggung jawab saat barang pindah tangan, catat tanggalnya.
4. **Perbaikan** — ubah kondisi jadi "Perlu perbaikan". Biaya perbaikan rutin dibebankan; peningkatan kapasitas besar dikapitalisasi menambah harga perolehan.
5. **Pelepasan** — ubah status jadi "Dilepas", isi tanggal dan harga jual. Selisih harga jual dengan nilai buku jadi laba atau rugi pelepasan aset. Kalau hilang, status "Hilang" dan nilai bukunya jadi kerugian.

### Stock opname

Lakukan **dua kali setahun**, minimal sekali sebelum tutup buku. Cetak daftar aset dari sistem, cek fisik satu per satu, tandai yang tidak ditemukan. Selisihnya harus dijelaskan, bukan dihapus diam-diam.

---

## 4. Aset lancar: cara menatanya

Aset lancar adalah harta yang berputar dalam satu tahun. Untuk ARL ada empat pos:

### Kas dan setara kas

Pisahkan minimal tiga rekening:

1. **Operasional** — gaji, sewa, tools, penerimaan retainer.
2. **Budget klien** — khusus dana titipan iklan. Ini yang paling penting.
3. **Kas kecil** — pengeluaran harian tunai.

Alasan memisahkan rekening budget klien: saldo gabungan bisa terlihat Rp80 juta padahal Rp50 juta di antaranya milik klien untuk dibelanjakan iklan. Kalau tercampur, ARL bisa merasa mampu bayar gaji padahal sedang memakai uang klien. Ini masalah kas dan sekaligus masalah kepercayaan.

### Piutang usaha

Tagihan klien yang belum dibayar. Sudah ada di modul Klien & Tagihan. Yang perlu ditambahkan saat serius:

- **Umur piutang (aging)**: 0–30 hari, 31–60, 61–90, di atas 90.
- **Cadangan kerugian piutang** untuk yang di atas 90 hari, supaya laba tidak terlihat lebih besar dari kenyataan.

### Beban dibayar di muka

Langganan tahunan (Canva, Figma, hosting, domain), sewa kantor tahunan, asuransi. Dibayar sekali untuk 12 bulan, tapi bebannya dibagi rata per bulan. Kalau tidak dipisah, bulan pembayaran terlihat rugi dan sebelas bulan berikutnya terlihat terlalu untung.

### Persediaan

Untuk agensi biasanya kecil, tapi ada kalau ARL menyimpan merchandise, sampel produk klien, atau properti konten yang dibeli untuk dijual kembali. Kalau volumenya kecil, cukup dicatat sebagai inventaris. Kalau mulai berputar, perlu kartu stok dengan metode FIFO atau rata-rata.

---

## 5. Kewajiban: yang mudah terlupa

### Dana titipan klien

**Ini bukan pendapatan ARL.** Budget iklan yang ditransfer klien adalah kewajiban sampai dibelanjakan. Kalau dicatat sebagai pendapatan:

- Omzet terlihat lebih besar dari kenyataan.
- PPh badan jadi lebih besar.
- Kalau ARL naik jadi PKP, PPN yang dipungut jadi salah.

Pencatatan yang benar: uang masuk → kategori "Ads budget titipan" (liabilitas). Saat dibelanjakan → "Ads spend" atas nama klien tersebut. Yang jadi pendapatan ARL hanya management fee-nya.

### Utang usaha

Fee KOL, honor freelancer, sewa studio, tools yang ditagih di belakang. Catat saat tagihan diterima, bukan saat dibayar.

### Utang pajak

Pajak yang sudah dipotong tapi belum disetor. Uang ini ada di rekening ARL tapi bukan milik ARL.

---

## 6. Kalender pajak bulanan

Berdasarkan PMK 81/2024, batas setor sudah diseragamkan:

| Kewajiban | Setor | Lapor |
|---|---|---|
| PPh 21 (gaji karyawan) | tanggal 15 bulan berikutnya | tanggal 20 |
| PPh 23 (jasa vendor) | tanggal 15 | tanggal 20 (SPT Masa Unifikasi) |
| PPh 4(2) (sewa) | tanggal 15 | tanggal 20 (SPT Masa Unifikasi) |
| PPh 25 (angsuran badan) | tanggal 15 | — |
| PPN (kalau PKP) | tanggal 15 | akhir bulan berikutnya |
| SPT Tahunan Badan | — | 30 April |

Kalau jatuh di hari libur, mundur ke hari kerja berikutnya.

### Tarif yang relevan

- **PPN**: efektif 11% untuk jasa nonmewah. Secara hukum tarifnya 12%, tapi DPP-nya 11/12 dari nilai penggantian (PMK 131/2024), jadi hasilnya 11%. Berlaku sejak 1 Januari 2025 dan tidak berubah di 2026.
- **PPh 23 jasa**: 2% dari bruto untuk vendor ber-NPWP, 4% kalau tidak ber-NPWP.
- **PPh 4(2) sewa tanah/bangunan**: final 10%.
- **PPh badan**: 22%, dengan fasilitas Pasal 31E.

### Yang paling sering merugikan agensi

Klien berbentuk PT akan **memotong PPh 23 sebesar 2%** dari nilai jasa ARL. Invoice Rp10 juta, yang masuk rekening Rp9,8 juta. Selisih Rp200 ribu itu bukan piutang macet — itu kredit pajak yang mengurangi PPh badan ARL di akhir tahun, **asal bukti potongnya dikumpulkan**.

Kalau bukti potong tidak dikumpulkan, ARL kehilangan uang itu dua kali: sudah dipotong, tapi tidak bisa dikreditkan. Buat aturan internal: setiap pembayaran klien yang kurang dari nilai invoice, tagih bukti potongnya sebelum bulan berikutnya.

---

## 7. Struktur data untuk Claude Code

```
perusahaan   : nama, npwp, pkp, alamat, modal_disetor, batas_kapitalisasi, tahun_buku
akun         : kode, nama, tipe (aset/liabilitas/ekuitas/pendapatan/beban), induk
rekening     : nama, jenis, bank, no_rek, saldo_awal, akun_id
transaksi    : tanggal, tipe, nominal, kategori, akun_debit, akun_kredit,
               klien_id, vendor_id, rekening_id, ppn, pph_dipotong,
               keterangan, bukti_url, sumber, dibuat_oleh, dibuat_pada
klien        : nama, pic, wa, npwp, paket, nilai_bulanan, tanggal_tagih, tempo_hari
tagihan      : klien_id, nomor_invoice, periode, nominal, ppn, pph23_dipotong,
               dibayar, tgl_invoice, jatuh_tempo, status, bukti_potong_url
vendor       : nama, jenis, wa, npwp, catatan
utang_vendor : vendor_id, keterangan, nominal, dibayar, jatuh_tempo
aset         : kode, nama, kategori, jenis_aset, kelompok_fiskal, tgl_perolehan,
               harga_perolehan, nilai_residu, metode, lokasi, penanggung_jawab,
               kondisi, status, tgl_lepas, nilai_jual, qty, catatan
mutasi_aset  : aset_id, tanggal, jenis (pindah/perbaikan/opname), dari, ke, catatan
pajak        : periode, jenis, dpp, tarif, nominal, tgl_setor, ntpn, tgl_lapor, bukti_url
karyawan     : nama, posisi, npwp, ptkp, gaji_pokok, tunjangan, bpjs_kes, bpjs_tk
payroll      : karyawan_id, periode, bruto, potongan, pph21, netto, tgl_bayar
audit_log    : user_id, tabel, record_id, aksi, nilai_lama, nilai_baru, waktu
```

Penyusutan **jangan disimpan sebagai tabel**. Hitung dari data aset saat dibutuhkan — kalau disimpan, sekali salah input akan menular ke semua periode dan sulit dikoreksi.

---

## 8. Urutan pembangunan yang disarankan

**Tahap 1 — pindahkan yang sudah ada**
Database, autentikasi, penyimpanan bukti ke object storage, AI parsing dipindah ke backend supaya API key aman.

**Tahap 2 — kepatuhan dasar**
Chart of accounts, jurnal berpasangan, neraca dan laba rugi yang benar, tutup buku bulanan.

**Tahap 3 — pajak**
Payroll dengan PPh 21 TER, bukti potong PPh 23 dari klien, kalender pajak dengan pengingat, ekspor untuk konsultan pajak.

**Tahap 4 — kontrol**
Multi-user dengan hak akses, audit log, alur persetujuan pengeluaran di atas nominal tertentu, rekonsiliasi bank.

Jangan dibalik. Membangun fitur canggih di atas pembukuan yang belum benar hanya memperbanyak angka yang salah.
