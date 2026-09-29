---
name: gaya-arl
description: Gaya visual resmi PT Arah Ruang Langit (ARL) untuk laporan, dashboard, halaman, dan dokumen HTML. Pakai setiap kali membuat keluaran visual untuk ARL atau kliennya — laporan iklan, bedah toko, rekap keuangan, proposal — supaya warna, huruf, logo, dan komponennya konsisten.
---

# Gaya visual ARL

Sumber: prototipe `arl-keuangan-v7.html` (repo `keyraditya27/owner`). Semua token dan komponen sudah dirangkum di `aset/arl.css` — **salin isinya ke `<style>`**, jangan menulis ulang dari ingatan.

## Aturan tetap

1. **Logo wajib, apa adanya.** `aset/arl-putih.png` di atas latar navy/gelap, `aset/arl-gelap.png` di atas latar terang. Tinggi 40px di hero. Jangan digambar ulang, diwarnai ulang, atau diganti ikon. Untuk file HTML mandiri, sisipkan sebagai data URI base64 supaya tidak putus saat file dikirim.
2. **Warna** (hanya ini):
   | Nama | Hex | Dipakai untuk |
   |---|---|---|
   | navy | `#0A2540` | teks utama, hero, header tabel |
   | biru (sky) | `#1B6FE3` | aksen, tombol, KPI netral |
   | horizon | `#4FA3F7` | aksen sekunder, grafik |
   | hijau | `#0FB88F` | naik, lunas, sehat |
   | amber | `#F5A623` | perlu perhatian |
   | merah | `#E5484D` | turun, telat, rugi |
   | krem | `#F5F7FA` | latar kartu |
   | garis | `#E3E9F0` | border |
   | muted | `#6B7C93` | teks keterangan |
3. **Huruf:** judul serif `Cambria, Georgia, serif`; isi sans `Calibri, 'Segoe UI', Arial, sans-serif`. Angka memakai `font-variant-numeric: tabular-nums`.
4. **Bahasa Indonesia**, nada langsung, tanpa kata "Anda".

## Susunan halaman

1. **Hero navy bergradien** (`.hero`): baris atas logo putih + nama di kiri, badge di kanan (mis. "Laporan Mingguan"). Di bawahnya `h1` judul dan `.sub` keterangan periode.
2. **Bar periode / sub-tab** bila halamannya punya beberapa sudut pandang.
3. **Seksi** (`section`) masing-masing diawali ikon bulat berwarna (`.ic`) + `h2` + `.sec-desc`.
4. **Kartu KPI** (`.kpis` > `.kpi`) — garis atas berwarna sesuai kondisi: `.hl` hijau (bagus), `.warn` amber, `.bad` merah, tanpa kelas = biru netral. Isi: label kapital kecil, nilai serif, catatan perubahan (`.up` / `.dn`).
5. **Tabel**: header navy huruf kapital, baris zebra, angka rata kanan (`.r`), baris total di `tfoot` bergaris atas navy.
6. **Kotak insight** (`.ins`) berbatas kiri berwarna: `.good`, `.warn`, `.bad`. Satu insight = satu temuan + satu saran tindakan.
7. **Pill** status (`.pill .p-green` dst.) untuk label pendek.

## Tata letak

- Konten di kartu putih bersudut 16px di atas latar `#EEF2F7`, lebar maksimum ±1100px.
- Harus rapi di HP: KPI jadi 2 kolom di bawah 900px dan 1 kolom di bawah 620px; tabel lebar dibungkus `overflow-x:auto`.
- Cetak/PDF: sembunyikan tombol, pertahankan warna hero (`print-color-adjust: exact`).

## Grafik

Warna seri berurutan: biru `#1B6FE3`, horizon `#4FA3F7`, hijau `#0FB88F`, amber `#F5A623`, navy `#0A2540`. Merah hanya untuk nilai negatif atau buruk, bukan sekadar seri ke-6.

## Contoh

`aset/contoh.html` — halaman contoh berisi semua komponen. Buka untuk melihat hasil akhirnya, salin strukturnya.
