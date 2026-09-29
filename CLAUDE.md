# ARL Keuangan Internal

Sistem keuangan internal PT Arah Ruang Langit (ARL), agensi performance marketing di Bandung.
Fokus klien: e-commerce growth di Shopee, TikTok Shop, dan Meta Ads.

## Konteks bisnis yang mempengaruhi kode

ARL berbentuk **PT**, bukan UMKM perorangan. Sejak PP 20/2026 (berlaku 22 April 2026), PT tidak bisa lagi memakai PPh final UMKM 0,5% — wajib pembukuan penuh dan PPh badan 22% dengan fasilitas Pasal 31E. Ini alasan sistem harus bisa menghasilkan neraca dan laba rugi, bukan sekadar catatan kas.

Tiga hal yang khas agensi dan sering salah dicatat:

1. **Dana titipan klien.** Budget iklan yang ditransfer klien adalah **kewajiban**, bukan pendapatan. Kategori `Ads budget titipan`. Kalau dicatat sebagai pendapatan, omzet menggelembung dan PPh badan ikut naik. Jangan pernah masukkan kategori ini ke perhitungan pendapatan di laba rugi.
2. **PPh 23 dipotong klien.** Klien berbentuk PT memotong 2% dari nilai jasa. Invoice Rp10 juta → masuk Rp9,8 juta. Selisihnya kredit pajak, bukan piutang macet. Harus ada kolom `pph23_dipotong` di tagihan dan tempat menyimpan bukti potong.
3. **Prive founder bukan beban.** Uang yang diambil Key dan Imam masuk kategori `Prive founder` — pengurang ekuitas, bukan biaya usaha. Dikeluarkan dari laba rugi dan ditampilkan terpisah di bawah baris laba. Kalau dicatat sebagai beban, laba terlihat kecil padahal usahanya sehat, dan saat pemeriksaan pajak pasti dikoreksi.
4. **Sedekah & donasi umum tidak bisa dikurangkan** saat menghitung pajak. Masuk koreksi fiskal positif, kecuali disalurkan ke badan yang ditunjuk pemerintah dengan bukti setor resmi.
5. **Batas kapitalisasi Rp5 juta.** Di atas itu jadi aset tetap yang disusutkan; di bawahnya dibebankan langsung tapi tetap masuk register inventaris.

Konstanta yang mengatur ini di prototipe: `BUKAN_BEBAN` dan `KOREKSI_FISKAL`. Pertahankan namanya.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase: Postgres, Auth, Storage (bucket `bukti`, private)
- Tailwind CSS
- Gemini API untuk chat AI (dipanggil dari **server**, bukan browser)
- Deploy ke Vercel
- PWA: bisa dipasang di HP dan desktop (manifest + service worker). Data keuangan **tidak** di-cache di perangkat — selalu diambil dari server supaya semua perangkat melihat angka yang sama.

## Aturan yang tidak boleh dilanggar

- **Kunci API tidak pernah menyentuh browser.** `GEMINI_API_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di API route atau server action.
- **Penyusutan dihitung, tidak disimpan.** Hitung dari data aset saat dibutuhkan. Kalau disimpan sebagai tabel, satu salah input menular ke semua periode.
- **Semua uang dalam rupiah bulat.** Simpan sebagai `bigint`, jangan `float`. Jangan pernah ada pecahan sen.
- **Tanggal disimpan sebagai `date`**, bukan timestamp, kecuali `created_at`/`updated_at`.
- **Setiap perubahan data masuk `audit_log`.** Siapa, kapan, tabel apa, nilai lama, nilai baru.
- **Periode yang sudah ditutup terkunci.** Setelah `tutup_buku` untuk suatu bulan, transaksi di bulan itu tidak bisa diubah tanpa membuka kembali.

## Bahasa

Seluruh antarmuka **bahasa Indonesia**. Nama variabel dan tabel juga bahasa Indonesia (`transaksi`, `klien`, `tagihan`, `aset`) supaya konsisten dengan istilah yang dipakai tim. Komentar kode boleh Indonesia.

Nada tulisan di antarmuka: langsung, tanpa jargon, tanpa basa-basi. Tidak pakai kata "Anda" — pakai kalimat tanpa subjek atau "kamu" bila perlu.

## Desain visual

Ikuti prototipe `arl-keuangan-v7.html` persis. Ringkasnya:

- Warna: navy `#0A2540`, biru `#1B6FE3`, horizon `#4FA3F7`, hijau `#0FB88F`, amber `#F5A623`, merah `#E5484D`, krem `#F5F7FA`, garis `#E3E9F0`
- Judul memakai serif **Cambria/Georgia**, isi memakai sans **Calibri/Segoe UI**
- Hero navy bergradien di tiap halaman, dengan logo ARL putih dan badge di kanan
- Kartu KPI bergaris atas berwarna sesuai kondisi
- Header tabel navy, baris zebra, baris total di footer
- Kotak insight berbatas kiri berwarna
- Bar periode (Per Bulan / Per Tahun / Semua) dan sub-tab di tiap halaman
- Angka memakai `font-variant-numeric: tabular-nums`

