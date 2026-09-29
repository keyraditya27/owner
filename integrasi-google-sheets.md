# Integrasi Google Sheets — Sinkron Dua Arah

Sheet target: `1YTJYOXRZGH4SN8Hw_3w7IKIoonDoWWjpZ-7cxIj5Uck` (KEUANGAN ARL)

Tujuan: apa pun yang diisi di aplikasi langsung muncul di sheet, dan apa pun yang diketik di sheet ikut masuk ke aplikasi.

---

## Kenapa harus service account

Ada tiga cara menyambung ke Google Sheets:

| Cara | Kelebihan | Kekurangan |
|---|---|---|
| OAuth per pengguna | Tiap orang pakai akunnya sendiri | Perlu consent screen, token kedaluwarsa, tiap anggota tim harus login lagi |
| Apps Script | Tanpa server | Tidak bisa dipanggil dari aplikasi dengan aman, sulit diuji |
| **Service account** | Sekali setup, tidak pernah kedaluwarsa, tidak tergantung akun siapa pun | Kuncinya harus dijaga di server |

Untuk satu sheet milik satu perusahaan, **service account** paling masuk akal. Aplikasi punya identitas sendiri, dan sheet cukup dibagikan ke identitas itu seperti membagikan ke rekan kerja.

---

## Menyiapkan service account

1. Buka **console.cloud.google.com**, masuk dengan akun `arahruanglangit@gmail.com` (pemilik sheet).
2. Klik dropdown proyek di atas → **New Project**. Nama: `arl-keuangan`. Create.
3. Setelah proyek aktif, buka **APIs & Services → Library**, cari **Google Sheets API**, klik **Enable**.
4. Buka **APIs & Services → Credentials → Create Credentials → Service Account**.
   Nama: `arl-sheets-sync`. Create and continue. Role boleh dilewati. Done.
5. Klik service account yang baru dibuat → tab **Keys** → **Add Key → Create new key → JSON** → Create.
   File JSON otomatis terunduh. **Ini kunci rahasia — jangan pernah masuk GitHub.**
6. Buka file JSON itu, salin nilai `client_email`. Bentuknya seperti
   `arl-sheets-sync@arl-keuangan.iam.gserviceaccount.com`.
7. Buka sheet KEUANGAN ARL → **Share** → tempel email tadi → beri akses **Editor** → Send.
   Abaikan peringatan "tidak bisa mengirim notifikasi ke akun ini", itu normal.

Dari file JSON, dua nilai yang dipakai aplikasi: `client_email` dan `private_key`.

---

## Struktur sheet

Aplikasi membuat dan mengelola tab-tab berikut. Kalau belum ada, dibuat otomatis saat sinkron pertama.

| Tab | Isi |
|---|---|
| `Transaksi` | Semua kas masuk dan keluar |
| `Klien` | Data klien |
| `Tagihan` | Invoice per periode |
| `Vendor` | Data vendor |
| `Utang` | Tagihan dari vendor |
| `Aset` | Aset tetap dan inventaris |
| `Pajak` | Kewajiban pajak |
| `Rekening` | Daftar rekening |
| `Ringkasan` | Rumus otomatis — **jangan diedit manual** |

### Kolom tab Transaksi

```
A  ID              uuid, dibuat aplikasi — JANGAN diubah manual
B  Tanggal         YYYY-MM-DD
C  Tipe            Masuk | Keluar
D  Keterangan      teks bebas
E  Kategori        harus salah satu dari daftar kategori
F  Klien           nama klien, kosongkan kalau internal
G  Rekening        nama rekening
H  Nominal         angka bulat, tanpa titik atau "Rp"
I  Metode          Transfer bank | Cash | E-wallet | Kartu
J  Bukti           tautan ke file di Storage
K  Catatan         teks bebas
L  Diubah          timestamp ISO — diisi otomatis
M  Sumber          aplikasi | sheet | ai
N  Status          aktif | dihapus
```

Kolom A, L, M, N diisi aplikasi. Kalau Key mengetik baris baru di sheet dan mengosongkan kolom A, aplikasi menganggapnya baris baru dan membuatkan ID-nya.

### Aturan penting untuk tab lain

Pola yang sama berlaku: kolom pertama selalu `ID`, tiga kolom terakhir selalu `Diubah`, `Sumber`, `Status`. Konsistensi ini yang membuat kode sinkronnya satu fungsi, bukan sembilan.

---

## Cara sinkronnya bekerja

### Aplikasi ke sheet

Setiap perubahan data memasukkan pekerjaan ke antrean `sinkron_antrean`. Sebuah proses latar mengosongkan antrean tiap 30 detik dan menulis ke sheet dalam satu panggilan `batchUpdate`, bukan satu panggilan per baris.

Kenapa diantre dan tidak langsung: kuota Sheets API sekitar 60 permintaan per menit per pengguna. Kalau chat AI membuat lima perubahan sekaligus dan tiap perubahan memicu satu panggilan, kuota cepat habis. Diantre lalu digabung jauh lebih hemat.

### Sheet ke aplikasi

Tiga pemicu:

