-- =====================================================================
-- TAHAP 3 — Chat AI: terapkan perubahan secara atomik + batalkan
-- Jalankan SETELAH schema-tahap2.sql. Aman dijalankan berulang kali.
-- =====================================================================
--
-- Server tidak pernah menulis langsung hasil AI ke tabel satu per satu.
-- Setelah divalidasi, semua perubahan dikirim sebagai satu daftar operasi
-- ke terapkan_perubahan(). Fungsi ini berjalan dalam SATU transaksi:
-- kalau satu operasi gagal (izin, tutup buku, data tidak ada), semuanya
-- dibatalkan — tidak ada perubahan setengah jadi.
--
-- Operasi: {"op":"insert|update|delete","tabel":"transaksi","id":"<uuid>","data":{...}}

-- -------------------------------------------------------- RIWAYAT AI
create table if not exists ai_riwayat (
  id          uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null references pengguna(id) default auth.uid(),
  perintah    text,
  ops         jsonb not null,      -- yang dijalankan
  sesudah     jsonb not null,      -- isi baris setelah dijalankan (untuk cek bentrok saat batal)
  kebalikan   jsonb not null,      -- operasi untuk membatalkan, urutan terbalik
  dibatalkan  boolean not null default false,
  dibuat_pada timestamptz not null default now()
);
create index if not exists idx_ai_riwayat_pengguna on ai_riwayat (pengguna_id, dibuat_pada desc);
alter table ai_riwayat enable row level security;

drop policy if exists "baca_ai_riwayat" on ai_riwayat;
create policy "baca_ai_riwayat" on ai_riwayat for select
  using (pengguna_id = auth.uid() or peran_saya() in ('pemilik','admin'));
drop policy if exists "tulis_ai_riwayat" on ai_riwayat;
create policy "tulis_ai_riwayat" on ai_riwayat for insert
  with check (pengguna_id = auth.uid());

-- Riwayat chat: tiap orang boleh membersihkan chat-nya sendiri
drop policy if exists "hapus_chat_sendiri" on chat;
create policy "hapus_chat_sendiri" on chat for delete using (pengguna_id = auth.uid());

