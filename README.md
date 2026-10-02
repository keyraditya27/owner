# ARL Keuangan Internal

Sistem keuangan internal PT Arah Ruang Langit. Bisa dibuka dari browser di desktop maupun HP, dan bisa **dipasang di HP seperti aplikasi** (PWA). Semua perangkat membaca database yang sama di Supabase, jadi data yang dicatat di HP langsung terlihat di desktop.

Konteks bisnis dan aturan kode ada di `CLAUDE.md`. Urutan pembangunan ada di `prompt-tahap.md`.

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Fondasi: Next.js, login, halaman Tim, kerangka tata letak, PWA | ✅ |
| 2 | Ringkasan, Transaksi, Klien & Tagihan + bar periode | ✅ |
| — | Impor data Juni–September | ✅ skrip siap (`npm run impor`) |
| 3 | Chat AI dengan aksi (NVIDIA atau Gemini, lewat server) | ✅ |
| 4 | Aset & Inventaris, Pajak, Laporan + CSV & cetak PDF | ✅ |
| 5 | Hak akses, tutup buku, riwayat, persetujuan, backup | ✅ |
| 6 | Sinkron Google Sheets dua arah | ✅ |

## Menyiapkan database (sekali saja)

Di Supabase → SQL Editor, jalankan berurutan:

1. `schema.sql`
2. `schema-tambahan-sheets.sql`
3. `schema-perbaikan-tahap1.sql` — **wajib**. Tanpa ini tidak ada yang bisa membaca profilnya sendiri (login ditolak) dan staf tidak bisa membaca data apa pun.
4. `schema-tahap2.sql` — **wajib**. Isinya: audit log otomatis untuk semua tabel, bucket `bukti` (privat), dan dua perbaikan: staf tidak bisa mencatat transaksi karena pemicu antrean sheet, dan kunci tutup buku yang bisa diakali dengan mengganti tanggal.

5. `schema-tahap3.sql` — fungsi yang menjalankan perubahan dari chat AI dalam **satu transaksi** (semua atau tidak sama sekali) dan tombol **Batalkan**.
6. `schema-tahap5.sql` — hak akses per peran, tutup buku, antrean persetujuan pengeluaran, bucket `backup`.
7. `schema-tahap6.sql` — sinkron Google Sheets: kolom Catatan di transaksi, sidik baris, kunci supaya hanya satu sinkron berjalan, dan perbaikan pemicu antrean (versi lama berhenti mengantre perubahan aplikasi pada baris yang pernah diubah dari sheet).
8. `schema-tahap7.sql` — menghapus data hanya bisa dilakukan akun pemilik (Key). Admin dan staf tetap bisa mencatat dan mengubah, tapi tombol Hapus tidak muncul dan database menolak perintah hapus dari akun mereka.
9. `schema-tahap8-invoice.sql` — modul Dokumen bagian 1: Katalog Layanan dan Penawaran & Invoice. Invoice yang diterbitkan masuk Piutang Klien; ditandai lunas → transaksi masuk (nilai yang ditransfer, setelah PPh 23) tercatat otomatis, sekali saja.

Semua file aman dijalankan ulang. Semuanya sudah diuji di Postgres 16.

## Menjalankan di komputer

