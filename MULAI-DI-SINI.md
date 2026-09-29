# Pindah ke Claude Code — Ringkasan

> **Belum pernah pakai Terminal atau memasang apa pun untuk programming?**
> Buka **`PANDUAN-PEMULA.md`** — isinya langkah yang sama tapi jauh lebih rinci,
> lengkap dengan apa yang harus muncul di layar dan cara mengatasi error umum.
> File ini versi ringkasnya, untuk dibaca ulang setelah paham alurnya.

---


Panduan untuk memindahkan prototipe `arl-keuangan-v7.html` menjadi aplikasi sungguhan.
Perkiraan waktu sampai bisa dipakai tim: **2–4 hari kerja** kalau dikerjakan berurutan.

---

## Sebelum mulai: keluarkan datamu dulu

Buka `arl-keuangan-v7.html` di browser → sidebar kiri → **Unduh data (JSON)**.
File `arl-keuangan-YYYY-MM-DD.json` itu berisi seluruh data yang sudah kamu masukkan. Simpan baik-baik — ini yang akan diimpor ke database nanti.

Kalau isinya masih contoh (Batik Ayman, EZCAT, dll), hapus dulu lewat **Kosongkan semua**, masukkan data asli ARL, baru unduh.

---

## Langkah 1 — Pasang yang dibutuhkan

**Node.js** (wajib, minimal versi 18)
Unduh dari nodejs.org, pilih versi LTS. Setelah terpasang, buka Terminal (Mac) atau PowerShell (Windows), ketik:

```
node --version
```

Kalau muncul angka seperti `v22.x.x`, berarti sudah benar.

**Claude Code**

```
npm install -g @anthropic-ai/claude-code
```

Lalu jalankan `claude` dan ikuti proses login dengan akun Claude kamu.

---

## Langkah 2 — Buat folder proyek

```
mkdir arl-keuangan
cd arl-keuangan
```

Salin file-file berikut ke dalam folder itu:

| File | Kegunaan |
|---|---|
| `CLAUDE.md` | Konteks proyek — Claude Code membacanya otomatis setiap sesi |
| `PRD.md` | Spesifikasi lengkap apa yang dibangun |
| `schema.sql` | Struktur database siap pakai |
| `env.example.txt` | Daftar kunci rahasia yang perlu diisi |
| `prompt-tahap.md` | Perintah siap tempel untuk tiap tahap |
| `arl-keuangan-v7.html` | Prototipe berisi data asli ARL — acuan tampilan dan logika |
| `integrasi-google-sheets.md` | Spesifikasi sinkron dua arah dengan sheet |
| `schema-tambahan-sheets.sql` | Tabel dan pemicu untuk sinkron |
| `ARL-Keuangan-Sheet.csv` | Data Juni–September siap diimpor ke sheet |
| `sistem-keuangan-arl.md` | Penjelasan sistem keuangan PT |
| `arl-keuangan-DATA.json` | Data hasil ekspor kamu (ganti namanya jadi ini) |
| `logo/` | Dua file PNG logo ARL |

Buat subfolder `logo/` lalu masukkan `ARL_Logo_tanpa_background_putih.png` dan `ARL_Logo_tanpa_background.png`.

---

## Langkah 3 — Siapkan Supabase

Supabase menyediakan database, login pengguna, dan penyimpanan file bukti — tiga hal sekaligus, gratis untuk ukuran ARL.

1. Buka **supabase.com**, daftar dengan akun Google.
2. Klik **New project**. Nama: `arl-keuangan`. Region: **Southeast Asia (Singapore)** — paling dekat dari Bandung.
3. Simpan password database yang kamu buat. Tulis di password manager, bukan di catatan HP.
4. Tunggu sekitar dua menit sampai proyeknya siap.
5. Masuk ke **SQL Editor** → **New query** → tempel seluruh isi `schema.sql` → **Run**.
   Lalu buat query baru lagi, tempel `schema-tambahan-sheets.sql` → **Run**.
6. Masuk ke **Storage** → **New bucket** → nama `bukti` → **Private**.
7. Masuk ke **Project Settings → API**, salin dua nilai: `Project URL` dan `anon public key`. Dari **Service role key** salin juga yang ketiga.

---

## Langkah 4 — Siapkan service account Google

Ini yang membuat aplikasi bisa menulis ke sheet tanpa login berulang.

