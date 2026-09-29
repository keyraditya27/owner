-- =====================================================================
-- TAHAP 2 — audit log otomatis, cap waktu ubah, bucket bukti
-- Jalankan SETELAH schema.sql, schema-tambahan-sheets.sql, dan
-- schema-perbaikan-tahap1.sql. Aman dijalankan berulang kali.
-- =====================================================================

-- ---------------------------------------------------------- AUDIT LOG
-- CLAUDE.md: setiap perubahan data masuk audit_log (siapa, kapan, tabel,
-- nilai lama, nilai baru). Dipasang sebagai trigger di database supaya
-- tidak ada jalur yang terlewat — form aplikasi, chat AI, sinkron sheet,
-- maupun skrip impor semuanya tercatat.
create or replace function catat_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  baris  jsonb := to_jsonb(coalesce(new, old));
  rid    uuid;
  asal   text;
begin
  begin
    rid := (baris->>'id')::uuid;
  exception when others then
    rid := null;                         -- mis. tutup_buku yang kuncinya teks
  end;

  asal := case
    when baris->>'sheet_sumber' = 'sheet' then 'sheet'
    when baris->>'sumber' in ('ai','impor') then baris->>'sumber'
    else 'manual'
  end;

  -- Lewati UPDATE yang tidak mengubah apa pun
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  insert into audit_log (pengguna_id, tabel, record_id, aksi, nilai_lama, nilai_baru, sumber)
  values (
    auth.uid(),
    tg_table_name,
    rid,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    asal
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['perusahaan','rekening','klien','tagihan','vendor',
                           'utang_vendor','transaksi','aset','mutasi_aset',
                           'pajak','tutup_buku','karyawan','payroll']
  loop
    execute format('drop trigger if exists audit on %I', t);
    execute format($f$
      create trigger audit after insert or update or delete on %1$I
      for each row execute function catat_audit();
    $f$, t);
  end loop;
end $$;

-- ------------------------------------------------ CAP WAKTU diubah_pada
create or replace function segarkan_diubah_pada()
returns trigger language plpgsql as $$
begin
  new.diubah_pada := now();
  return new;
end $$;

drop trigger if exists cap_diubah on transaksi;
create trigger cap_diubah before update on transaksi
  for each row execute function segarkan_diubah_pada();

-- -------------------------------------------------------- BUCKET BUKTI
-- Bucket privat. File diunggah & dibaca lewat server (service role) dan
-- ditampilkan ke pengguna hanya lewat signed URL yang kedaluwarsa.
insert into storage.buckets (id, name, public)
values ('bukti', 'bukti', false)
on conflict (id) do update set public = false;

-- ------------------------------------------- PERBAIKAN ANTREAN SHEET
-- Pemicu antrekan_ke_sheet() dari schema-tambahan-sheets.sql berjalan dengan
-- hak pengguna yang login. Tabel sinkron_antrean hanya boleh ditulis pemilik/
-- admin, jadi setiap kali STAF mencatat transaksi, insert-nya ditolak
-- ("new row violates row-level security policy for table sinkron_antrean").
-- Dijalankan sebagai pemilik fungsi supaya antrean tetap terisi untuk semua peran.
alter function antrekan_ke_sheet() security definer set search_path = public;

-- ------------------------------------------ PERBAIKAN KUNCI TUTUP BUKU
-- Versi di schema.sql hanya memeriksa tanggal BARU. Akibatnya transaksi di
-- bulan yang sudah ditutup bisa "dikeluarkan" dengan mengganti tanggalnya ke
-- bulan yang masih terbuka — angka laporan yang sudah dikirim ikut berubah.
-- Sekarang tanggal lama maupun baru sama-sama diperiksa.
create or replace function cegah_ubah_periode_tertutup()
returns trigger language plpgsql as $$
declare p text;
begin
  foreach p in array array[
    case when tg_op in ('UPDATE','DELETE') then to_char(old.tanggal, 'YYYY-MM') end,
    case when tg_op in ('INSERT','UPDATE') then to_char(new.tanggal, 'YYYY-MM') end
  ] loop
    if p is not null and exists (select 1 from tutup_buku where periode = p) then
      raise exception 'Periode % sudah ditutup. Buka dulu penutupannya sebelum mengubah data.', p;
    end if;
  end loop;
  return coalesce(new, old);
end $$;
