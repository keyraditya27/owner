# Prompt Siap Tempel untuk Claude Code

Kerjakan berurutan. Setelah tiap tahap selesai, jalankan `npm run dev`, periksa hasilnya di browser, baru lanjut ke tahap berikutnya.

---

## Tahap 1 — Fondasi

```
Baca CLAUDE.md dan PRD.md dulu, lalu buat proyek Next.js 15 dengan TypeScript,
App Router, dan Tailwind CSS di folder ini.

Yang saya butuhkan di tahap ini:
1. Setup Supabase client — satu untuk browser (anon key), satu untuk server
   (service role key). Service role tidak boleh pernah terekspos ke browser.
2. Login dengan email dan password lewat Supabase Auth, plus halaman untuk
   pemilik menambahkan anggota tim.
3. Kerangka tata letak persis seperti prototipe arl-keuangan-v7.html:
   sidebar navy dengan logo ARL, area utama, panel chat di kanan.
4. Design token dari CLAUDE.md dimasukkan ke konfigurasi Tailwind, bukan
   ditulis ulang tiap komponen.
5. Halaman-halamannya masih kosong, cukup kerangka rute dan navigasinya.

Logo ada di folder logo/. Versi putih untuk latar navy.

Jelaskan struktur folder yang kamu rencanakan sebelum mulai menulis kode.
```

---

## Tahap 2 — Data dan halaman inti

```
Sekarang sambungkan ke database. schema.sql sudah saya jalankan di Supabase.

1. Buat tipe TypeScript dari skema itu.
2. Bangun halaman Ringkasan, Transaksi, dan Klien & Tagihan lengkap dengan
   sub-tab dan bar periode (Per Bulan / Per Tahun / Semua) seperti di prototipe.
3. Bar periode harus jadi state global — ganti sekali, semua halaman ikut.
4. Unggah bukti ke Supabase Storage bucket "bukti" yang private. Tampilkan
   lewat signed URL, jangan URL publik.
5. Setiap perubahan data menulis ke audit_log.

Semua logika perhitungan sudah ada di prototipe. Salin logikanya, jangan
menciptakan cara hitung baru.
```

---

## Impor data lama

```
File arl-keuangan-DATA.json adalah ekspor dari prototipe. Buat skrip sekali
jalan untuk mengimpornya ke Supabase.

Petanya:
- transaksi  → transaksi   (rekeningId → rekening_id, klienId → klien_id)
- klien      → klien, dan array tagihan di dalamnya → tabel tagihan
- vendor     → vendor, array utang di dalamnya → utang_vendor
- aset       → aset        (jenisAset → jenis, hargaPerolehan → harga_perolehan)
- pajak      → pajak
- rekening   → rekening
- perusahaan → perusahaan (perbarui baris yang sudah ada, jangan buat baru)

Bukti berupa data URL base64 di JSON — unggah ke Storage lalu simpan URL-nya.

Setelah selesai, cetak ringkasan: jumlah baris per tabel, total saldo kas,
total piutang, total utang. Saya akan cocokkan dengan angka di prototipe
sebelum melanjutkan.

Skrip harus idempoten — kalau dijalankan dua kali, tidak membuat data ganda.
```

---

## Tahap 3 — Chat AI dengan aksi

```
Bangun chat AI-nya. Acuan lengkap ada di prototipe pada bagian
"MESIN AI v2" — skema aksi, prompt sistem, dan eksekutornya.

Beda pentingnya dengan prototipe: semua panggilan ke Gemini lewat API route
di server. GEMINI_API_KEY tidak boleh pernah sampai ke browser.

1. POST /api/chat menerima teks dan opsional gambar bukti.
2. Server menyusun konteks data terkini dari database, menggabungkannya dengan
   prompt sistem, lalu memanggil Gemini.
3. Model memilih nama secara otomatis lewat ListModels, ambil Flash terbaru.
4. Validasi keluaran model sebelum dieksekusi: nominal integer positif, nama
   klien harus cocok dengan data yang ada, tanggal format YYYY-MM-DD. Kalau
   tidak valid, tolak aksinya dan sebutkan alasannya.
5. Jalankan aksi dalam satu transaksi database supaya tidak setengah jadi.
6. Simpan snapshot sebelum eksekusi untuk fungsi Batalkan.
7. Tampilkan kartu ringkasan perubahan dengan tombol Batalkan, seperti prototipe.

Jangan percaya keluaran model. Validasi di server adalah lapisan pertahanan,
bukan formalitas.
```