```
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka http://localhost:3000.

## Impor data lama

Setelah database siap dan `.env.local` terisi:

```
npm run impor -- --coba   # lihat dulu apa yang akan dimasukkan, tidak menulis apa pun
npm run impor             # impor sungguhan
```

Sumbernya `arl-keuangan-DATA.json` (ekspor dari prototipe v7). "Rekening Operasional" di prototipe dimasukkan ke **BCA Operasional**. Skrip aman dijalankan berkali-kali: baris yang sudah ada tidak ditimpa dan tidak digandakan. Di akhir, skrip mencetak angka yang harus cocok dengan prototipe: masuk Rp29.957.363, keluar Rp25.919.647, saldo Rp4.037.716.

## Chat AI

Isi **salah satu** kunci di `.env.local` (dan di Vercel → Environment Variables). Kunci hanya dipakai di server (`/api/chat`), tidak pernah sampai ke browser.

- **`NVIDIA_API_KEY`** (dipakai kalau terisi) — build.nvidia.com. Teks memakai `nvidia/nemotron-3-super-120b-a12b` (±5 detik), cadangan `openai/gpt-oss-20b` kalau Nemotron sedang lambat (>25 detik). Foto bukti dibaca dua tahap: `meta/llama-3.2-11b-vision-instruct` menyalin teks di foto, lalu Nemotron menyusun transaksinya. **PDF belum bisa dibaca** lewat NVIDIA — kirim foto/screenshot. `NVIDIA_MODEL` dan `NVIDIA_MODEL_GAMBAR` bisa memaksa model lain.
- **`GEMINI_API_KEY`** — model dipilih otomatis lewat ListModels: Flash stabil versi tertinggi, lalu versi di bawahnya kalau sibuk. `GEMINI_MODEL` bisa memaksa satu model. `AI_PENYEDIA=gemini` memaksa Gemini walau kunci NVIDIA ada.
- Setiap aksi dari model divalidasi di server: nominal harus bilangan bulat positif, tanggal `YYYY-MM-DD`, klien/vendor harus cocok dan tidak ambigu, kategori harus dari daftar, peran harus boleh, periode tidak boleh sudah tutup buku. Yang tidak lolos ditolak beserta alasannya; sisanya tetap jalan.
- Staf hanya boleh mencatat transaksi dan mengubah transaksinya sendiri lewat chat.
- **Beda dengan prototipe:** kalau AI tidak bisa dihubungi, mode offline hanya menjawab pertanyaan (saldo, siapa belum bayar, rekap) dan **tidak menyimpan apa pun**. Parser kata kunci prototipe terbukti mencatat koreksi sebagai transaksi baru (dobel), jadi tidak dipakai untuk menulis data.

## Laporan & pajak

- Angka Laba Rugi, Neraca, Arus Kas, Per Kategori, estimasi PPh Badan, dan daftar aset sudah dicocokkan dengan prototipe v7 memakai data yang sama — hasilnya sama persis.
- Setiap laporan bisa diunduh sebagai CSV (mengikuti bar periode) dan dicetak / disimpan PDF lewat tombol **Cetak / PDF**. Saat dicetak, menu, chat, dan tombol tidak ikut.
- Penyusutan dihitung saat dibutuhkan, tidak disimpan. Beda kecil dengan prototipe: akumulasi garis lurus dibulatkan sekali dari total, jadi tidak ada selisih Rp1 yang menumpuk.
- Estimasi PPh Badan mengurangkan **PPh 23 yang dipotong klien** sebagai kredit pajak (kolom di tagihan), dan memberi peringatan untuk tagihan yang belum ada bukti potongnya.

## Akun pertama

Buka `/mulai` untuk membuat akun **pemilik**. Halaman ini hanya bisa dipakai sekali — begitu sudah ada pengguna, halaman ini terkunci.

## Menambah anggota tim

Login sebagai pemilik → menu **Tim** → isi nama, email, password sementara, dan peran (staf/admin). Berikan email dan password sementara langsung ke orangnya.

Di tabel anggota, pemilik bisa mengubah peran atau **Nonaktifkan** seseorang (mis. yang resign). Akun nonaktif langsung tidak bisa membuka aplikasi; datanya tetap ada.

## Hak akses

Semua aturan ini dijaga di database (RLS + trigger), bukan hanya disembunyikan di tampilan — berlaku juga untuk chat AI dan skrip.

| | Pemilik | Admin | Staf |
|---|---|---|---|
| Lihat data operasional | ✓ | ✓ | ✓ kecuali gaji |
| Catat transaksi | ✓ | ✓ | ✓ (bukan gaji); pengeluaran > Rp5 jt lewat persetujuan |
| Ubah transaksi | ✓ | ✓ | hanya buatannya sendiri |
| Hapus transaksi | ✓ | ✓ | ✗ |
| Klien, tagihan, rekening, vendor, aset, pajak | ✓ | ✓ | ✗ |
| Hapus data perusahaan | ✓ | ✗ | ✗ |
| Setujui / tolak pengeluaran staf | ✓ | ✗ | ✗ |
| Tutup buku | ✓ | ✓ | ✗ |
| Buka kembali periode tertutup | ✓ | ✗ | ✗ |
| Sinkron sheet: tarik manual, tinjau bentrok & baris hilang | ✓ | ✓ | ✗ |
| Riwayat perubahan, backup, Tim | ✓ | ✗ | ✗ |

Catatan: siapa pun yang punya akses **Editor** di Google Sheet bisa mengubah pembukuan lewat sheet, dan jalurnya tidak melewati batas persetujuan Rp5 juta. Beri akses Editor hanya ke orang yang memang boleh (Key), dan atur tautan umum sheet ke *Viewer* atau *Restricted*.

Semuanya ada di menu **Kontrol** (tab yang tampil menyesuaikan peran).

## Backup & memulihkan data

**Otomatis:** Cron Vercel (`vercel.json`) memanggil `/api/cron/backup` setiap **Senin 01.00 WIB**. Seluruh isi database — termasuk gaji dan riwayat perubahan — disimpan sebagai JSON di bucket privat `backup`. Wajib isi `CRON_SECRET` di Vercel → Environment Variables (teks acak panjang); tanpa itu endpoint menolak semua panggilan.

**Manual:** Kontrol → Backup → **Backup sekarang**. Di tab yang sama, file backup bisa diunduh (hanya pemilik).

**Memulihkan:**

1. Siapkan database: jalankan semua file SQL di atas (ke proyek Supabase baru kalau yang lama rusak).
2. Buat ulang akun lewat `/mulai` (pemilik) dan halaman Tim — akun login tidak ikut backup. Rujukan ke pengguna yang tidak ada akan dikosongkan.
3. Unduh file backup, taruh di folder proyek, isi `.env.local` dengan kunci Supabase tujuan, lalu:

```
npm run pulihkan -- arl-backup-2026-10-05-18-00.json --coba   # lihat dulu, tidak menulis apa pun
npm run pulihkan -- arl-backup-2026-10-05-18-00.json          # pulihkan
```

Baris yang sudah ada tidak ditimpa, jadi aman dijalankan ulang. Tutup buku dipulihkan paling akhir supaya tidak menghalangi transaksi yang dipulihkan. File backup berisi data gaji — simpan hanya di tempat pribadi.

## Sinkron Google Sheets

Sheet `KEUANGAN ARL` jadi cermin dua arah database. Spesifikasi di `integrasi-google-sheets.md`.

**Menyiapkan (sekali):**

1. Buat service account dan bagikan sheet ke emailnya sebagai **Editor** — langkahnya di `integrasi-google-sheets.md`.
2. Di Vercel → Environment Variables isi `GOOGLE_SHEET_ID` dan `GOOGLE_SERVICE_ACCOUNT_JSON` (tempel **seluruh isi** file JSON service account). Cara lama juga masih bisa: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`. Pastikan `NEXT_PUBLIC_APP_URL` terisi (untuk tautan bukti).
3. Buka Kontrol → **Sinkron Sheet** → **Tarik dari Sheet**. Sinkron pertama membuat tab Transaksi, Klien, Tagihan, Vendor, Utang, Aset, Pajak, Rekening, dan Ringkasan, lalu menulis semua data.
4. Disarankan: pasang `scripts/sheet-diubah.gs` di sheet (Extensions → Apps Script). Skrip ini mengisi kolom **Diubah** saat sheet diedit. Tanpa skrip itu, kalau baris yang sama diubah di dua tempat sekaligus, versi aplikasi selalu menang.

