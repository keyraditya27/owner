# ARL Keuangan Internal

Sistem keuangan internal PT Arah Ruang Langit. Bisa dibuka dari browser di desktop maupun HP, dan bisa **dipasang di HP seperti aplikasi** (PWA). Semua perangkat membaca database yang sama di Supabase, jadi data yang dicatat di HP langsung terlihat di desktop.

Konteks bisnis dan aturan kode ada di `CLAUDE.md`. Urutan pembangunan ada di `prompt-tahap.md`.

## Status

| Tahap | Isi | Status |
|---|---|---|
| 1 | Fondasi: Next.js, login, halaman Tim, kerangka tata letak, PWA | ✅ |
| 2 | Ringkasan, Transaksi, Klien & Tagihan + bar periode | ✅ |
| — | Impor data Juni–September | ✅ skrip siap (`npm run impor`) |
| 3 | Chat AI dengan aksi (Gemini, lewat server) | ✅ |
| 4 | Aset & Inventaris, Pajak, Laporan + CSV & cetak PDF | ✅ |
| 5 | Hak akses, tutup buku, riwayat, persetujuan, backup | ✅ |
| 6 | Sinkron Google Sheets | belum |

## Menyiapkan database (sekali saja)

Di Supabase → SQL Editor, jalankan berurutan:

1. `schema.sql`
2. `schema-tambahan-sheets.sql`
3. `schema-perbaikan-tahap1.sql` — **wajib**. Tanpa ini tidak ada yang bisa membaca profilnya sendiri (login ditolak) dan staf tidak bisa membaca data apa pun.
4. `schema-tahap2.sql` — **wajib**. Isinya: audit log otomatis untuk semua tabel, bucket `bukti` (privat), dan dua perbaikan: staf tidak bisa mencatat transaksi karena pemicu antrean sheet, dan kunci tutup buku yang bisa diakali dengan mengganti tanggal.

5. `schema-tahap3.sql` — fungsi yang menjalankan perubahan dari chat AI dalam **satu transaksi** (semua atau tidak sama sekali) dan tombol **Batalkan**.
6. `schema-tahap5.sql` — hak akses per peran, tutup buku, antrean persetujuan pengeluaran, bucket `backup`.

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

Isi `GEMINI_API_KEY` di `.env.local` (dan di Vercel → Environment Variables). Kunci ini hanya dipakai di server (`/api/chat`), tidak pernah sampai ke browser.

- Model dipilih otomatis lewat ListModels: Flash stabil versi tertinggi. Kalau sedang sibuk (Google membalas 503), dicoba Flash versi di bawahnya, lalu `gemini-flash-latest`, lalu versi lite. `GEMINI_MODEL` bisa memaksa satu model.
- Setiap aksi dari model divalidasi di server: nominal harus bilangan bulat positif, tanggal `YYYY-MM-DD`, klien/vendor harus cocok dan tidak ambigu, kategori harus dari daftar, peran harus boleh, periode tidak boleh sudah tutup buku. Yang tidak lolos ditolak beserta alasannya; sisanya tetap jalan.
- Staf hanya boleh mencatat transaksi dan mengubah transaksinya sendiri lewat chat.
- **Beda dengan prototipe:** kalau Gemini tidak bisa dihubungi, mode offline hanya menjawab pertanyaan (saldo, siapa belum bayar, rekap) dan **tidak menyimpan apa pun**. Parser kata kunci prototipe terbukti mencatat koreksi sebagai transaksi baru (dobel), jadi tidak dipakai untuk menulis data.

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
| Riwayat perubahan, backup, Tim | ✓ | ✗ | ✗ |

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
