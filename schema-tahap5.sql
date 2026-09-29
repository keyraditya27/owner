-- =====================================================================
-- TAHAP 5 — hak akses, tutup buku, persetujuan pengeluaran, backup
-- Jalankan SETELAH schema-tahap3.sql. Aman dijalankan berulang kali.
-- =====================================================================

create or replace function pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(peran_saya() in ('pemilik','admin'), false)
$$;
create or replace function aktif_saya() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pengguna where id = auth.uid() and aktif)
$$;

-- ------------------------------------------------ STAF TIDAK MELIHAT GAJI
-- CLAUDE.md: staf tidak bisa melihat gaji. Tabel karyawan & payroll sudah
-- khusus pemilik/admin; transaksi berkategori "Gaji & fee tim" juga.
drop policy if exists "baca_transaksi" on transaksi;
create policy "baca_transaksi" on transaksi for select
  using (aktif_saya() and (kategori <> 'Gaji & fee tim' or pengelola()));

drop policy if exists "tulis_transaksi" on transaksi;
create policy "tulis_transaksi" on transaksi for insert
  with check (aktif_saya() and (pengelola() or (dibuat_oleh = auth.uid() and kategori <> 'Gaji & fee tim')));

drop policy if exists "ubah_transaksi" on transaksi;
create policy "ubah_transaksi" on transaksi for update
  using (pengelola() or dibuat_oleh = auth.uid())
  with check (pengelola() or (dibuat_oleh = auth.uid() and kategori <> 'Gaji & fee tim'));

-- --------------------------------- ADMIN TIDAK BOLEH MENGHAPUS PERUSAHAAN
drop policy if exists "kelola_perusahaan" on perusahaan;
drop policy if exists "tambah_perusahaan" on perusahaan;
drop policy if exists "ubah_perusahaan" on perusahaan;
drop policy if exists "hapus_perusahaan" on perusahaan;
create policy "tambah_perusahaan" on perusahaan for insert with check (pengelola());
create policy "ubah_perusahaan" on perusahaan for update using (pengelola()) with check (pengelola());
create policy "hapus_perusahaan" on perusahaan for delete using (peran_saya() = 'pemilik');

-- ------------------------------ TUTUP BUKU: MEMBUKA KEMBALI HANYA PEMILIK
drop policy if exists "kelola_tutup_buku" on tutup_buku;
drop policy if exists "tutup_periode" on tutup_buku;
drop policy if exists "buka_periode" on tutup_buku;
create policy "tutup_periode" on tutup_buku for insert
  with check (pengelola() and ditutup_oleh = auth.uid() and periode ~ '^\d{4}-(0[1-9]|1[0-2])$');
create policy "buka_periode" on tutup_buku for delete using (peran_saya() = 'pemilik');

-- ------------------------------------------- PERSETUJUAN PENGELUARAN STAF
-- Pengeluaran staf di atas Rp5 juta tidak langsung jadi transaksi. Masuk
-- tabel pengajuan dulu; baru tercatat di pembukuan setelah pemilik setuju.
create table if not exists pengajuan (
  id            uuid primary key default gen_random_uuid(),
  tanggal       date not null,
  nominal       bigint not null check (nominal > 0),
  kategori      text not null,
  keterangan    text not null,
  metode        text not null default 'Transfer bank',
  rekening_id   uuid references rekening(id) on delete set null,
  klien_id      uuid references klien(id) on delete set null,
  bukti_url     text,
  bukti_nama    text,
  diajukan_oleh uuid not null references pengguna(id) default auth.uid(),
  status        text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak')),
  diputus_oleh  uuid references pengguna(id),
  diputus_pada  timestamptz,
  alasan        text,
  transaksi_id  uuid references transaksi(id) on delete set null,
  dibuat_pada   timestamptz not null default now()
);
create index if not exists idx_pengajuan_status on pengajuan (status, dibuat_pada desc);
alter table pengajuan enable row level security;

drop policy if exists "baca_pengajuan" on pengajuan;
create policy "baca_pengajuan" on pengajuan for select
  using (diajukan_oleh = auth.uid() or pengelola());
drop policy if exists "ajukan" on pengajuan;
create policy "ajukan" on pengajuan for insert
  with check (aktif_saya() and diajukan_oleh = auth.uid() and status = 'menunggu'
              and kategori <> 'Gaji & fee tim');
drop policy if exists "hapus_pengajuan_sendiri" on pengajuan;
create policy "hapus_pengajuan_sendiri" on pengajuan for delete
  using (diajukan_oleh = auth.uid() and status = 'menunggu');

drop trigger if exists audit on pengajuan;
create trigger audit after insert or update or delete on pengajuan
  for each row execute function catat_audit();

-- Batas dijaga di database: staf tidak bisa mencatat pengeluaran > Rp5 juta
-- langsung, lewat jalur apa pun (form, chat AI, API).
create or replace function cegah_pengeluaran_besar_staf()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipe = 'keluar' and new.nominal > 5000000 and coalesce(peran_saya()::text, '') = 'staf' then
    raise exception 'Pengeluaran di atas Rp5.000.000 dari staf harus lewat persetujuan pemilik.';
  end if;
  return new;
end $$;
drop trigger if exists batas_pengeluaran_staf on transaksi;
create trigger batas_pengeluaran_staf before insert or update on transaksi
  for each row execute function cegah_pengeluaran_besar_staf();

-- Setujui: hanya pemilik. Transaksi dicatat atas nama pengaju.
create or replace function setujui_pengajuan(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a   pengajuan;
  tid uuid := gen_random_uuid();
begin
  if coalesce(peran_saya()::text, '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang boleh menyetujui pengeluaran';
  end if;
  select * into a from pengajuan where id = p_id for update;
  if a.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if a.status <> 'menunggu' then raise exception 'Pengajuan ini sudah diputuskan'; end if;

  insert into transaksi (id, tanggal, tipe, nominal, kategori, keterangan, metode,
                         rekening_id, klien_id, bukti_url, bukti_nama, sumber, dibuat_oleh)
  values (tid, a.tanggal, 'keluar', a.nominal, a.kategori, a.keterangan, a.metode,
          a.rekening_id, a.klien_id, a.bukti_url, a.bukti_nama, 'persetujuan', a.diajukan_oleh);

  update pengajuan set status = 'disetujui', diputus_oleh = auth.uid(), diputus_pada = now(),
                       transaksi_id = tid where id = p_id;
  return tid;
end $$;

create or replace function tolak_pengajuan(p_id uuid, p_alasan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(peran_saya()::text, '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang boleh menolak pengeluaran';
  end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
  update pengajuan set status = 'ditolak', diputus_oleh = auth.uid(), diputus_pada = now(),
                       alasan = left(p_alasan, 500)
   where id = p_id and status = 'menunggu';
  if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diputuskan'; end if;
end $$;

revoke all on function setujui_pengajuan(uuid) from public, anon;
revoke all on function tolak_pengajuan(uuid, text) from public, anon;
grant execute on function setujui_pengajuan(uuid) to authenticated;
grant execute on function tolak_pengajuan(uuid, text) to authenticated;

-- ------------------------------------------------------------ BACKUP
-- Bucket privat untuk ekspor JSON mingguan. Hanya server (service role) yang menulis & membaca.
insert into storage.buckets (id, name, public)
values ('backup', 'backup', false)
on conflict (id) do update set public = false;