**Kapan sinkron berjalan:**

- **Aplikasi → sheet:** setiap perubahan masuk `sinkron_antrean`. Selama aplikasi terbuka di perangkat mana pun, antrean dikirim ±2 detik setelah menyimpan (paling lambat 30 detik) dalam satu `batchUpdate`.
- **Sheet → aplikasi:** saat aplikasi dibuka kalau tarikan terakhir lebih dari 5 menit lalu, tombol **Tarik dari Sheet**, dan cron `/api/cron/sinkron`.
- Hanya satu proses sinkron berjalan pada satu waktu, walau banyak HP/desktop terbuka.

**Cron tiap 5 menit.** Paket Vercel Hobby hanya mengizinkan cron sekali sehari — `vercel.json` memakai jadwal harian (00.30 WIB) supaya deploy tidak ditolak. Untuk tiap 5 menit, pilih salah satu:
- Vercel Pro: ubah jadwal `/api/cron/sinkron` di `vercel.json` jadi `*/5 * * * *`.
- Gratis: daftar di cron-job.org, panggil `https://<alamat-aplikasi>/api/cron/sinkron` tiap 5 menit dengan header `Authorization: Bearer <CRON_SECRET>`.

**Aturan pengaman:**

- Baris yang dihapus dari sheet **tidak** menghapus data. Muncul di Kontrol → Sinkron Sheet → *Hilang dari Sheet* (dan lencana di menu Kontrol) dengan pilihan **Tulis ulang ke sheet** atau **Sudah ditinjau**. Untuk benar-benar menghapus lewat sheet, ubah kolom Status jadi `dihapus` (datanya diarsipkan, bisa dikembalikan dengan mengubahnya lagi ke `aktif`).
- Baris yang tidak lolos validasi (nominal, tanggal, kategori, tipe, nama klien/rekening/vendor yang tidak persis sama, periode tutup buku, kategori gaji) diberi latar merah dan alasannya ditulis di awal kolom Catatan. Setelah diperbaiki, merahnya hilang sendiri dan catatan asli dipertahankan.
- Bentrok diputuskan per baris: kolom Diubah paling baru menang. Versi yang kalah tercatat di *Bentrok* supaya bisa diperiksa.
- Data gaji (payroll, karyawan, transaksi kategori *Gaji & fee tim*) tidak pernah ditulis ke sheet.
- Kolom Bukti berisi tautan ke aplikasi (`/bukti/<id>`), bukan ke file. Pembukanya harus login, dan file dibuka lewat signed URL 60 detik.
- Tab Ringkasan berisi rumus yang ditulis sekali saat dibuat. Aplikasi tidak pernah membacanya.

