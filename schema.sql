-- =====================================================================
-- ARL KEUANGAN INTERNAL — Skema Database (Postgres / Supabase)
-- Tempel seluruh isi file ini ke Supabase SQL Editor lalu klik Run.
-- Semua nilai uang disimpan sebagai bigint dalam rupiah bulat.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- ENUM
create type peran_pengguna    as enum ('pemilik','admin','staf');
create type tipe_transaksi    as enum ('masuk','keluar');
create type jenis_rekening    as enum ('Bank','Kas','E-wallet');
create type jenis_aset        as enum ('tetap','inventaris');
create type kelompok_fiskal   as enum ('1','2','3','4','bp','bnp');
create type metode_susut      as enum ('garis_lurus','saldo_menurun');
create type kondisi_aset      as enum ('Baik','Perlu perbaikan','Rusak');
create type status_aset       as enum ('Aktif','Dilepas','Hilang');
create type jenis_pajak       as enum ('PPh 21','PPh 23','PPh 4(2)','PPN Keluaran','PPh 25');

-- ---------------------------------------------------------- PERUSAHAAN
create table perusahaan (
  id                  uuid primary key default gen_random_uuid(),
  nama                text not null default 'PT Arah Ruang Langit',
  npwp                text,
  pkp                 boolean not null default false,
  alamat              text,
  modal_disetor       bigint not null default 0,
  batas_kapitalisasi  bigint not null default 5000000,
  tahun_buku          int    not null default extract(year from now()),
  logo_url            text,
  dibuat_pada         timestamptz not null default now()
);

-- ------------------------------------------------------------ PENGGUNA
-- Terhubung ke auth.users bawaan Supabase.
create table pengguna (
  id            uuid primary key references auth.users(id) on delete cascade,
  nama          text not null,
  peran         peran_pengguna not null default 'staf',
  aktif         boolean not null default true,
  dibuat_pada   timestamptz not null default now()
);

-- ------------------------------------------------------------ REKENING
create table rekening (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  jenis       jenis_rekening not null default 'Bank',
  bank        text,
  no_rek      text,                        -- simpan 4 digit terakhir saja
  saldo_awal  bigint not null default 0,
  catatan     text,
  urutan      int not null default 0,
  aktif       boolean not null default true,
  dibuat_pada timestamptz not null default now()
);
comment on column rekening.no_rek is
  'Hanya 4 digit terakhir. Jangan simpan nomor rekening lengkap.';

-- --------------------------------------------------------------- KLIEN
create table klien (
  id             uuid primary key default gen_random_uuid(),
  nama           text not null unique,
  pic            text,
  wa             text,
  npwp           text,
  paket          text,
  nilai_bulanan  bigint not null default 0,
  tanggal_tagih  int not null default 1 check (tanggal_tagih between 1 and 28),
  tempo_hari     int not null default 7  check (tempo_hari between 0 and 90),
  catatan        text,
  aktif          boolean not null default true,
  dibuat_pada    timestamptz not null default now()
);

-- ------------------------------------------------------------- TAGIHAN
create table tagihan (
  id               uuid primary key default gen_random_uuid(),
  klien_id         uuid not null references klien(id) on delete cascade,
  nomor_invoice    text unique,
  periode          text not null,                    -- "September 2026"
  nominal          bigint not null check (nominal >= 0),
  ppn              bigint not null default 0,
  pph23_dipotong   bigint not null default 0,        -- 2% yang dipotong klien
  bukti_potong_url text,                             -- WAJIB dikejar, ini kredit pajak
  dibayar          bigint not null default 0 check (dibayar >= 0),
  tgl_invoice      date not null default current_date,
  jatuh_tempo      date not null,
  catatan          text,
  dibuat_pada      timestamptz not null default now(),
  constraint dibayar_tidak_lebih check (dibayar <= nominal + ppn)
);
create index on tagihan (klien_id);
create index on tagihan (jatuh_tempo) where dibayar = 0;

-- -------------------------------------------------------------- VENDOR
create table vendor (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null unique,
  jenis       text not null default 'Lain-lain',
  wa          text,
  npwp        boolean not null default false,   -- false → PPh 23 jadi 4%
  catatan     text,
  dibuat_pada timestamptz not null default now()
);

