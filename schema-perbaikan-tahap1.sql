-- =====================================================================
-- PERBAIKAN SKEMA — Tahap 1
-- Jalankan SETELAH schema.sql (dan schema-tambahan-sheets.sql kalau sudah).
-- Aman dijalankan berulang kali.
-- =====================================================================

-- Masalahnya: schema.sql menyalakan RLS di tabel `pengguna` tapi tidak
-- memberi satu pun aturan baca. Semua aturan "baca_*" di tabel lain
-- memeriksa `exists (select 1 from pengguna where id = auth.uid() and aktif)`,
-- dan subquery itu ikut tunduk pada RLS `pengguna`. Tanpa aturan di bawah,
-- hasilnya selalu kosong → tidak ada satu pun pengguna yang bisa membaca data.

drop policy if exists "baca_pengguna" on pengguna;
create policy "baca_pengguna" on pengguna for select
  using (id = auth.uid() or peran_saya() in ('pemilik','admin'));

-- Menambah, mengubah peran, atau menonaktifkan anggota tim hanya lewat
-- server (service role) di halaman Tim — sengaja tidak ada aturan tulis
-- untuk pengguna biasa di sini.
