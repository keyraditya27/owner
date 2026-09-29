# Panduan Lengkap untuk Pemula

Ditulis dengan anggapan kamu belum pernah membuka Terminal dan belum pernah memasang apa pun untuk keperluan programming. Tidak apa-apa — semua ini bisa dikerjakan dengan menyalin dan menempel.

**Perkiraan waktu:** 3–4 jam untuk persiapan (langkah 1–7), lalu 1–3 hari untuk pembangunan aplikasinya.
**Biaya:** gratis. Supabase, Vercel, Google Cloud, dan Gemini semuanya punya paket gratis yang cukup jauh untuk ukuran ARL. Claude Code memakai langganan Claude yang sudah kamu punya.

---

## Istilah yang akan sering muncul

Sebelum mulai, empat kata ini perlu dikenali supaya tidak bingung di tengah jalan.

**Terminal** (di Mac) atau **PowerShell** (di Windows) adalah jendela hitam atau biru tempat kamu mengetik perintah. Tidak ada tombol, tidak ada menu — hanya teks. Terasa asing di awal, tapi yang kamu lakukan cuma menempel perintah lalu menekan Enter.

**Folder proyek** adalah satu folder di komputermu yang berisi seluruh aplikasi ini. Semua perintah dijalankan dari dalam folder itu.

**Supabase** adalah tempat data disimpan — database, login pengguna, dan file bukti transfer. Anggap saja seperti Google Drive khusus untuk data aplikasi.

**Vercel** adalah tempat aplikasinya "tinggal" supaya bisa dibuka dari mana saja lewat alamat web. Selama masih di komputermu sendiri, hanya kamu yang bisa membukanya.

---

## Langkah 0 — Buka Terminal dulu, kenalan sebentar

### Kalau kamu pakai Mac

Tekan `Command` + `Spasi`, ketik `terminal`, tekan Enter. Muncul jendela putih atau hitam dengan tulisan seperti `keyra@MacBook-Pro ~ %`.

### Kalau kamu pakai Windows

Klik tombol Start, ketik `powershell`, klik kanan pada **Windows PowerShell**, pilih **Run as administrator**. Kalau muncul pertanyaan izin, klik Yes. Muncul jendela biru.

### Coba dulu

Ketik ini lalu Enter:

```
echo halo
```

Kalau muncul tulisan `halo`, berarti kamu sudah bisa memakai Terminal. Itu saja yang dibutuhkan.

**Catatan menempel perintah:** di Windows PowerShell, tempel dengan klik kanan. Di Mac Terminal, pakai `Command` + `V` seperti biasa.

---

## Langkah 1 — Pasang Node.js

Node.js adalah mesin yang menjalankan aplikasi ini. Tanpa ini, tidak ada yang bisa jalan.

1. Buka **nodejs.org**
2. Klik tombol besar yang bertuliskan **LTS** (biasanya di kiri). Jangan pilih yang "Current".
3. File terunduh. Buka file itu.
4. **Mac:** klik Continue terus sampai Install, masukkan password Mac kamu.
   **Windows:** klik Next terus sampai Install. Kalau ada centang "Automatically install the necessary tools", biarkan tidak tercentang saja.
5. Setelah selesai, **tutup Terminal lalu buka lagi.** Ini penting — kalau tidak, Terminal belum mengenali Node.

Sekarang periksa. Ketik:

```
node --version
```

**Yang harus muncul:** angka seperti `v22.14.0`. Angka pastinya boleh beda, yang penting diawali `v` dan angka pertamanya 18 atau lebih.

**Kalau muncul "command not found" atau "bukan perintah yang dikenali":** Terminal-nya belum ditutup dan dibuka ulang. Tutup benar-benar (Mac: `Command`+`Q`), lalu buka lagi.

---

## Langkah 2 — Pasang Claude Code

Ketik perintah ini:

```
npm install -g @anthropic-ai/claude-code
```

Tunggu. Akan muncul banyak teks berjalan selama satu sampai tiga menit. Itu normal.

**Kalau di Mac muncul error tentang "permission denied":** ketik ulang dengan `sudo` di depannya:

```
sudo npm install -g @anthropic-ai/claude-code
```

Lalu masukkan password Mac kamu. Saat mengetik password, layar tidak menampilkan apa pun — tidak ada bintang, tidak ada titik. Itu normal, tetap ketik lalu Enter.

Periksa hasilnya:

```
claude --version
```

**Yang harus muncul:** nomor versi. Kalau muncul, Claude Code sudah terpasang.

