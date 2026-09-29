-- =====================================================================
-- TAHAP 6 — sinkron dua arah Google Sheets
-- Jalankan SETELAH schema-tahap5.sql. Aman dijalankan berulang kali.
-- (schema-tambahan-sheets.sql harus sudah dijalankan sebelumnya.)
-- =====================================================================

-- Kolom Catatan di tab Transaksi (integrasi-google-sheets.md kolom K)
alter table transaksi add column if not exists catatan text;

-- Sidik baris terakhir yang disinkronkan. Dipakai untuk tahu sisi mana yang
-- berubah sejak sinkron terakhir: aplikasi, sheet, atau dua-duanya (bentrok).
do $$
declare t text;
begin
  foreach t in array array['transaksi','klien','tagihan','vendor','utang_vendor','aset','pajak','rekening']
  loop
    execute format('alter table %I add column if not exists sheet_hash text', t);
    execute format('alter table %I add column if not exists diubah_pada timestamptz not null default now()', t);
  end loop;
end $$;

-- diubah_pada = kapan data berubah di aplikasi. Penulisan oleh proses sinkron
-- (yang mengubah sheet_diubah) menyamakan diubah_pada dengan sheet_diubah,
-- supaya tidak dianggap "berubah di aplikasi" lagi.
create or replace function segarkan_diubah_pada()
returns trigger language plpgsql as $$
begin
  if new.sheet_diubah is distinct from old.sheet_diubah then
    new.diubah_pada := coalesce(new.sheet_diubah, now());
  else
    new.diubah_pada := now();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['transaksi','klien','tagihan','vendor','utang_vendor','aset','pajak','rekening']
  loop
    execute format('drop trigger if exists cap_diubah on %I', t);
    execute format('create trigger cap_diubah before update on %I for each row execute function segarkan_diubah_pada()', t);
  end loop;
end $$;

-- Antrean: penulisan oleh proses sinkron sendiri tidak diantre balik ke sheet.
-- Versi di schema-tambahan-sheets.sql memakai sheet_sumber = 'sheet' sebagai
-- penanda. Masalahnya kolom itu tetap 'sheet' setelahnya, sehingga perubahan
-- berikutnya dari APLIKASI pada baris yang sama tidak pernah diantre lagi.
-- Penandanya sekarang: sheet_diubah ikut berubah di pernyataan yang sama.
create or replace function antrekan_ke_sheet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.sheet_sumber, 'aplikasi') = 'sheet' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.sheet_diubah is distinct from old.sheet_diubah then
    return new;
  end if;
  insert into sinkron_antrean (tabel, record_id, aksi)
  values (tg_table_name, coalesce(new.id, old.id),
          case when tg_op = 'DELETE' then 'arsip' else 'upsert' end);
  return coalesce(new, old);
end $$;

-- Perubahan aplikasi mengembalikan sheet_sumber ke 'aplikasi'.
create or replace function tandai_sumber_aplikasi()
returns trigger language plpgsql as $$
begin
  if new.sheet_diubah is not distinct from old.sheet_diubah then
    new.sheet_sumber := 'aplikasi';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['transaksi','klien','tagihan','vendor','utang_vendor','aset','pajak','rekening']
  loop
    execute format('drop trigger if exists sumber_aplikasi on %I', t);
    execute format('create trigger sumber_aplikasi before update on %I for each row execute function tandai_sumber_aplikasi()', t);
  end loop;
end $$;

-- Audit log: jangan catat pembaruan yang hanya menyentuh kolom pelacak sinkron.
create or replace function catat_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  baris  jsonb := to_jsonb(coalesce(new, old));
  rid    uuid;
  asal   text;
  abaikan text[] := array['sheet_diubah','sheet_sumber','sheet_hash','diubah_pada'];
begin
  begin
    rid := (baris->>'id')::uuid;
  exception when others then
    rid := null;
  end;
  if tg_op = 'UPDATE' and (to_jsonb(old) - abaikan) = (to_jsonb(new) - abaikan) then
    return new;
  end if;
  asal := case
    when baris->>'sheet_sumber' = 'sheet' then 'sheet'
    when baris->>'sumber' in ('ai','impor') then baris->>'sumber'
    else 'manual'
  end;
  insert into audit_log (pengguna_id, tabel, record_id, aksi, nilai_lama, nilai_baru, sumber)
  values (auth.uid(), tg_table_name, rid, lower(tg_op),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          asal);
  return coalesce(new, old);
end $$;

-- Kunci sinkron: hanya satu proses sinkron berjalan pada satu waktu
-- (pemicu dari beberapa HP/desktop yang terbuka bersamaan tidak saling tabrak).
alter table sinkron_status add column if not exists kunci_sampai timestamptz;

create or replace function klaim_sinkron(p_detik int default 120)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update sinkron_status set kunci_sampai = now() + make_interval(secs => p_detik)
   where arah = 'ke_sheet' and (kunci_sampai is null or kunci_sampai < now());
  return found;
end $$;

create or replace function lepas_sinkron()
returns void language sql security definer set search_path = public as $$
  update sinkron_status set kunci_sampai = null where arah = 'ke_sheet';
$$;

revoke all on function klaim_sinkron(int) from public, anon, authenticated;
revoke all on function lepas_sinkron() from public, anon, authenticated;
grant execute on function klaim_sinkron(int) to service_role;
grant execute on function lepas_sinkron() to service_role;

-- Kunci tutup buku: pembaruan yang HANYA menyentuh kolom pelacak sinkron
-- (sidik, cap waktu, sumber) boleh lewat. Isi transaksinya tetap terkunci —
-- tanpa ini, transaksi bulan yang sudah ditutup tidak pernah bisa ditulis ke sheet.
create or replace function cegah_ubah_periode_tertutup()
returns trigger language plpgsql as $$
declare
  p text;
  abaikan text[] := array['sheet_diubah','sheet_sumber','sheet_hash','diubah_pada'];
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - abaikan) = (to_jsonb(new) - abaikan) then
    return new;
  end if;
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
