-- =====================================================================
-- TAHAP 8 — MODUL DOKUMEN, BAGIAN 1: KATALOG LAYANAN + PENAWARAN/INVOICE
-- Jalankan sekali di Supabase SQL Editor (setelah schema-tahap7.sql).
-- Aman dijalankan ulang.
--
-- Prinsip (CLAUDE-dokumen.md):
--   * tabel klien dipakai bersama — tidak ada tabel klien baru
--   * baris_dokumen menyimpan SALINAN harga, bukan referensi ke katalog
--   * invoice yang diterbitkan membuat 1 baris `tagihan` → piutang,
--     pengingat, dan Google Calendar ikut jalan tanpa kode baru
--   * invoice Lunas membuat 1 baris `transaksi` (nilai yang DITRANSFER,
--     setelah PPh 23) — dikunci supaya tidak bisa tercatat dua kali
--   * menghapus hanya pemilik (sama dengan schema-tahap7.sql)
-- =====================================================================

-- ------------------------------------------- DATA TAMBAHAN KLIEN & PT
alter table klien add column if not exists alamat text;
alter table klien add column if not exists email  text;
-- true = klien berbentuk badan (PT/CV) yang memotong PPh 23 2%
alter table klien add column if not exists potong_pph23 boolean not null default false;

alter table perusahaan add column if not exists telp text;
alter table perusahaan add column if not exists email text;
alter table perusahaan add column if not exists bank text;
alter table perusahaan add column if not exists no_rekening text;
alter table perusahaan add column if not exists atas_nama text;
alter table perusahaan add column if not exists penanda_tangan text;
alter table perusahaan add column if not exists jabatan_ttd text;
alter table perusahaan add column if not exists folder_invoice_url text;

-- ------------------------------------------------------- KATALOG
create table if not exists kelompok_layanan (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  urutan      int not null default 0,
  aktif       boolean not null default true,
  dibuat_pada timestamptz not null default now()
);

create table if not exists layanan (
  id            uuid primary key default gen_random_uuid(),
  kelompok_id   uuid not null references kelompok_layanan(id) on delete cascade,
  nama          text not null,
  deskripsi     text,
  satuan        text not null default 'bulan',
  harga         bigint not null default 0 check (harga >= 0),
  porsi_hemat   int not null default 0 check (porsi_hemat   >= 0),
  porsi_standar int not null default 1 check (porsi_standar >= 0),
  porsi_premium int not null default 1 check (porsi_premium >= 0),
  berulang      boolean not null default true,   -- dikalikan durasi kontrak
  urutan        int not null default 0,
  aktif         boolean not null default true,
  dibuat_pada   timestamptz not null default now()
);
create index if not exists layanan_kelompok_idx on layanan (kelompok_id);

-- ------------------------------------------------------- DOKUMEN
create table if not exists dokumen (
  id            uuid primary key default gen_random_uuid(),
  jenis         text not null check (jenis in ('penawaran','invoice')),
  kode          text not null,                 -- INV | PNW
  urut          int,                           -- diisi saat terbit
  tahun         int,
  nomor         text unique,                   -- "Nama Toko/001/INV-ARL/X/2026"
  klien_id      uuid references klien(id) on delete set null,
  tanggal       date not null default current_date,
  tempo_hari    int not null default 7 check (tempo_hari between 0 and 90),
  durasi_bulan  int not null default 1 check (durasi_bulan between 1 and 36),
  porsi         text,                          -- hemat | standar | premium | kustom
  diskon        bigint not null default 0 check (diskon >= 0),
  diskon_tipe   text not null default 'rp' check (diskon_tipe in ('rp','pct')),
  ppn_aktif     boolean not null default false,
  pph23         boolean not null default false,
  -- angka hasil hitungan, disimpan saat simpan/terbit (rupiah bulat)
  subtotal      bigint not null default 0,
  dpp           bigint not null default 0,
  ppn           bigint not null default 0,
  total         bigint not null default 0,
  pph23_nilai   bigint not null default 0,
  diterima      bigint not null default 0,
  status        text not null default 'Draf' check (status in ('Draf','Terkirim','Lunas','Batal')),
  catatan       text,
  tagihan_id    uuid references tagihan(id) on delete set null,
  transaksi_id  uuid references transaksi(id) on delete set null,
  dibuat_oleh   uuid references pengguna(id) default auth.uid(),
  dibuat_pada   timestamptz not null default now(),
  diubah_pada   timestamptz not null default now(),
  unique (kode, tahun, urut)
);
create index if not exists dokumen_klien_idx on dokumen (klien_id);
create index if not exists dokumen_status_idx on dokumen (jenis, status);