create table utang_vendor (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references vendor(id) on delete cascade,
  keterangan  text not null,
  nominal     bigint not null check (nominal >= 0),
  dibayar     bigint not null default 0,
  jatuh_tempo date not null,
  catatan     text,
  dibuat_pada timestamptz not null default now(),
  constraint utang_tidak_lebih check (dibayar <= nominal)
);
create index on utang_vendor (vendor_id);
create index on utang_vendor (jatuh_tempo) where dibayar = 0;

-- ----------------------------------------------------------- TRANSAKSI
create table transaksi (
  id             uuid primary key default gen_random_uuid(),
  tanggal        date not null,
  tipe           tipe_transaksi not null,
  nominal        bigint not null check (nominal >= 0),
  kategori       text not null,
  keterangan     text not null,
  metode         text not null default 'Transfer bank',
  klien_id       uuid references klien(id) on delete set null,
  vendor_id      uuid references vendor(id) on delete set null,
  rekening_id    uuid references rekening(id) on delete set null,
  tagihan_id     uuid references tagihan(id) on delete set null,
  ppn            bigint not null default 0,
  pph_dipotong   bigint not null default 0,
  bukti_url      text,
  bukti_nama     text,
  sumber         text not null default 'manual',   -- manual | ai | impor
  dibuat_oleh    uuid references pengguna(id),
  dibuat_pada    timestamptz not null default now(),
  diubah_pada    timestamptz not null default now()
);
create index on transaksi (tanggal desc);
create index on transaksi (klien_id);
create index on transaksi (rekening_id);
create index on transaksi (kategori);
comment on column transaksi.kategori is
  'Kategori "Ads budget titipan" adalah KEWAJIBAN, bukan pendapatan. '
  'Wajib dikeluarkan dari perhitungan pendapatan di laba rugi.';

-- ---------------------------------------------------------------- ASET
create table aset (
  id                uuid primary key default gen_random_uuid(),
  kode              text unique,
  nama              text not null,
  kategori          text not null default 'Lain-lain',
  jenis             jenis_aset not null default 'tetap',
  kelompok          kelompok_fiskal not null default '1',
  tgl_perolehan     date not null,
  harga_perolehan   bigint not null check (harga_perolehan >= 0),
  nilai_residu      bigint not null default 0,
  metode            metode_susut not null default 'garis_lurus',
  qty               int not null default 1,
  lokasi            text,
  penanggung_jawab  text,
  kondisi           kondisi_aset not null default 'Baik',
  status            status_aset not null default 'Aktif',
  tgl_lepas         date,
  nilai_jual        bigint,
  catatan           text,
  transaksi_id      uuid references transaksi(id) on delete set null,
  dibuat_pada       timestamptz not null default now(),
  constraint residu_wajar check (nilai_residu <= harga_perolehan),
  constraint bangunan_garis_lurus check (
    kelompok not in ('bp','bnp') or metode = 'garis_lurus')
);
create index on aset (status) where status = 'Aktif';
comment on table aset is
  'Penyusutan TIDAK disimpan. Hitung dari kolom-kolom di sini saat dibutuhkan. '
  'Kelompok fiskal mengikuti Pasal 11 UU PPh jo. PMK 72/2023.';

-- Riwayat perpindahan, perbaikan, dan stock opname
create table mutasi_aset (
  id          uuid primary key default gen_random_uuid(),
  aset_id     uuid not null references aset(id) on delete cascade,
  tanggal     date not null default current_date,
  jenis       text not null,          -- pindah | perbaikan | opname | pelepasan
  dari        text,
  ke          text,
  catatan     text,
  dibuat_oleh uuid references pengguna(id),
  dibuat_pada timestamptz not null default now()
);
create index on mutasi_aset (aset_id);

