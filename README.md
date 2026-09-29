# ARL Keuangan Internal

Sistem keuangan internal PT Arah Ruang Langit. Bisa dibuka dari browser di desktop maupun HP, dan bisa **dipasang di HP seperti aplikasi** (PWA). Semua perangkat membaca database yang sama di Supabase, jadi data yang dicatat di HP langsung terlihat di desktop.

Konteks bisnis dan aturan kode ada di `CLAUDE.md`. Urutan pembangunan ada di `prompt-tahap.md`.

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Fondasi: Next.js, login, halaman Tim, kerangka tata letak, PWA | ✅ |
| 2 | Ringkasan, Transaksi, Klien & Tagihan + bar periode | ✅ |
| — | Impor data Juni–September | ✅ skrip siap (`npm run impor`) |
| 3 | Chat AI dengan aksi | belum |
| 4 | Aset, Pajak, Laporan | belum |
| 5 | Hak akses, tutup buku, riwayat, persetujuan, backup | belum |
| 6 | Sinkron Google Sheets | belum |

## Menyiapkan database (sekali saja)

Di Supabase → SQL Editor, jalankan berurutan:

1. `schema.sql`
2. `schema-tambahan-sheets.sql`
3. `schema-perbaikan-tahap1.sql` — **wajib**. Tanpa ini tidak ada yang bisa membaca profilnya sendiri (login ditolak) dan staf tidak bisa membaca data apa pun.
4. `schema-tahap2.sql` — **wajib**. Isinya: audit log otomatis untuk semua tabel, bucket `bukti` (privat), dan dua perbaikan: staf tidak bisa mencatat transaksi karena pemicu antrean sheet, dan kunci tutup buku yang bisa diakali dengan mengganti tanggal.

Semua file aman dijalankan ulang. Keempatnya sudah diuji di Postgres 16.

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

## Akun pertama

Buka `/mulai` untuk membuat akun **pemilik**. Halaman ini hanya bisa dipakai sekali — begitu sudah ada pengguna, halaman ini terkunci.

## Menambah anggota tim

Login sebagai pemilik → menu **Tim** → isi nama, email, password sementara, dan peran (staf/admin). Berikan email dan password sementara langsung ke orangnya.

## Memasang di HP

Setelah aplikasi online (Vercel), buka alamatnya di HP:

- **Android (Chrome):** menu ⋮ → *Instal aplikasi* / *Tambahkan ke layar utama*.
- **iPhone (Safari):** tombol Bagikan → *Tambahkan ke Layar Utama*.

Ikon ARL muncul di layar utama dan aplikasi terbuka layar penuh tanpa bilah browser. Di desktop (Chrome/Edge) ada ikon pasang di ujung kanan kolom alamat.

Pemasangan PWA butuh HTTPS, jadi tidak jalan di `http://localhost` dari HP — pakai alamat Vercel.

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
public/
  sw.js                service worker (tidak meng-cache data keuangan)
  ikon/ logo/          dibuat oleh `npm run ikon`
logo/                  logo resmi ARL (sumber)
```