---

## Langkah 3 — Siapkan folder proyek

Kita akan membuat folder di Desktop supaya mudah dicari.

**Mac:**
```
cd ~/Desktop
mkdir arl-keuangan
cd arl-keuangan
```

**Windows:**
```
cd $HOME\Desktop
mkdir arl-keuangan
cd arl-keuangan
```

Penjelasan singkat: `cd` artinya "masuk ke folder", `mkdir` artinya "buat folder baru".

Sekarang buka folder itu lewat Finder (Mac) atau File Explorer (Windows) — ada di Desktop, namanya `arl-keuangan`.

**Ekstrak isi `ARL-Keuangan-Handoff.zip` ke dalam folder ini.** Yang masuk adalah isinya, bukan foldernya. Jadi setelah selesai, di dalam `arl-keuangan` harus langsung terlihat file-file seperti `CLAUDE.md`, `schema.sql`, dan folder `logo`. Kalau yang terlihat malah folder bernama `handoff`, buka folder itu, pilih semua isinya, pindahkan keluar satu tingkat.

**Periksa:** ketik `ls` (Mac) atau `dir` (Windows). Harus muncul daftar nama file termasuk `CLAUDE.md`.

---

## Langkah 4 — Siapkan Supabase

Ini tempat data ARL akan disimpan.

1. Buka **supabase.com**, klik **Start your project**, masuk dengan akun Google `arahruanglangit@gmail.com`.
2. Klik **New project**.
   - Name: `arl-keuangan`
   - Database Password: klik **Generate a password**, lalu **salin dan simpan di tempat aman**. Password ini tidak bisa dilihat lagi nanti.
   - Region: pilih **Southeast Asia (Singapore)** — paling dekat dari Bandung, jadi aplikasinya terasa lebih cepat.
3. Klik **Create new project**. Tunggu sekitar dua menit sampai lampu statusnya hijau.

### Jalankan struktur database

4. Di menu kiri, klik ikon **SQL Editor**.
5. Klik **New query**.
6. Buka file `schema.sql` dari folder proyek dengan Notepad (Windows) atau TextEdit (Mac). **Pilih semua** (`Ctrl`+`A` atau `Command`+`A`), **salin**, lalu **tempel** ke kotak SQL Editor.
7. Klik tombol **Run** di kanan bawah.

**Yang harus muncul:** tulisan `Success. No rows returned` berwarna hijau. Itu artinya berhasil — tidak mengembalikan baris memang yang diharapkan, karena perintahnya membuat tabel, bukan mencari data.

8. Klik **New query** lagi, ulangi hal yang sama dengan file `schema-tambahan-sheets.sql`.

### Buat tempat penyimpanan bukti

9. Di menu kiri klik **Storage** → **New bucket**.
10. Name: `bukti`. **Pastikan Public bucket TIDAK dicentang.** Klik Create.

### Ambil tiga kunci

11. Menu kiri paling bawah: **Project Settings** → **API**.
12. Salin tiga nilai ini ke Notepad sementara:
    - **Project URL** — bentuknya seperti `https://abcdefgh.supabase.co`
    - **anon public** — teks panjang diawali `eyJ`
    - **service_role** — teks panjang lain, perlu diklik "Reveal" dulu

Yang ketiga itu kunci super. Jangan pernah dikirim ke siapa pun.

---

## Langkah 5 — Buat "akun robot" Google untuk sheet

Aplikasi butuh identitasnya sendiri supaya bisa menulis ke sheet tanpa kamu login berulang. Identitas ini namanya service account — anggap saja karyawan robot yang kamu beri akses ke sheet.

1. Buka **console.cloud.google.com** dengan akun `arahruanglangit@gmail.com`.
2. Kalau ini pertama kali, akan ada persetujuan syarat layanan — centang lalu lanjut.
3. Di bagian atas ada dropdown pemilih proyek. Klik → **New Project**.
   - Project name: `arl-keuangan`
   - Klik **Create**, tunggu sekitar 30 detik.
4. Pastikan proyek `arl-keuangan` yang aktif di dropdown atas. Kalau belum, klik dan pilih.

### Nyalakan Sheets API

5. Di kotak pencarian atas, ketik `Google Sheets API`, klik hasilnya.
6. Klik tombol biru **Enable**. Tunggu sebentar.

### Buat service account-nya