**Logo ARL wajib dipakai** — file di `logo/`. Versi putih untuk latar navy, versi gelap untuk latar terang. Jangan gambar ulang atau ganti dengan ikon lain.

## Struktur halaman

| Halaman | Sub-tab |
|---|---|
| Ringkasan | Ikhtisar · Kas & Rekening · Piutang Klien · Utang & Pajak |
| Transaksi | Semua · Masuk · Keluar · Tanpa Bukti |
| Klien & Tagihan | Semua Klien · Ada Tunggakan · Kontribusi |
| Aset & Inventaris | Aset Tetap · Inventaris · Penyusutan · Perlu Perhatian |
| Pajak | Kewajiban · Kalkulator · PPh Badan · Panduan |
| Laporan | Neraca · Laba Rugi · Arus Kas · Per Kategori |

Panel chat AI menempel di kanan, selalu terlihat. Di bawah 1080px (HP/tablet): sidebar jadi bilah atas + menu bawah, chat dibuka lewat tombol melayang sebagai layar penuh.

## Chat AI

Bukan chatbot pasif — dia mengubah data. Pola kerjanya:

1. Pengguna mengetik perintah biasa, boleh melampirkan foto bukti transfer.
2. Server mengirim ke Gemini bersama konteks data terkini dan daftar aksi yang tersedia.
3. Gemini membalas JSON: `{"balas": "...", "aksi": [{"aksi":"nama_aksi", ...}]}`.
4. Server memvalidasi lalu menjalankan aksinya di database.
5. Antarmuka menampilkan ringkasan perubahan dengan tombol Batalkan.

Daftar aksi ada di prototipe pada konstanta `SKEMA_AKSI`. Salin apa adanya.

Aturan penting: **validasi di server, jangan percaya keluaran model.** Nominal harus integer positif, nama klien harus cocok dengan data yang ada, tanggal harus format `YYYY-MM-DD`. Kalau tidak cocok, tolak aksinya dan katakan alasannya di balasan.

## Sinkron Google Sheets

Sheet `KEUANGAN ARL` (ID di env) adalah cermin dua arah dari database. Spesifikasi lengkap ada di `integrasi-google-sheets.md` — baca sebelum menyentuh bagian ini.

Empat aturan yang tidak boleh dilanggar:

1. **Tulis ke sheet lewat antrean, bukan langsung.** Gabungkan jadi satu `batchUpdate` tiap 30 detik. Kuota Sheets API 60 permintaan per menit.
2. **Baris yang hilang dari sheet tidak menghapus data.** Tandai untuk ditinjau. Satu salah klik di spreadsheet tidak boleh menghapus pembukuan.
3. **Validasi setiap baris yang masuk dari sheet.** Nominal, tanggal, kategori, klien, rekening. Baris yang ditolak diberi latar merah dan alasannya ditulis di kolom Catatan — jangan dibuang diam-diam.
4. **Data gaji dan payroll tidak pernah masuk sheet.** Sheet bisa dibuka siapa saja yang punya tautan.

Bentrok diselesaikan dengan timestamp `Diubah` terbaru, dan yang kalah dicatat di `sinkron_konflik` supaya bisa ditinjau manusia.

## Penyusutan fiskal

Pasal 11 UU PPh jo. PMK 72/2023:

| Kelompok | Masa manfaat | Garis lurus | Saldo menurun |
|---|---|---|---|
| 1 | 4 tahun | 25% | 50% |
| 2 | 8 tahun | 12,5% | 25% |
| 3 | 16 tahun | 6,25% | 12,5% |
| 4 | 20 tahun | 5% | 10% |
| Bangunan permanen | 20 tahun | 5% | tidak boleh |
| Bangunan tidak permanen | 10 tahun | 10% | tidak boleh |

Penyusutan mulai dari bulan perolehan. Bangunan hanya boleh garis lurus.

## Kalender pajak (PMK 81/2024)

- Setor: tanggal 15 bulan berikutnya
- Lapor SPT Masa PPh: tanggal 20
- Lapor SPT Masa PPN: akhir bulan berikutnya
- SPT Tahunan Badan: 30 April

Tarif: PPN efektif 11% jasa nonmewah · PPh 23 jasa 2% (4% tanpa NPWP) · PPh 4(2) sewa 10% final · PPh badan 22% dengan Pasal 31E.

## Tim

Key (pemilik, akses penuh) · Tasya, Caca, Ipii (tim marketing). Rencana hak akses: pemilik bisa semuanya; staf hanya bisa membuat dan mengubah transaksi miliknya sendiri, tidak bisa menghapus, tidak bisa melihat gaji.

## Cara kerja yang saya harapkan

- Jelaskan rencana sebelum menulis kode untuk perubahan besar.
- Satu tahap satu fokus. Jangan menambah fitur yang tidak diminta.
- Kalau ada dua cara dan bedanya penting, tanyakan dulu.
- Kalau saya salah atau permintaan saya bermasalah, katakan. Jangan diiyakan saja.