1. **Berkala** — cron Vercel tiap 5 menit membaca seluruh sheet dan membandingkan.
2. **Manual** — tombol **Tarik dari Sheet** di aplikasi.
3. **Saat halaman dibuka** — kalau sinkron terakhir lebih dari 5 menit lalu.

Perbandingannya per baris berdasarkan kolom `ID`:

- ID ada di sheet tapi tidak di database → baris baru, buat di database
- ID ada di keduanya, `Diubah` di sheet lebih baru → perbarui database
- ID ada di database tapi hilang dari sheet → **jangan dihapus**, tandai untuk ditinjau
- `Status` di sheet berubah jadi `dihapus` → arsipkan di database

Baris yang dihapus manual dari sheet tidak menghapus data di aplikasi. Ini disengaja: satu tarikan mouse yang salah di spreadsheet tidak boleh menghapus pembukuan.

### Kalau bentrok

Dua orang mengubah baris yang sama dalam satu jendela sinkron. Yang menang: **timestamp `Diubah` paling baru**. Yang kalah dicatat di `sinkron_konflik` dengan nilai lama dan nilai baru, dan muncul sebagai notifikasi di aplikasi supaya bisa diperiksa manusia.

Jangan diam-diam menimpa. Kalau Key mengubah nominal di sheet dan Tasya mengubah keterangan di aplikasi pada menit yang sama, keduanya harus tahu.

---

## Validasi masuk dari sheet

Sheet adalah pintu masuk data yang tidak divalidasi. Sebelum masuk database, setiap baris diperiksa:

- `Nominal` harus angka bulat ≥ 0. Buang titik, koma, dan "Rp" dulu.
- `Tanggal` harus format `YYYY-MM-DD` yang valid.
- `Kategori` harus ada di daftar kategori. Kalau tidak cocok, tolak barisnya.
- `Tipe` harus `Masuk` atau `Keluar`.
- `Klien` dan `Rekening` dicocokkan ke data yang ada. Kalau tidak ketemu, tolak — jangan buat klien baru diam-diam dari salah ketik.
- Baris di periode yang sudah **tutup buku** ditolak.

Baris yang ditolak diberi latar merah di sheet dan alasannya ditulis di kolom `Catatan`. Jangan dibuang tanpa kabar.

---

## Yang tidak boleh disinkronkan

- **Data gaji dan payroll.** Sheet bisa dibuka siapa saja yang punya tautan. Gaji tidak boleh ada di sana.
- **Isi bukti transfer.** Yang disinkronkan hanya tautannya, dan tautan itu signed URL yang kedaluwarsa.
- **Kunci API dan kredensial** — jelas.
- **Tab `Ringkasan`** — isinya rumus yang membaca tab lain. Aplikasi hanya menulis ke tab data.

---

## Kolom tambahan di database

```sql
alter table transaksi    add column sheet_diubah timestamptz;
alter table transaksi    add column sheet_sumber text default 'aplikasi';
alter table transaksi    add column arsip        boolean default false;
-- ulangi untuk klien, tagihan, vendor, utang_vendor, aset, pajak, rekening

create table sinkron_antrean (
  id          bigserial primary key,
  tabel       text not null,
  record_id   uuid not null,
  aksi        text not null,          -- upsert | arsip
  dibuat_pada timestamptz not null default now(),
  diproses    boolean not null default false
);

create table sinkron_log (
  id            bigserial primary key,
  arah          text not null,        -- ke_sheet | dari_sheet
  tabel         text,
  baris_diproses int default 0,
  baris_ditolak  int default 0,
  pesan         text,
  waktu         timestamptz not null default now()
);

create table sinkron_konflik (
  id          bigserial primary key,
  tabel       text not null,
  record_id   uuid,
  nilai_app   jsonb,
  nilai_sheet jsonb,
  pemenang    text,                   -- app | sheet
  ditinjau    boolean default false,
  waktu       timestamptz not null default now()
);
```

---

## Batas yang perlu diketahui

- Kuota Sheets API: 60 permintaan baca dan 60 tulis per menit. Cukup jauh untuk ARL asal memakai `batchUpdate`.
- Satu sheet maksimal 10 juta sel. Dengan 14 kolom, itu sekitar 700 ribu baris. Tidak akan tercapai.
- Sinkron bukan pengganti backup. Tetap ekspor JSON mingguan ke Storage.

---

## Cara mengujinya

Setelah dibangun, uji enam hal ini satu per satu:

1. Catat transaksi di aplikasi → dalam 30 detik muncul di sheet dengan ID terisi.
2. Ketik baris baru di sheet tanpa ID → dalam 5 menit muncul di aplikasi.
3. Ubah nominal di sheet → nilainya ikut berubah di aplikasi.
4. Ketik kategori yang salah di sheet → baris jadi merah, tidak masuk ke aplikasi.
5. Hapus baris dari sheet → data di aplikasi **tetap ada**, muncul peringatan.
6. Ubah baris yang sama di dua tempat sekaligus → yang terbaru menang, konfliknya tercatat.

Kalau nomor 4 dan 5 tidak berperilaku seperti ini, sinkronnya belum aman dipakai.
