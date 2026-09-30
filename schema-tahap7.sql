-- =====================================================================
-- TAHAP 7 — MENGHAPUS DATA HANYA PEMILIK (KEY)
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Sebelumnya admin juga bisa menghapus transaksi dan master data (aturan
-- "kelola_*" berlaku untuk semua operasi). Sekarang ditambah aturan
-- RESTRICTIVE: aturan ini wajib lolos di samping aturan yang sudah ada,
-- jadi apa pun aturan lainnya, DELETE hanya jalan untuk peran pemilik.
--
-- Pengecualian yang sengaja dibiarkan:
--   * chat       — tiap orang tetap bisa membersihkan riwayat chat-nya sendiri
--   * pengajuan  — staf tetap bisa menarik pengajuannya sendiri yang masih menunggu
--   * Batalkan di chat AI (batalkan_perubahan, security definer, maks 24 jam,
--     hanya milik sendiri) — tetap bisa membatalkan data yang BARU dibuat AI
--   * hapus berantai (mis. tagihan ikut terhapus saat klien dihapus pemilik)
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'perusahaan','pengguna','rekening','klien','tagihan','vendor','utang_vendor',
    'transaksi','aset','mutasi_aset','pajak','karyawan','payroll','tutup_buku',
    'audit_log','ai_riwayat',
    'sinkron_antrean','sinkron_log','sinkron_konflik','sinkron_hilang','sinkron_status']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists "hapus_hanya_pemilik" on %I', t);
    execute format($f$
      create policy "hapus_hanya_pemilik" on %I as restrictive for delete
      using (peran_saya() = 'pemilik');
    $f$, t);
  end loop;
end $$;

-- File bukti di Storage: tidak ada yang boleh menghapus lewat akun login
-- (unggah/baca lewat server). Tidak perlu aturan tambahan.