-- ------------------------------------------------- SATU OPERASI (internal)
-- Mengembalikan {"sesudah": <baris baru | null>, "kebalikan": <operasi pembalik>}.
-- Berjalan dengan hak pemanggil → aturan RLS & trigger (audit, tutup buku) tetap berlaku.
create or replace function _terapkan_op(o jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  t     text := o->>'tabel';
  aksi  text := o->>'op';
  rid   uuid := (o->>'id')::uuid;
  d     jsonb := coalesce(o->'data', '{}'::jsonb);
  kolom text;
  lama  jsonb;
  baru  jsonb;
begin
  if t not in ('transaksi','klien','tagihan','vendor','utang_vendor','aset','pajak','rekening') then
    raise exception 'Tabel % tidak boleh diubah lewat chat', t;
  end if;
  if rid is null then raise exception 'Operasi tanpa id'; end if;

  if aksi = 'insert' then
    d := d || jsonb_build_object('id', rid);
    select string_agg(quote_ident(k), ',') into kolom from jsonb_object_keys(d) k;
    execute format('insert into %1$I (%2$s) select %2$s from jsonb_populate_record(null::%1$I, $1) returning to_jsonb(%1$I.*)',
                   t, kolom) using d into baru;
    return jsonb_build_object('sesudah', baru,
             'kebalikan', jsonb_build_object('op','delete','tabel',t,'id',rid));
  end if;

  execute format('select to_jsonb(x) from %I x where id = $1', t) using rid into lama;
  if lama is null then raise exception 'Data % tidak ditemukan atau tidak boleh dilihat', t; end if;

  if aksi = 'update' then
    d := d - 'id';
    if d = '{}'::jsonb then
      return jsonb_build_object('sesudah', lama, 'kebalikan', null);
    end if;
    select string_agg(quote_ident(k), ',') into kolom from jsonb_object_keys(d) k;
    execute format('update %1$I set (%2$s) = (select %2$s from jsonb_populate_record(null::%1$I, $1)) where id = $2 returning to_jsonb(%1$I.*)',
                   t, kolom) using d, rid into baru;
    if baru is null then
      raise exception 'Akun ini tidak punya izin mengubah data % tersebut', t;
    end if;
    return jsonb_build_object('sesudah', baru,
             'kebalikan', jsonb_build_object('op','update','tabel',t,'id',rid,
               'data', (select jsonb_object_agg(k, lama->k) from jsonb_object_keys(d) k)));
  end if;

  if aksi = 'delete' then
    execute format('delete from %1$I where id = $1 returning to_jsonb(%1$I.*)', t) using rid into baru;
    if baru is null then
      raise exception 'Akun ini tidak punya izin menghapus data % tersebut', t;
    end if;
    return jsonb_build_object('sesudah', null,
             'kebalikan', jsonb_build_object('op','insert','tabel',t,'id',rid,'data', lama));
  end if;

  raise exception 'Operasi % tidak dikenal', aksi;
end $$;

-- ------------------------------------------------------ TERAPKAN (publik)
create or replace function terapkan_perubahan(p_perintah text, p_ops jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  o     jsonb;
  hasil jsonb;
  sesudah   jsonb := '[]'::jsonb;
  kebalikan jsonb := '[]'::jsonb;
  rid   uuid;
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'Tidak ada perubahan';
  end if;
  if jsonb_array_length(p_ops) > 50 then raise exception 'Terlalu banyak perubahan sekaligus'; end if;

  for o in select * from jsonb_array_elements(p_ops) loop
    hasil := _terapkan_op(o);
    sesudah := sesudah || jsonb_build_array(hasil->'sesudah');
    if hasil->'kebalikan' is not null and hasil->'kebalikan' <> 'null'::jsonb then
      kebalikan := jsonb_build_array(hasil->'kebalikan') || kebalikan;   -- urutan terbalik
    end if;
  end loop;

  insert into ai_riwayat (perintah, ops, sesudah, kebalikan)
  values (left(p_perintah, 2000), p_ops, sesudah, kebalikan)
  returning id into rid;
  return rid;
end $$;

-- ------------------------------------------------------ BATALKAN (publik)
-- Security definer: staf boleh membatalkan perubahan AI miliknya sendiri,
-- termasuk menghapus transaksi yang baru saja dibuat AI (biasanya staf
-- tidak boleh menghapus). Pembatasan:
--   * hanya riwayat milik pemanggil, belum dibatalkan, maksimal 24 jam
--   * ditolak kalau datanya sudah diubah orang/proses lain sejak itu
--   * tutup buku & audit log tetap berlaku (trigger tetap jalan)
create or replace function batalkan_perubahan(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r     ai_riwayat;
  o     jsonb;
  s     jsonb;
  kini  jsonb;
  i     int := 0;
  k     text;
begin
  select * into r from ai_riwayat where id = p_id for update;
  if r.id is null or r.pengguna_id is distinct from auth.uid() then
    raise exception 'Riwayat tidak ditemukan';
  end if;
  if r.dibatalkan then raise exception 'Perubahan ini sudah dibatalkan'; end if;
  if r.dibuat_pada < now() - interval '24 hours' then
    raise exception 'Sudah lebih dari 24 jam — ubah manual lewat halamannya';
  end if;

  -- Cek bentrok: kolom yang diubah AI harus masih sama dengan saat itu.
  for o in select * from jsonb_array_elements(r.ops) loop
    s := r.sesudah->i;
    execute format('select to_jsonb(x) from %I x where id = $1', o->>'tabel') using (o->>'id')::uuid into kini;
    if o->>'op' = 'delete' then
      if kini is not null then raise exception 'Data yang dihapus sudah dibuat ulang — batal tidak bisa dilakukan'; end if;
    else
      if kini is null then raise exception 'Data yang diubah AI sudah dihapus orang lain — batal tidak bisa dilakukan'; end if;
      for k in select jsonb_object_keys(coalesce(o->'data','{}'::jsonb)) loop
        if kini->k is distinct from s->k then
          raise exception 'Data sudah diubah lagi sejak itu (%) — batal tidak bisa dilakukan', o->>'tabel';
        end if;
      end loop;
    end if;
    i := i + 1;
  end loop;

  for o in select * from jsonb_array_elements(r.kebalikan) loop
    perform _terapkan_op(o);
  end loop;
  update ai_riwayat set dibatalkan = true where id = p_id;
end $$;

revoke all on function _terapkan_op(jsonb) from public, anon;
revoke all on function terapkan_perubahan(text, jsonb) from public, anon;
revoke all on function batalkan_perubahan(uuid) from public, anon;
grant execute on function _terapkan_op(jsonb) to authenticated;
grant execute on function terapkan_perubahan(text, jsonb) to authenticated;
grant execute on function batalkan_perubahan(uuid) to authenticated;