## Gaji rutin & Google Calendar

**Gaji rutin** (halaman Tim, pemilik): isi nama & gaji per bulan tiap anggota yang digaji. Mulai tanggal 1 tiap bulan, Ringkasan menampilkan pengingat untuk gaji yang belum tercatat, dengan tombol **Catat gaji** (tercatat hari itu, kategori *Gaji & fee tim*, dari rekening pertama). Gaji yang dicatat lewat form atau chat juga terhitung — cocokkan dengan nama di keterangan. Data gaji hanya terbaca pemilik & admin dan tidak pernah dikirim ke Google Sheet.

**Google Calendar** (halaman Tim → Google Calendar): salin tautan kalender, lalu di calendar.google.com → *Other calendars* → **+** → *From URL*. Isinya jadwal tagih bulanan tiap klien aktif (tanggal tagih + nilai bulanan), jatuh tempo tagihan yang belum lunas, dan pengingat gaji tanggal 1 (tanpa nominal). Tautan dibuat dari `CRON_SECRET` + `NEXT_PUBLIC_APP_URL` — kalau `CRON_SECRET` diganti, tautan lama mati. Google memperbarui kalender langganan beberapa jam sekali.

## Memasang di HP

Setelah aplikasi online (Vercel), buka alamatnya di HP:

- **Android (Chrome):** menu ⋮ → *Instal aplikasi* / *Tambahkan ke layar utama*.
- **iPhone (Safari):** tombol Bagikan → *Tambahkan ke Layar Utama*.

Ikon ARL muncul di layar utama dan aplikasi terbuka layar penuh tanpa bilah browser. Di desktop (Chrome/Edge) ada ikon pasang di ujung kanan kolom alamat.

Pemasangan PWA butuh HTTPS, jadi tidak jalan di `http://localhost` dari HP — pakai alamat Vercel.


### APK Android

APK dibuat dengan PWABuilder (Trusted Web Activity): paket `com.arahruanglangit.keuangan`, membuka `https://owner-five-psi.vercel.app/ringkasan` layar penuh. Verifikasinya di `public/.well-known/assetlinks.json` (sidik jari SHA-256 kunci tanda tangan). Kunci tanda tangan (`signing.keystore` + kata sandinya) disimpan pemilik — dibutuhkan untuk membuat versi APK berikutnya atau mengunggah ke Play Store. **Kalau alamat aplikasi berganti (mis. pakai domain sendiri), APK harus dibuat ulang.** Isi aplikasi tetap dari server, jadi pembaruan fitur tidak butuh APK baru.

## Perintah

| Perintah | Guna |
|---|---|
| `npm run dev` | jalankan mode pengembangan |
| `npm run build` | build produksi |
| `npm run lint` | periksa gaya kode |
| `npm run typecheck` | periksa tipe TypeScript |
| `npm run ikon` | buat ulang ikon aplikasi & logo di `public/` dari folder `logo/` |

## Struktur folder

```
src/
  app/
    (aplikasi)/        halaman yang wajib login — ringkasan, transaksi, klien, aset, pajak, laporan, tim
    login/  mulai/     halaman masuk & pembuatan akun pemilik
    offline/           ditampilkan service worker saat tidak ada internet
    manifest.ts        manifest PWA
  components/
    shell/             sidebar, bilah atas HP, menu bawah HP, panel chat
    halaman/           hero, sub-tab, kerangka halaman
  lib/
    supabase/          client.ts (browser, anon) · server.ts (server, anon + sesi) · admin.ts (service role, server-only)
    navigasi.ts        daftar halaman & sub-tab
    pengguna.ts        cek login & peran
    audit.ts           tulis audit_log
    sheets/            google.ts (klien Sheets API + service account) · skema.ts (kolom tiap tab) · sinkron.ts (mesin sinkron)
scripts/
  sheet-diubah.gs      Apps Script pengisi kolom Diubah di sheet
.claude/skills/        skill Claude dari repo keyraditya27/CLAUDE — gaya-arl (tampilan & logo) · pembukuan-agensi (aturan pembukuan & pajak)
public/
  sw.js                service worker (tidak meng-cache data keuangan)
  ikon/ logo/          dibuat oleh `npm run ikon`
logo/                  logo resmi ARL (sumber)
```