create table if not exists baris_dokumen (
  id            uuid primary key default gen_random_uuid(),
  dokumen_id    uuid not null references dokumen(id) on delete cascade,
  layanan_id    uuid references layanan(id) on delete set null,  -- null = baris bebas
  kelompok      text,
  nama          text not null,
  deskripsi     text,
  satuan        text not null default 'bulan',
  qty           int not null default 1 check (qty >= 0),
  harga         bigint not null default 0 check (harga >= 0),
  diskon_persen numeric(5,2) not null default 0 check (diskon_persen between 0 and 100),
  berulang      boolean not null default true,
  urutan        int not null default 0
);
create index if not exists baris_dokumen_idx on baris_dokumen (dokumen_id);

-- ------------------------------------------------------- KEAMANAN
alter table kelompok_layanan enable row level security;
alter table layanan          enable row level security;
alter table dokumen          enable row level security;
alter table baris_dokumen    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kelompok_layanan','layanan','dokumen','baris_dokumen'] loop
    execute format('drop policy if exists "baca_%1$s" on %1$I', t);
    execute format($f$create policy "baca_%1$s" on %1$I for select
      using (exists (select 1 from pengguna where id = auth.uid() and aktif))$f$, t);
    execute format('drop policy if exists "kelola_%1$s" on %1$I', t);
    execute format($f$create policy "kelola_%1$s" on %1$I for all
      using (peran_saya() in ('pemilik','admin')) with check (peran_saya() in ('pemilik','admin'))$f$, t);
    execute format('drop policy if exists "hapus_hanya_pemilik" on %I', t);
    execute format($f$create policy "hapus_hanya_pemilik" on %I as restrictive for delete
      using (peran_saya() = 'pemilik')$f$, t);
  end loop;
end $$;
-- Baris draf boleh diganti saat draf disimpan ulang (itu menyunting, bukan menghapus data).
drop policy if exists "hapus_hanya_pemilik" on baris_dokumen;
create policy "hapus_hanya_pemilik" on baris_dokumen as restrictive for delete
  using (peran_saya() = 'pemilik'
         or exists (select 1 from dokumen d where d.id = dokumen_id and d.status = 'Draf'));

-- Staf boleh menyusun & mengubah PENAWARAN draf miliknya; invoice tidak.
drop policy if exists "staf_susun_penawaran" on dokumen;
create policy "staf_susun_penawaran" on dokumen for all
  using (jenis = 'penawaran' and status = 'Draf' and dibuat_oleh = auth.uid())
  with check (jenis = 'penawaran' and status = 'Draf' and dibuat_oleh = auth.uid());
drop policy if exists "staf_baris_penawaran" on baris_dokumen;
create policy "staf_baris_penawaran" on baris_dokumen for all
  using (exists (select 1 from dokumen d where d.id = dokumen_id and d.jenis = 'penawaran'
                 and d.status = 'Draf' and d.dibuat_oleh = auth.uid()))
  with check (exists (select 1 from dokumen d where d.id = dokumen_id and d.jenis = 'penawaran'
                 and d.status = 'Draf' and d.dibuat_oleh = auth.uid()));

-- ------------------------------------------------------- JEJAK
drop trigger if exists audit on kelompok_layanan;
create trigger audit after insert or update or delete on kelompok_layanan for each row execute function catat_audit();
drop trigger if exists audit on layanan;
create trigger audit after insert or update or delete on layanan for each row execute function catat_audit();
drop trigger if exists audit on dokumen;
create trigger audit after insert or update or delete on dokumen for each row execute function catat_audit();
drop trigger if exists audit on baris_dokumen;
create trigger audit after insert or update or delete on baris_dokumen for each row execute function catat_audit();

-- ------------------------------------------------------- TERBITKAN
-- Memberi nomor (satu deret per kode per tahun) dan, untuk invoice,
-- membuat baris tagihan. Berjalan dengan hak pemanggil (RLS tetap berlaku).
create or replace function terbitkan_dokumen(p_id uuid)
returns text language plpgsql set search_path = public as $$
declare
  d   dokumen;
  k   klien;
  th  int;
  u   int;
  rom text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  no  text;
  tg  uuid;
