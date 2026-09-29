-- =====================================================================
-- TAMBAHAN SKEMA — Sinkron Google Sheets
-- Jalankan SETELAH schema.sql. Tempel ke Supabase SQL Editor lalu Run.
-- =====================================================================

-- Kolom pelacak sinkron di semua tabel yang ikut dicerminkan ke sheet.
-- Payroll dan karyawan sengaja TIDAK ikut — sheet bisa dibuka siapa saja
-- yang punya tautan, dan gaji tidak boleh ada di sana.
do $$
declare t text;
begin
  foreach t in array array['transaksi','klien','tagihan','vendor',
                           'utang_vendor','aset','pajak','rekening']
  loop
    execute format('alter table %I add column if not exists sheet_diubah timestamptz', t);
    execute format('alter table %I add column if not exists sheet_sumber text default ''aplikasi''', t);
    execute format('alter table %I add column if not exists arsip boolean not null default false', t);
    execute format('create index if not exists %I on %I (sheet_diubah)', 'idx_'||t||'_sheet', t);
  end loop;
end $$;

-- Antrean tulis ke sheet. Dikosongkan tiap 30 detik dalam satu batchUpdate.
create table if not exists sinkron_antrean (
  id          bigserial primary key,
  tabel       text not null,
  record_id   uuid not null,
  aksi        text not null check (aksi in ('upsert','arsip')),
  dibuat_pada timestamptz not null default now(),
  diproses    boolean not null default false,
  percobaan   int not null default 0,
  pesan_error text
);
create index if not exists idx_antrean_belum on sinkron_antrean (dibuat_pada)
  where diproses = false;

-- Riwayat tiap putaran sinkron. Untuk menelusuri kalau ada yang aneh.
create table if not exists sinkron_log (
  id             bigserial primary key,
  arah           text not null check (arah in ('ke_sheet','dari_sheet')),
  tabel          text,
  baris_diproses int not null default 0,
  baris_ditolak  int not null default 0,
  durasi_ms      int,
  pesan          text,
  waktu          timestamptz not null default now()
);
create index if not exists idx_sinkron_log_waktu on sinkron_log (waktu desc);

-- Bentrok: dua sumber mengubah baris yang sama dalam satu jendela sinkron.
-- Yang menang ditentukan timestamp terbaru, yang kalah dicatat di sini
-- supaya manusia bisa memeriksanya. Jangan pernah menimpa diam-diam.
create table if not exists sinkron_konflik (
  id          bigserial primary key,
  tabel       text not null,
  record_id   uuid,
  nilai_app   jsonb,
  nilai_sheet jsonb,
  pemenang    text check (pemenang in ('app','sheet')),
  ditinjau    boolean not null default false,
  waktu       timestamptz not null default now()
);
create index if not exists idx_konflik_belum on sinkron_konflik (waktu desc)
  where ditinjau = false;

-- Baris yang hilang dari sheet TIDAK dihapus dari database.
-- Dicatat di sini untuk ditinjau pemilik.
create table if not exists sinkron_hilang (
  id          bigserial primary key,
  tabel       text not null,
  record_id   uuid not null,
  data        jsonb,
  ditinjau    boolean not null default false,
  waktu       timestamptz not null default now()
);

-- Kapan terakhir sinkron berhasil, per arah. Dipakai untuk memutuskan
-- apakah perlu menarik ulang saat halaman dibuka.
create table if not exists sinkron_status (
  arah        text primary key check (arah in ('ke_sheet','dari_sheet')),
  terakhir    timestamptz,
  sukses      boolean default true,
  pesan       text
);
insert into sinkron_status (arah) values ('ke_sheet'), ('dari_sheet')
  on conflict do nothing;

-- Keamanan: hanya pemilik dan admin yang boleh melihat isi tabel sinkron.
alter table sinkron_antrean enable row level security;
alter table sinkron_log     enable row level security;
alter table sinkron_konflik enable row level security;
alter table sinkron_hilang  enable row level security;
alter table sinkron_status  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sinkron_antrean','sinkron_log','sinkron_konflik',
                           'sinkron_hilang','sinkron_status']
  loop
    execute format($f$
      create policy "kelola_%1$s" on %1$I for all
      using (peran_saya() in ('pemilik','admin'));
    $f$, t);
  end loop;
end $$;

-- Pemicu: setiap perubahan data otomatis masuk antrean tulis ke sheet.
create or replace function antrekan_ke_sheet()
returns trigger language plpgsql as $$
begin
  -- Perubahan yang datang DARI sheet tidak diantre balik ke sheet,
  -- kalau tidak akan jadi gema tanpa henti.
  if tg_op <> 'DELETE' and coalesce(new.sheet_sumber,'aplikasi') = 'sheet' then
    return new;
  end if;

  insert into sinkron_antrean (tabel, record_id, aksi)
  values (tg_table_name,
          coalesce(new.id, old.id),
          case when tg_op = 'DELETE' then 'arsip' else 'upsert' end);

  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['transaksi','klien','tagihan','vendor',
                           'utang_vendor','aset','pajak','rekening']
  loop
    execute format('drop trigger if exists antre_sheet on %I', t);
    execute format($f$
      create trigger antre_sheet after insert or update or delete on %1$I
      for each row execute function antrekan_ke_sheet();
    $f$, t);
  end loop;
end $$;