---

## Tahap 4 — Aset, pajak, laporan

```
Bangun tiga halaman sisanya, semuanya mengikuti prototipe:

Aset & Inventaris — sub-tab Aset Tetap, Inventaris, Penyusutan, Perlu Perhatian.
Penyusutan dihitung saat dibutuhkan, tidak disimpan. Rumus dan tabel kelompok
fiskal ada di CLAUDE.md.

Pajak — sub-tab Kewajiban, Kalkulator, PPh Badan, Panduan. Deadline mengikuti
PMK 81/2024.

Laporan — sub-tab Neraca, Laba Rugi, Arus Kas, Per Kategori. Dana titipan klien
wajib dikeluarkan dari pendapatan di laba rugi dan masuk sebagai kewajiban di
neraca.

Tambahkan ekspor CSV dan cetak ke PDF.
```

---

## Tahap 5 — Pengaman

```
Terakhir, lapisan kontrol:

1. Hak akses sesuai peran: pemilik akses penuh; admin sama kecuali menghapus
   perusahaan; staf hanya membuat dan mengubah transaksi miliknya, tidak bisa
   menghapus, tidak bisa melihat data gaji.
2. Tutup buku bulanan — periode tertutup terkunci, hanya pemilik yang bisa
   membukanya kembali. Trigger di database sudah ada, tinggal antarmukanya.
3. Halaman riwayat perubahan yang membaca audit_log, bisa disaring per pengguna
   dan per tanggal.
4. Persetujuan pengeluaran di atas Rp5 juta yang dibuat staf — masuk antrean,
   pemilik menyetujui atau menolak.
5. Backup otomatis: ekspor seluruh data ke JSON tiap minggu, simpan ke Storage.

Setelah selesai, tulis README singkat berisi cara menjalankan, cara menambah
anggota tim, dan cara memulihkan data dari backup.
```

---

## Tahap 6 — Sinkron Google Sheets

```
Bangun sinkron dua arah dengan Google Sheets. Baca integrasi-google-sheets.md
lengkap dulu — di situ ada struktur kolom, aturan bentrok, dan validasinya.

Ringkasnya:
1. Pakai googleapis dengan service account. Kredensial dari env, hanya di server.
2. Buat tab-tab yang belum ada saat sinkron pertama, lengkap dengan header.
3. Aplikasi ke sheet: antrean di tabel sinkron_antrean, dikosongkan tiap 30 detik
   lewat satu batchUpdate. Jangan satu panggilan per baris.
4. Sheet ke aplikasi: cron Vercel tiap 5 menit, plus tombol "Tarik dari Sheet"
   di aplikasi, plus otomatis saat halaman dibuka kalau sinkron terakhir sudah
   lebih dari 5 menit.
5. Validasi tiap baris dari sheet sebelum masuk database. Baris yang ditolak
   diberi latar merah di sheet dan alasannya ditulis di kolom Catatan.
6. Baris yang hilang dari sheet TIDAK menghapus data — tandai untuk ditinjau.
7. Bentrok diselesaikan dengan Diubah terbaru, yang kalah dicatat di
   sinkron_konflik dan muncul sebagai notifikasi.
8. Payroll dan karyawan tidak ikut disinkronkan.

Tabel sinkron_antrean, sinkron_log, dan sinkron_konflik ada di
schema-tambahan-sheets.sql — jalankan dulu di Supabase.

Setelah selesai, jalankan enam pengujian di bagian akhir
integrasi-google-sheets.md dan laporkan hasilnya satu per satu.
```

---

## Prompt darurat

Kalau hasilnya melenceng:

```
Berhenti dulu. Baca ulang CLAUDE.md dan PRD.md, lalu jelaskan apa yang
sedang kamu bangun dan kenapa, sebelum menulis kode lagi.
```

Kalau error berulang:

```
Jangan tambal gejalanya. Cari akar masalahnya, jelaskan ke saya apa yang
sebenarnya terjadi, baru perbaiki.
```

Kalau kode mulai berantakan:

```
Tinjau kode yang sudah ada. Mana yang duplikat, mana yang sebaiknya jadi
fungsi bersama? Rapikan dulu sebelum menambah fitur baru.
```