begin
  select * into d from dokumen where id = p_id for update;
  if d.id is null then raise exception 'Dokumen tidak ditemukan'; end if;
  if d.status <> 'Draf' then raise exception 'Dokumen sudah diterbitkan'; end if;
  if d.klien_id is null then raise exception 'Pilih klien dulu'; end if;
  if d.total <= 0 then raise exception 'Nilai dokumen masih nol'; end if;
  select * into k from klien where id = d.klien_id;

  th := extract(year from d.tanggal);
  perform pg_advisory_xact_lock(hashtext('nomor_dokumen'), hashtext(d.kode || th));
  select coalesce(max(urut), 0) + 1 into u from dokumen where kode = d.kode and tahun = th;
  no := k.nama || '/' || lpad(u::text, 3, '0') || '/' || d.kode || '-ARL/'
        || rom[extract(month from d.tanggal)::int] || '/' || th;

  if d.jenis = 'invoice' then
    insert into tagihan (klien_id, nomor_invoice, periode, nominal, ppn, pph23_dipotong,
                         dibayar, tgl_invoice, jatuh_tempo, catatan)
    values (d.klien_id, no,
            trim(to_char(d.tanggal, 'TMMonth YYYY')),
            d.total, 0, 0, 0, d.tanggal, d.tanggal + d.tempo_hari,
            'Dari invoice ' || no
              || case when d.ppn > 0 then ' · termasuk PPN Rp' || d.ppn else '' end
              || case when d.pph23_nilai > 0 then ' · PPh 23 Rp' || d.pph23_nilai || ' dipotong klien' else '' end)
    returning id into tg;
  end if;

  update dokumen set urut = u, tahun = th, nomor = no, status = 'Terkirim',
                     tagihan_id = tg, diubah_pada = now()
  where id = p_id;
  return no;
end $$;

-- ------------------------------------------------------- LUNAS
-- Satu kali saja: membuat transaksi masuk senilai yang DITRANSFER,
-- mencatat PPh 23 sebagai kredit pajak di tagihan, menandai invoice Lunas.
create or replace function lunasi_invoice(p_id uuid, p_tanggal date, p_rekening uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  d   dokumen;
  ber boolean;
  tx  uuid;
begin
  select * into d from dokumen where id = p_id for update;
  if d.id is null or d.jenis <> 'invoice' then raise exception 'Invoice tidak ditemukan'; end if;
  if d.status = 'Lunas' or d.transaksi_id is not null then raise exception 'Invoice ini sudah lunas'; end if;
  if d.status <> 'Terkirim' then raise exception 'Terbitkan invoice dulu sebelum ditandai lunas'; end if;

  select bool_or(berulang) into ber from baris_dokumen where dokumen_id = p_id and qty > 0;

  insert into transaksi (tanggal, tipe, nominal, kategori, keterangan, metode,
                         klien_id, rekening_id, tagihan_id, ppn, pph_dipotong, sumber, dibuat_oleh)
  values (p_tanggal, 'masuk', d.diterima,
          case when coalesce(ber, false) then 'Retainer klien' else 'Project fee' end,
          'Pelunasan ' || d.nomor, 'Transfer bank',
          d.klien_id, p_rekening, d.tagihan_id, d.ppn, d.pph23_nilai, 'manual', auth.uid())
  returning id into tx;

  if d.tagihan_id is not null then
    update tagihan set dibayar = d.diterima, pph23_dipotong = d.pph23_nilai where id = d.tagihan_id;
  end if;

  update dokumen set status = 'Lunas', transaksi_id = tx, diubah_pada = now() where id = p_id;
  return tx;
end $$;

revoke all on function terbitkan_dokumen(uuid) from public, anon;
revoke all on function lunasi_invoice(uuid, date, uuid) from public, anon;
grant execute on function terbitkan_dokumen(uuid) to authenticated;
grant execute on function lunasi_invoice(uuid, date, uuid) to authenticated;

-- ------------------------------------------------------- PENYIMPANAN
-- (Tidak ada bucket baru: invoice dicetak/disimpan sebagai PDF dari browser
-- lalu diunggah ke folder Google Drive invoice.)