-- --------------------------------------------------------------- PAJAK
create table pajak (
  id           uuid primary key default gen_random_uuid(),
  periode      text not null,                    -- "2026-08"
  jenis        jenis_pajak not null,
  dpp          bigint not null default 0,
  nominal      bigint not null default 0,
  tgl_setor    date,
  ntpn         text,
  tgl_lapor    date,
  bukti_url    text,
  catatan      text,
  dibuat_pada  timestamptz not null default now(),
  unique (periode, jenis)
);
create index on pajak (periode desc);

-- ------------------------------------------------------------- PAYROLL
create table karyawan (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,
  posisi       text,
  npwp         text,
  status_ptkp  text default 'TK/0',
  gaji_pokok   bigint not null default 0,
  tunjangan    bigint not null default 0,
  bpjs_kes     bigint not null default 0,
  bpjs_tk      bigint not null default 0,
  tgl_masuk    date,
  aktif        boolean not null default true,
  dibuat_pada  timestamptz not null default now()
);

create table payroll (
  id           uuid primary key default gen_random_uuid(),
  karyawan_id  uuid not null references karyawan(id) on delete cascade,
  periode      text not null,                    -- "2026-08"
  bruto        bigint not null default 0,
  potongan     bigint not null default 0,
  pph21        bigint not null default 0,
  netto        bigint not null default 0,
  tgl_bayar    date,
  transaksi_id uuid references transaksi(id) on delete set null,
  dibuat_pada  timestamptz not null default now(),
  unique (karyawan_id, periode)
);

-- ---------------------------------------------------------- TUTUP BUKU
create table tutup_buku (
  periode      text primary key,                 -- "2026-08"
  ditutup_pada timestamptz not null default now(),
  ditutup_oleh uuid references pengguna(id),
  catatan      text
);
comment on table tutup_buku is
  'Periode yang tercatat di sini terkunci. Transaksi di bulan itu tidak boleh '
  'diubah tanpa membuka kembali penutupan.';

-- ----------------------------------------------------------- CHAT & LOG
create table chat (
  id           uuid primary key default gen_random_uuid(),
  peran        text not null,                    -- me | ai | log | rec
  isi          text,
  data         jsonb,
  pengguna_id  uuid references pengguna(id),
  dibuat_pada  timestamptz not null default now()
);
create index on chat (dibuat_pada desc);

create table audit_log (
  id           bigserial primary key,
  pengguna_id  uuid references pengguna(id),
  tabel        text not null,
  record_id    uuid,
  aksi         text not null,                    -- insert | update | delete
  nilai_lama   jsonb,
  nilai_baru   jsonb,
  sumber       text default 'manual',            -- manual | ai
  waktu        timestamptz not null default now()
);
create index on audit_log (tabel, record_id);
create index on audit_log (waktu desc);

-- ========================================================= VIEW BANTUAN
create view v_saldo_rekening as
select r.id, r.nama, r.jenis, r.saldo_awal,
       r.saldo_awal + coalesce(sum(
         case when t.tipe = 'masuk' then t.nominal else -t.nominal end), 0) as saldo_kini
from rekening r
left join transaksi t on t.rekening_id = r.id
group by r.id;

create view v_piutang as
select t.id, t.klien_id, k.nama as klien, k.pic, k.wa,
       t.periode, t.nominal, t.dibayar,
       (t.nominal - t.dibayar) as sisa,
       t.jatuh_tempo,
       (current_date - t.jatuh_tempo) as hari_telat
from tagihan t
join klien k on k.id = t.klien_id
where t.nominal > t.dibayar;

create view v_utang as
select u.id, u.vendor_id, v.nama as vendor, v.jenis,
       u.keterangan, u.nominal, u.dibayar,
       (u.nominal - u.dibayar) as sisa,
       u.jatuh_tempo,
       (current_date - u.jatuh_tempo) as hari_telat
from utang_vendor u
join vendor v on v.id = u.vendor_id
where u.nominal > u.dibayar;

-- Dana titipan klien = kewajiban, bukan pendapatan
create view v_dana_titipan as
select
  coalesce((select sum(nominal) from transaksi
            where tipe = 'masuk' and kategori = 'Ads budget titipan'), 0)
  - coalesce((select sum(nominal) from transaksi
              where tipe = 'keluar' and kategori = 'Ads spend'
                and klien_id is not null), 0) as saldo_titipan;