1. Buka **console.cloud.google.com** dengan akun `arahruanglangit@gmail.com`.
2. Buat proyek baru bernama `arl-keuangan`.
3. **APIs & Services → Library** → cari **Google Sheets API** → **Enable**.
4. **Credentials → Create Credentials → Service Account** → nama `arl-sheets-sync` → Create → Done.
5. Klik service account itu → tab **Keys** → **Add Key → Create new key → JSON**. File terunduh otomatis.
6. Buka file JSON-nya, salin `client_email`.
7. Buka sheet **KEUANGAN ARL** → **Share** → tempel email itu → akses **Editor** → Send.
   Peringatan "tidak bisa mengirim notifikasi" itu normal, abaikan.

Langkah lengkap beserta alasannya ada di `integrasi-google-sheets.md`.

## Langkah 5 — Ambil kunci Gemini

1. Buka **aistudio.google.com/apikey**, masuk dengan akun Google.
2. Klik **Create API key**, salin kuncinya.

Gratis, tanpa kartu kredit, sekitar 1.500 permintaan per hari.

---

## Langkah 6 — Isi file .env

Ganti nama `env.example.txt` jadi `.env.local`, lalu isi nilainya dari langkah 3, 4, dan 5.

Untuk `GOOGLE_PRIVATE_KEY`, salin nilai `private_key` dari file JSON **persis apa adanya** termasuk `\n` di dalamnya, lalu bungkus dengan tanda kutip ganda. Ini yang paling sering salah dan menyebabkan error autentikasi.

**Jangan pernah mengunggah file ini ke GitHub.** Claude Code akan otomatis membuat `.gitignore` yang mengecualikannya, tapi periksa sendiri sebelum push pertama.

---

## Langkah 7 — Jalankan Claude Code

Di dalam folder proyek:

```
claude
```

Lalu tempel prompt Tahap 1 dari `prompt-tahap.md`. Kerjakan tahap demi tahap, jangan diborong sekaligus — hasilnya lebih rapi dan lebih mudah diperiksa.

Setelah tiap tahap selesai, jalankan `npm run dev`, buka `http://localhost:3000`, dan cek sendiri hasilnya sebelum lanjut.

---

## Langkah 8 — Impor data lama

Setelah Tahap 2 selesai (database sudah jalan), tempel prompt impor dari `prompt-tahap.md`. Claude Code akan membaca `arl-keuangan-DATA.json` dan memasukkannya ke Supabase.

Data Juni–September 2026 sudah tertanam di `arl-keuangan-v7.html` — buka, klik **Unduh data (JSON)**, itu jadi `arl-keuangan-DATA.json`. Angka yang harus cocok setelah impor: masuk Rp29.957.363, keluar Rp25.919.647, saldo Rp4.037.716.

Periksa manual setelahnya: cocokkan saldo kas, jumlah klien, dan total piutang dengan yang ada di prototipe. Kalau ada selisih, jangan lanjut sebelum ketemu sebabnya.

---

## Langkah 9 — Naikkan ke internet

```
npm install -g vercel
vercel
```

Ikuti prosesnya, lalu masukkan semua isi `.env.local` ke **Vercel → Project Settings → Environment Variables**.

Setelah itu aplikasinya bisa dibuka Tasya, Caca, dan Ipii dari mana saja.

---

## Urutan yang benar

Tahap 1 → 2 → impor data → 3 → 4 → 5 → 6. Jangan dibalik.

Sinkron sheet (Tahap 6) sengaja ditaruh terakhir. Menyambungkan sheet ke pembukuan yang belum benar hanya menyebarkan angka salah ke dua tempat.

Membangun fitur canggih di atas pembukuan yang belum benar hanya memperbanyak angka yang salah — dan angka salah di laporan pajak jauh lebih mahal daripada waktu yang dihemat dengan buru-buru.

---

## Kalau tersangkut

Saat Claude Code bingung atau hasilnya melenceng, ketik:

```
Baca ulang CLAUDE.md dan PRD.md, lalu jelaskan rencanamu sebelum menulis kode.
```

Kalau ada error yang tidak selesai setelah dua kali percobaan, salin pesan errornya lengkap dan minta:

```
Jangan tambal gejalanya. Cari akar masalahnya dulu, jelaskan ke saya, baru perbaiki.
```