7. Di kotak pencarian atas, ketik `Credentials`, klik **APIs & Services → Credentials**.
8. Klik **+ Create Credentials** → **Service account**.
9. Service account name: `arl-sheets-sync`. Klik **Create and Continue**.
10. Bagian "Grant this service account access" — **lewati saja**, klik **Continue**.
11. Bagian terakhir juga dilewati, klik **Done**.

### Ambil kunci JSON-nya

12. Di daftar, klik service account `arl-sheets-sync` yang baru dibuat.
13. Buka tab **Keys** → **Add Key** → **Create new key**.
14. Pilih **JSON**, klik **Create**.
15. File otomatis terunduh ke folder Downloads. Namanya panjang seperti `arl-keuangan-a1b2c3.json`.

**File ini rahasia.** Jangan taruh di folder proyek, jangan kirim lewat WhatsApp. Simpan di Downloads dulu, nanti isinya disalin ke satu tempat.

### Beri robot itu akses ke sheet

16. Buka file JSON tadi dengan Notepad atau TextEdit.
17. Cari baris `"client_email":`. Di sebelahnya ada alamat seperti
    `arl-sheets-sync@arl-keuangan.iam.gserviceaccount.com`. **Salin alamat itu** (tanpa tanda kutip).
18. Buka sheet **KEUANGAN ARL** di Google Sheets.
19. Klik tombol **Share** di kanan atas.
20. Tempel alamat tadi, ubah aksesnya jadi **Editor**, klik **Send**.
21. Muncul peringatan bahwa notifikasi tidak bisa dikirim ke alamat itu — **itu normal**, karena ini bukan akun manusia. Klik Share anyway kalau ditanya.

Jangan tutup file JSON itu, masih dipakai di langkah 7.

---

## Langkah 6 — Ambil kunci Gemini

Ini yang membuat chat AI-nya bisa membaca perintah dan bukti transfer.

1. Buka **aistudio.google.com/apikey**, masuk dengan akun Google.
2. Klik **Create API key**.
3. Pilih proyek `arl-keuangan` yang tadi dibuat (atau buat baru kalau diminta).
4. Salin kunci yang muncul — diawali `AIza`.

Gratis, tanpa kartu kredit. Kuotanya sekitar 1.500 permintaan per hari, jauh lebih dari cukup.

---

## Langkah 7 — Isi file kunci rahasia

Sekarang semua kunci dikumpulkan jadi satu file.

1. Di folder `arl-keuangan`, cari file `env.example.txt`.
2. **Ganti namanya jadi `.env.local`** — persis begitu, diawali titik, tanpa `.txt` di belakang.

   **Windows:** File Explorer menyembunyikan ekstensi file. Klik tab **View** → centang **File name extensions** dulu, baru ganti nama. Kalau muncul peringatan soal mengubah ekstensi, klik Yes.

   **Mac:** Finder akan bertanya apakah yakin memakai `.local`. Klik "Use .local".

   Setelah diganti nama, filenya mungkin jadi tidak terlihat di Mac. Tekan `Command`+`Shift`+`.` untuk menampilkan file tersembunyi.

3. Buka `.env.local` dengan Notepad atau TextEdit, isi nilainya:

```
NEXT_PUBLIC_SUPABASE_URL=          ← Project URL dari langkah 4
NEXT_PUBLIC_SUPABASE_ANON_KEY=     ← anon public dari langkah 4
SUPABASE_SERVICE_ROLE_KEY=         ← service_role dari langkah 4
GOOGLE_SHEET_ID=                   ← sudah terisi, biarkan
GOOGLE_SERVICE_ACCOUNT_EMAIL=      ← client_email dari file JSON
GOOGLE_PRIVATE_KEY=                ← private_key dari file JSON
GEMINI_API_KEY=                    ← kunci dari langkah 6
CRON_SECRET=                       ← ketik teks acak apa saja, misal: arl2026rahasiapanjang
```

### Bagian yang paling sering salah

`GOOGLE_PRIVATE_KEY` di file JSON bentuknya sangat panjang seperti ini:

```
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

Salin **termasuk tanda kutip ganda di awal dan akhir**, termasuk semua `\n` di dalamnya. Jangan diubah, jangan dirapikan, jangan dipecah jadi beberapa baris. Tempel apa adanya setelah tanda `=`.

4. Simpan file. **Jangan pernah mengirim file ini ke siapa pun.**

---

## Langkah 8 — Jalankan Claude Code

Kembali ke Terminal. Pastikan masih di dalam folder proyek — kalau ragu, ketik ulang:

**Mac:** `cd ~/Desktop/arl-keuangan`
**Windows:** `cd $HOME\Desktop\arl-keuangan`

Lalu ketik:

```
claude
```

Pertama kali akan diminta login. Ikuti tautan yang muncul, masuk dengan akun Claude kamu, salin kode yang diberikan, tempel kembali ke Terminal.

Setelah masuk, kamu akan melihat kotak tempat mengetik. Sekarang buka file `prompt-tahap.md`, salin **seluruh isi kotak Tahap 1**, tempel ke situ, tekan Enter.

Claude Code akan mulai bekerja. Dia akan menjelaskan rencananya, membuat file, dan sesekali bertanya. Kalau dia minta izin menjalankan sesuatu, baca sekilas lalu setujui.

### Setelah Tahap 1 selesai

Ketik ini di Terminal (kalau masih di dalam Claude Code, keluar dulu dengan mengetik `/exit`):

```
npm run dev
```

Buka browser, kunjungi **http://localhost:3000**. Kalau tampilan sidebar navy dengan logo ARL sudah muncul, Tahap 1 berhasil.

Untuk menghentikan, kembali ke Terminal dan tekan `Ctrl` + `C`.

Lanjutkan ke Tahap 2, dan seterusnya sampai Tahap 6. **Satu tahap satu kali jalan.** Periksa hasilnya di browser sebelum lanjut.

---

## Langkah 9 — Naikkan ke internet

Setelah semua tahap selesai dan aplikasinya jalan di komputermu, saatnya dibuat bisa diakses tim.

```
npm install -g vercel
vercel login
vercel
```

Jawab pertanyaannya dengan menekan Enter untuk pilihan bawaan. Setelah selesai kamu dapat alamat web.

Terakhir, semua kunci di `.env.local` harus dimasukkan juga ke Vercel:

1. Buka **vercel.com**, masuk ke proyek `arl-keuangan`
2. **Settings** → **Environment Variables**
3. Tambahkan satu per satu, nama dan nilainya sama persis dengan isi `.env.local`
4. Setelah semua masuk, kembali ke Terminal dan ketik `vercel --prod`

Sekarang Tasya, Caca, dan Ipii bisa membuka aplikasinya dari HP atau laptop mereka.

---

## Kalau tersangkut

**Terminal bilang "command not found"**
Program yang dimaksud belum terpasang, atau Terminal belum ditutup-buka setelah pemasangan. Tutup Terminal benar-benar, buka lagi, coba ulang.

**Supabase bilang "syntax error" saat Run**
Isi file `.sql` belum tersalin seluruhnya. Buka lagi filenya, pastikan pilih semua dari baris pertama sampai baris terakhir.

**Aplikasi tidak bisa connect ke Google Sheets**
Sembilan dari sepuluh kasus, penyebabnya `GOOGLE_PRIVATE_KEY`. Pastikan tanda kutip ganda ikut tersalin dan semua `\n` masih utuh. Penyebab kedua: sheet belum di-share ke alamat service account.

**Claude Code membuat sesuatu yang tidak kamu minta**
Ketik ini:
```
Berhenti dulu. Baca ulang CLAUDE.md dan PRD.md, lalu jelaskan apa yang sedang kamu bangun dan kenapa, sebelum menulis kode lagi.
```

**Error yang sama muncul berulang**
Ketik ini:
```
Jangan tambal gejalanya. Cari akar masalahnya, jelaskan ke saya apa yang sebenarnya terjadi, baru perbaiki.
```

**Kamu tidak paham apa yang sedang terjadi**
Tanyakan langsung ke Claude Code:
```
Jelaskan dengan bahasa yang mudah dipahami orang non-teknis: apa yang barusan kamu kerjakan dan kenapa itu perlu?
```

Ini bukan pertanyaan bodoh. Kamu pemilik sistem ini — kalau nanti ada yang rusak dan kamu tidak paham strukturnya, memperbaikinya jadi jauh lebih mahal.

---

## Yang tidak perlu kamu kerjakan sendiri

Kamu tidak perlu bisa menulis kode. Yang kamu perlukan cuma tiga hal:

1. **Memeriksa hasil.** Setelah tiap tahap, buka aplikasinya dan lihat apakah angkanya benar. Kamu yang paling tahu keuangan ARL — Claude Code tidak.
2. **Bilang kalau ada yang salah.** Deskripsikan apa yang kamu lihat dan apa yang kamu harapkan. Tidak perlu tahu penyebabnya.
3. **Menjaga kunci rahasia.** File `.env.local` dan file JSON Google jangan pernah dibagikan.

Sisanya bisa didelegasikan.