-- ============================================================ KEAMANAN
alter table perusahaan   enable row level security;
alter table pengguna     enable row level security;
alter table rekening     enable row level security;
alter table klien        enable row level security;
alter table tagihan      enable row level security;
alter table vendor       enable row level security;
alter table utang_vendor enable row level security;
alter table transaksi    enable row level security;
alter table aset         enable row level security;
alter table mutasi_aset  enable row level security;
alter table pajak        enable row level security;
alter table karyawan     enable row level security;
alter table payroll      enable row level security;
alter table tutup_buku   enable row level security;
alter table chat         enable row level security;
alter table audit_log    enable row level security;

create or replace function peran_saya() returns peran_pengguna
language sql stable security definer as $$
  select peran from pengguna where id = auth.uid()
$$;

-- Semua pengguna aktif boleh membaca data operasional
do $$
declare t text;
begin
  foreach t in array array['perusahaan','rekening','klien','tagihan','vendor',
                           'utang_vendor','transaksi','aset','mutasi_aset',
                           'pajak','tutup_buku','chat']
  loop
    execute format($f$
      create policy "baca_%1$s" on %1$I for select
      using (exists (select 1 from pengguna where id = auth.uid() and aktif));
    $f$, t);
  end loop;
end $$;

-- Data gaji hanya untuk pemilik dan admin
create policy "baca_karyawan" on karyawan for select
  using (peran_saya() in ('pemilik','admin'));
create policy "baca_payroll" on payroll for select
  using (peran_saya() in ('pemilik','admin'));
create policy "kelola_karyawan" on karyawan for all
  using (peran_saya() in ('pemilik','admin'));
create policy "kelola_payroll" on payroll for all
  using (peran_saya() in ('pemilik','admin'));

-- Staf boleh membuat transaksi; hanya pemilik/admin yang boleh menghapus
create policy "tulis_transaksi" on transaksi for insert
  with check (exists (select 1 from pengguna where id = auth.uid() and aktif));
create policy "ubah_transaksi" on transaksi for update
  using (peran_saya() in ('pemilik','admin') or dibuat_oleh = auth.uid());
create policy "hapus_transaksi" on transaksi for delete
  using (peran_saya() in ('pemilik','admin'));

-- Master data hanya pemilik dan admin
do $$
declare t text;
begin
  foreach t in array array['perusahaan','rekening','klien','tagihan','vendor',
                           'utang_vendor','aset','mutasi_aset','pajak','tutup_buku']
  loop
    execute format($f$
      create policy "kelola_%1$s" on %1$I for all
      using (peran_saya() in ('pemilik','admin'));
    $f$, t);
  end loop;
end $$;

create policy "tulis_chat" on chat for insert
  with check (exists (select 1 from pengguna where id = auth.uid() and aktif));
create policy "baca_audit" on audit_log for select
  using (peran_saya() = 'pemilik');

-- =============================================== KUNCI PERIODE TERTUTUP
create or replace function cegah_ubah_periode_tertutup()
returns trigger language plpgsql as $$
declare p text;
begin
  p := to_char(coalesce(new.tanggal, old.tanggal), 'YYYY-MM');
  if exists (select 1 from tutup_buku where periode = p) then
    raise exception 'Periode % sudah ditutup. Buka dulu penutupannya sebelum mengubah data.', p;
  end if;
  return coalesce(new, old);
end $$;

create trigger jaga_periode_transaksi
  before insert or update or delete on transaksi
  for each row execute function cegah_ubah_periode_tertutup();

-- ====================================================== DATA AWAL MINIM
insert into perusahaan (nama, alamat) values
  ('PT Arah Ruang Langit', 'Bandung, Jawa Barat');

insert into rekening (nama, jenis, bank, urutan) values
  ('BCA Operasional',      'Bank', 'BCA',     1),
  ('Mandiri Budget Klien', 'Bank', 'Mandiri', 2),
  ('Kas Kantor',           'Kas',  null,      3);

comment on table rekening is
  'Rekening "Budget Klien" sengaja dipisah supaya dana titipan iklan tidak '
  'tercampur dengan kas operasional ARL.';
