import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { klienAdmin } from '@/lib/supabase/admin';
import {
  bacaTab,
  daftarTab,
  hurufKolom,
  konfigSheet,
  rentang,
  tulisNilai,
  ubahStruktur,
  type KonfigSheet,
  type Sel,
} from './google';
import { GalatSel, ISI_RINGKASAN, JUDUL_RINGKASAN, PREFIKS_TOLAK, TAB, catatanAsli, kolomData, type Konteks, type Rec, type Tab } from './skema';

/**
 * Mesin sinkron dua arah aplikasi ⇄ Google Sheets. Satu fungsi untuk delapan tab.
 *
 * Tiap putaran: baca SEMUA tab dalam satu batchGet, bandingkan per baris dengan
 * database, lalu tulis balik dalam satu spreadsheets.batchUpdate (warna/baris)
 * dan satu values.batchUpdate (isi). Total 2–4 panggilan API per putaran.
 *
 * Sisi mana yang berubah ditentukan dengan sidik (hash) baris yang disimpan di
 * kolom sheet_hash saat terakhir kali kedua sisi sama:
 *   sidik sheet ≠ dasar, sidik app = dasar → sheet berubah → perbarui database
 *   sidik app ≠ dasar, sidik sheet = dasar → aplikasi berubah → tulis ke sheet
 *   keduanya berubah (dan berbeda)         → bentrok: Diubah terbaru menang, yang kalah dicatat
 *
 * Yang TIDAK pernah dilakukan: menghapus data karena barisnya hilang dari sheet,
 * membuat klien/rekening baru dari nama yang salah ketik, menulis data gaji ke sheet.
 */

export type HasilSinkron = {
  jalan: boolean;
  alasan?: string;
  masukDb: number;
  keSheet: number;
  ditolak: number;
  konflik: number;
  hilang: number;
  durasiMs: number;
};

/** Urutan proses: master dulu, supaya nama klien/vendor/rekening yang diganti di sheet sudah dikenal tab lain. */
const URUTAN_PROSES = ['Rekening', 'Klien', 'Vendor', 'Transaksi', 'Tagihan', 'Utang', 'Aset', 'Pajak'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MERAH = { red: 0.99, green: 0.89, blue: 0.89 };
const PUTIH = { red: 1, green: 1, blue: 1 };
const NAVY = { red: 10 / 255, green: 37 / 255, blue: 64 / 255 };

const sidik = (t: Tab, r: Rec, k: Konteks) =>
  createHash('sha256')
    .update(JSON.stringify(kolomData(t).filter((c) => c.sidik !== false).map((c) => String(c.ke(r, k) ?? ''))))
    .digest('hex')
    .slice(0, 32);

const selTeks = (s: Sel | undefined) => (s === null || s === undefined ? '' : String(s));

/** Semua baris satu tabel (PostgREST membatasi 1000 per permintaan). */
async function ambilSemua(db: SupabaseClient, tabel: string): Promise<Rec[]> {
  const hasil: Rec[] = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await db.from(tabel).select('*').order('id').range(dari, dari + 999);
    if (error) throw new Error(`Gagal membaca ${tabel}: ${error.message}`);
    hasil.push(...(data ?? []));
    if (!data || data.length < 1000) return hasil;
  }
}

/** Objek {judul kolom: isi} — untuk sinkron_konflik & sinkron_hilang supaya mudah dibaca manusia. */
const keObjek = (t: Tab, sel: (i: number) => Sel) => Object.fromEntries(t.kolom.map((c, i) => [c.judul, sel(i)]));

type RencanaTab = {
  tab: Tab;
  sheetId: number;
  /** judul kolom → indeks kolom di sheet */
  posisi: Map<string, number>;
  lebar: number;
  tulis: { baris: number; sel: Sel[] }[];
  warna: { baris: number; merah: boolean }[];
  /** sidik yang dicatat ke database SETELAH tulisan ke sheet berhasil */
  sidikNanti: { id: string; hash: string }[];
  barisBaru: number;
  jumlahBaris: number;
};

export async function sinkron(pemicu: string): Promise<HasilSinkron> {
  const mulai = Date.now();
  const hasil: HasilSinkron = { jalan: false, masukDb: 0, keSheet: 0, ditolak: 0, konflik: 0, hilang: 0, durasiMs: 0 };
  const k = konfigSheet();
  if (!k) return { ...hasil, alasan: 'Google Sheets belum disetel (GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).' };

  const db = klienAdmin();
  const { data: dapat, error: eKlaim } = await db.rpc('klaim_sinkron', { p_detik: 120 });
  if (eKlaim) return { ...hasil, alasan: 'Gagal mengunci sinkron: ' + eKlaim.message };
  if (!dapat) return { ...hasil, alasan: 'Sinkron lain sedang berjalan.' };

  try {
    hasil.jalan = true;
    await putaran(k, db, hasil);
    hasil.durasiMs = Date.now() - mulai;
    const pesan = `${pemicu}: ${hasil.masukDb} masuk, ${hasil.keSheet} ditulis, ${hasil.ditolak} ditolak, ${hasil.konflik} bentrok, ${hasil.hilang} hilang`;
    await db.from('sinkron_status').update({ terakhir: new Date().toISOString(), sukses: true, pesan }).in('arah', ['ke_sheet', 'dari_sheet']);
    if (hasil.masukDb || hasil.keSheet || hasil.ditolak || hasil.konflik || hasil.hilang) {
      await db.from('sinkron_log').insert([
        { arah: 'dari_sheet', baris_diproses: hasil.masukDb, baris_ditolak: hasil.ditolak, durasi_ms: hasil.durasiMs, pesan },
        { arah: 'ke_sheet', baris_diproses: hasil.keSheet, baris_ditolak: 0, durasi_ms: hasil.durasiMs, pesan },
      ]);
    }
    return hasil;
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    hasil.durasiMs = Date.now() - mulai;
    await db.from('sinkron_status').update({ sukses: false, pesan: `${pemicu}: ${pesan}` }).in('arah', ['ke_sheet', 'dari_sheet']);
    await db.from('sinkron_log').insert({ arah: 'dari_sheet', durasi_ms: hasil.durasiMs, pesan: `GAGAL (${pemicu}): ${pesan}` });
    throw e;
  } finally {
    await db.rpc('lepas_sinkron');
  }
}

async function putaran(k: KonfigSheet, db: SupabaseClient, hasil: HasilSinkron) {
  // Cap waktu putaran ini, dibulatkan ke detik (sama persis dengan yang tampil di kolom Diubah)
  const T = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();

  const { data: antre } = await db.from('sinkron_antrean').select('id').eq('diproses', false).order('id', { ascending: false }).limit(1);
  const antreanSampai = antre?.[0]?.id as number | undefined;

  /* ---------- 1. pastikan semua tab ada ---------- */
  let tabs = await daftarTab(k);
  const kurang = [...TAB.map((t) => ({ judul: t.judul, lebar: t.kolom.length })), { judul: JUDUL_RINGKASAN, lebar: 4 }].filter(
    (t) => !tabs.some((x) => x.title === t.judul),
  );
  if (kurang.length) {
    await ubahStruktur(
      k,
      kurang.map((t) => ({
        addSheet: { properties: { title: t.judul, gridProperties: { rowCount: 1000, columnCount: t.lebar, frozenRowCount: t.judul === JUDUL_RINGKASAN ? 0 : 1 } } },
      })),
    );
    tabs = await daftarTab(k);
    if (kurang.some((t) => t.judul === JUDUL_RINGKASAN)) {
      await tulisNilai(k, [{ range: rentang(JUDUL_RINGKASAN, 'A1'), values: ISI_RINGKASAN }], 'USER_ENTERED');
    }
  }
  const info = new Map(tabs.map((t) => [t.title, t]));

  /* ---------- 2. baca sheet (1 panggilan) & database ---------- */
  const mentah = await bacaTab(k, TAB.map((t) => t.judul));
  const isiSheet = new Map(TAB.map((t, i) => [t.judul, mentah[i]]));

  const semua = new Map<string, Rec[]>();
  for (const t of TAB) semua.set(t.tabel, await ambilSemua(db, t.tabel));
  const { data: tutup } = await db.from('tutup_buku').select('periode');
  const ctx: Konteks = {
    klien: semua.get('klien')!.map((r) => ({ id: r.id as string, nama: String(r.nama) })),
    vendor: semua.get('vendor')!.map((r) => ({ id: r.id as string, nama: String(r.nama) })),
    rekening: semua.get('rekening')!.map((r) => ({ id: r.id as string, nama: String(r.nama) })),
    tertutup: new Set((tutup ?? []).map((r) => r.periode as string)),
    urlAplikasi: (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, ''),
  };

  /* ---------- 3. bandingkan per tab ---------- */
  const rencana: RencanaTab[] = [];
  const struktur: object[] = [];
  for (const judul of URUTAN_PROSES) {
    const tab = TAB.find((t) => t.judul === judul)!;
    const it = info.get(judul)!;
    const r = await bandingkan(db, tab, it.sheetId, isiSheet.get(judul) ?? [], semua.get(tab.tabel)!, ctx, T, hasil);
    rencana.push(r);
    // tambah baris/kolom kalau grid kurang (menulis di luar grid ditolak API)
    const perluBaris = r.jumlahBaris + r.barisBaru + 1 - it.rowCount;
    if (perluBaris > 0) struktur.push({ appendDimension: { sheetId: it.sheetId, dimension: 'ROWS', length: perluBaris + 200 } });
    if (r.lebar > it.columnCount) struktur.push({ appendDimension: { sheetId: it.sheetId, dimension: 'COLUMNS', length: r.lebar - it.columnCount } });
  }

  /* ---------- 4. tulis ke sheet: 1 batchUpdate struktur + 1 batchUpdate nilai ---------- */
  const data: { range: string; values: Sel[][] }[] = [];
  for (const r of rencana) {
    const akhir = hurufKolom(r.lebar - 1);
    for (const w of r.tulis) data.push({ range: rentang(r.tab.judul, `A${w.baris}:${akhir}${w.baris}`), values: [w.sel] });
    for (const w of r.warna) {
      struktur.push({
        repeatCell: {
          range: { sheetId: r.sheetId, startRowIndex: w.baris - 1, endRowIndex: w.baris, startColumnIndex: 0, endColumnIndex: r.lebar },
          cell: { userEnteredFormat: { backgroundColor: w.merah ? MERAH : PUTIH } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
    if (r.tulis.some((w) => w.baris === 1)) {
      struktur.push({
        repeatCell: {
          range: { sheetId: r.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: r.lebar },
          cell: { userEnteredFormat: { backgroundColor: NAVY, textFormat: { bold: true, foregroundColor: PUTIH } } },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    }
  }
  await ubahStruktur(k, struktur);
  await tulisNilai(k, data);

  /* ---------- 5. baru sekarang catat sidik baris yang ditulis ke sheet ---------- */
  // Urutan ini penting: kalau penulisan ke sheet gagal, sidik lama tetap berlaku
  // dan putaran berikutnya mengulang — tidak ada yang dianggap "sudah sinkron" padahal belum.
  for (const r of rencana) {
    for (const s of r.sidikNanti) {
      await db.from(r.tab.tabel).update({ sheet_hash: s.hash, sheet_diubah: T }).eq('id', s.id);
    }
  }
  if (antreanSampai) await db.from('sinkron_antrean').update({ diproses: true }).eq('diproses', false).lte('id', antreanSampai);
}

/** Bandingkan satu tab. Perubahan database dari sheet langsung dijalankan di sini; tulisan ke sheet dikumpulkan. */
async function bandingkan(
  db: SupabaseClient,
  tab: Tab,
  sheetId: number,
  baris: Sel[][],
  dbSemua: Rec[],
  ctx: Konteks,
  T: string,
  hasil: HasilSinkron,
): Promise<RencanaTab> {
  const r: RencanaTab = { tab, sheetId, posisi: new Map(), lebar: 0, tulis: [], warna: [], sidikNanti: [], barisBaru: 0, jumlahBaris: Math.max(baris.length, 1) };

  /* --- judul kolom: dicocokkan menurut nama, jadi urutan kolom boleh digeser --- */
  const kepala = (baris[0] ?? []).map((s) => selTeks(s).trim());
  kepala.forEach((j, i) => j && !r.posisi.has(j) && r.posisi.set(j, i));
  // kolom yang belum ada (tab baru, atau kolom terhapus) ditambahkan di kanan
  const kurang = tab.kolom.filter((c) => !r.posisi.has(c.judul));
  let ujung = kepala.some(Boolean) ? kepala.length : 0;
  for (const c of kurang) r.posisi.set(c.judul, ujung++);
  r.lebar = Math.max(kepala.length, ...[...r.posisi.values()].map((v) => v + 1));
  if (kurang.length) r.tulis.push({ baris: 1, sel: susun(r, (c) => c.judul) });

  const idx = (judul: string) => r.posisi.get(judul)!;
  const sel = (row: Sel[], judul: string): Sel => row[idx(judul)] ?? null;
  const dbMap = new Map(dbSemua.map((x) => [x.id as string, x]));
  const terlihat = new Set<string>();
  const kolD = kolomData(tab);

  /** Isi sheet sesuai data database (nilai kanonik). */
  const render = (rec: Rec) => susun(r, (c) => c.ke(rec, ctx));
  const beda = (row: Sel[], target: Sel[]) => target.some((v, i) => v !== null && selTeks(v) !== selTeks(row[i]).trim() && !(typeof v === 'number' && Number(row[i]) === v));
  const merahSebelumnya = (row: Sel[]) => selTeks(sel(row, 'Catatan')).startsWith(PREFIKS_TOLAK.trim());

  const tulisBaris = (no: number, row: Sel[], rec: Rec) => {
    const target = render(rec);
    if (beda(row, target)) r.tulis.push({ baris: no, sel: target });
    if (merahSebelumnya(row)) r.warna.push({ baris: no, merah: false });
  };
  const tolak = (no: number, row: Sel[], alasan: string) => {
    hasil.ditolak++;
    const asli = catatanAsli(sel(row, 'Catatan'));
    const isi = PREFIKS_TOLAK + alasan + (asli ? ' | ' + asli : '');
    if (selTeks(sel(row, 'Catatan')) !== isi) {
      r.tulis.push({ baris: no, sel: susun(r, (c) => (c.judul === 'Catatan' ? isi : null)) });
      r.warna.push({ baris: no, merah: true });
    }
  };

  /** Baca baris sheet jadi nilai database. Galat pertama dikembalikan sebagai alasan. */
  const baca = (row: Sel[]): { nilai: Rec } | { galat: string } => {
    const nilai: Rec = {};
    try {
      for (const c of kolD) nilai[c.field!] = c.dari!(sel(row, c.judul), ctx);
    } catch (e) {
      if (e instanceof GalatSel) return { galat: e.message };
      throw e;
    }
    return { nilai };
  };

  /* Baris lama yang tidak terlihat & dulu dibuat dari sheet — untuk memulihkan baris baru yang
     sudah masuk database tapi ID-nya gagal ditulis balik ke sheet (mencegah dobel). */
  const idDiSheet = new Set(baris.slice(1).map((row) => selTeks(row[idx('ID')]).trim()).filter(Boolean));
  const yatim = new Map<string, Rec>();
  for (const x of dbSemua) if (x.sheet_sumber === 'sheet' && !idDiSheet.has(x.id as string)) yatim.set(sidik(tab, x, ctx), x);

  // ID di sheet yang tidak ada di database: dihapus di aplikasi, atau benar-benar baru?
  const idAsing = [...idDiSheet].filter((id) => UUID.test(id) && !dbMap.has(id));
  const dihapusApp = new Set<string>();
  if (idAsing.length) {
    const { data } = await db.from('sinkron_antrean').select('record_id').eq('tabel', tab.tabel).eq('aksi', 'arsip').in('record_id', idAsing);
    (data ?? []).forEach((d) => dihapusApp.add(d.record_id as string));
  }

  const simpan = async (no: number, row: Sel[], aksi: 'insert' | 'update', id: string | null, nilai: Rec): Promise<Rec | null> => {
    const isi = { ...nilai, sheet_sumber: 'sheet', sheet_diubah: T };
    const hashBaru = sidik(tab, { ...(id ? dbMap.get(id) : {}), ...isi }, ctx);
    const q =
      aksi === 'insert'
        ? db.from(tab.tabel).insert({ ...(tab.bawaanBaru ?? {}), ...isi, ...(id ? { id } : {}), sheet_hash: hashBaru }).select().single()
        : db.from(tab.tabel).update({ ...isi, sheet_hash: hashBaru }).eq('id', id!).select().single();
    const { data, error } = await q;
    if (error || !data) {
      tolak(no, row, error?.message ?? 'Gagal disimpan');
      return null;
    }
    hasil.masukDb++;
    // database bisa menormalkan nilai (default, trigger) — sidik final dihitung dari baris yang tersimpan
    const hashSimpan = sidik(tab, data, ctx);
    if (hashSimpan !== hashBaru) r.sidikNanti.push({ id: data.id, hash: hashSimpan });
    dbMap.set(data.id, data);
    if (aksi === 'insert') dbSemua.push(data);
    else dbSemua.splice(dbSemua.findIndex((x) => x.id === id), 1, data);
    return data as Rec;
  };

  /** Ganti nama master di sheet → baris tab lain yang masih memakai nama lama tetap dikenali di putaran ini. */
  const catatGantiNama = (lama: Rec | undefined, baru: Rec) => {
    const jenis = tab.tabel === 'klien' ? 'klien' : tab.tabel === 'vendor' ? 'vendor' : tab.tabel === 'rekening' ? 'rekening' : null;
    if (!jenis) return;
    const daftar = ctx[jenis];
    const i = daftar.findIndex((x) => x.id === baru.id);
    if (i >= 0) daftar[i] = { id: baru.id as string, nama: String(baru.nama) };
    else daftar.unshift({ id: baru.id as string, nama: String(baru.nama) });
    if (lama && lama.nama !== baru.nama) daftar.push({ id: lama.id as string, nama: String(lama.nama) });
  };

  for (let i = 1; i < baris.length; i++) {
    const no = i + 1;
    const row = baris[i] ?? [];
    const id = selTeks(sel(row, 'ID')).trim();
    const adaIsi = kolD.some((c) => c.judul !== 'Status' && selTeks(sel(row, c.judul)).trim() !== '');

    /* --- baris baru dari sheet (tanpa ID) --- */
    if (!id) {
      if (!adaIsi) continue;
      const b = baca(row);
      if ('galat' in b) {
        tolak(no, row, b.galat);
        continue;
      }
      const alasan = tab.cek?.(b.nilai, null, ctx, dbSemua);
      if (alasan) {
        tolak(no, row, alasan);
        continue;
      }
      if (b.nilai.arsip) continue; // baris baru yang langsung ditandai dihapus — abaikan
      const pulih = yatim.get(sidik(tab, { ...b.nilai, sheet_sumber: 'sheet' }, ctx));
      if (pulih) {
        yatim.delete(sidik(tab, pulih, ctx));
        terlihat.add(pulih.id as string);
        r.tulis.push({ baris: no, sel: render(pulih) });
        if (merahSebelumnya(row)) r.warna.push({ baris: no, merah: false });
        continue;
      }
      const baru = await simpan(no, row, 'insert', null, b.nilai);
      if (baru) {
        terlihat.add(baru.id as string);
        catatGantiNama(undefined, baru);
        r.tulis.push({ baris: no, sel: render(baru) });
        if (merahSebelumnya(row)) r.warna.push({ baris: no, merah: false });
      }
      continue;
    }

    if (!UUID.test(id)) {
      tolak(no, row, 'ID tidak dikenal. Kosongkan kolom ID kalau ini baris baru');
      continue;
    }
    if (terlihat.has(id)) {
      tolak(no, row, 'ID dobel (baris salinan?). Kosongkan kolom ID kalau ini memang baris baru');
      continue;
    }
    terlihat.add(id);
    const lama = dbMap.get(id);

    /* --- ID tidak ada di database --- */
    if (!lama) {
      const status = selTeks(sel(row, 'Status')).trim().toLowerCase();
      if (dihapusApp.has(id)) {
        // dihapus di aplikasi → tandai di sheet, bukan dibuat ulang
        if (status !== 'dihapus') r.tulis.push({ baris: no, sel: susun(r, (c) => (c.judul === 'Status' ? 'dihapus' : null)) });
        continue;
      }
      if (status === 'dihapus') continue;
      const b = baca(row);
      if ('galat' in b) {
        tolak(no, row, b.galat);
        continue;
      }
      const alasan = tab.cek?.(b.nilai, null, ctx, dbSemua);
      if (alasan) {
        tolak(no, row, alasan);
        continue;
      }
      const baru = await simpan(no, row, 'insert', id, b.nilai);
      if (baru) {
        catatGantiNama(undefined, baru);
        tulisBaris(no, row, baru);
      }
      continue;
    }

    /* --- baris yang tidak boleh ada di sheet (mis. kategori berubah jadi gaji) → kosongkan --- */
    if (tab.tampil && !tab.tampil(lama)) {
      terlihat.delete(id);
      r.tulis.push({ baris: no, sel: susun(r, () => '') });
      if (merahSebelumnya(row)) r.warna.push({ baris: no, merah: false });
      continue;
    }

    /* --- ID ada di keduanya: tentukan siapa yang berubah --- */
    const b = baca(row);
    const hashApp = sidik(tab, lama, ctx);
    const hashSheet = 'nilai' in b ? sidik(tab, { ...lama, ...b.nilai }, ctx) : null;
    const dasar = (lama.sheet_hash as string | null) ?? null;

    if (hashSheet === hashApp) {
      // isi sama — cukup rapikan tampilan sheet, dan catat sidik kalau belum
      if (dasar !== hashApp) {
        r.sidikNanti.push({ id, hash: hashApp });
        tulisBaris(no, row, { ...lama, diubah_pada: T });
      } else tulisBaris(no, row, lama);
      continue;
    }
    const sheetBerubah = hashSheet !== dasar;
    const appBerubah = hashApp !== dasar;

    const pakaiSheet = async (nilai: Rec) => {
      const alasan = tab.cek?.({ ...lama, ...nilai }, lama, ctx, dbSemua);
      if (alasan) {
        tolak(no, row, alasan);
        return false;
      }
      const baru = await simpan(no, row, 'update', id, nilai);
      if (!baru) return false;
      catatGantiNama(lama, baru);
      tulisBaris(no, row, baru);
      return true;
    };
    const pakaiApp = () => {
      hasil.keSheet++;
      r.sidikNanti.push({ id, hash: hashApp });
      r.tulis.push({ baris: no, sel: render({ ...lama, diubah_pada: T }) });
      if (merahSebelumnya(row)) r.warna.push({ baris: no, merah: false });
    };
    /** Status "dihapus" di sheet → arsipkan saja, kolom lain diabaikan. */
    const nilaiDariSheet = (): Rec | null => {
      if ('galat' in b) {
        // baris yang ditandai dihapus tetap diarsipkan walau kolom lain berantakan
        return selTeks(sel(row, 'Status')).trim().toLowerCase() === 'dihapus' ? { arsip: true } : null;
      }
      return b.nilai.arsip && !lama.arsip ? { arsip: true } : b.nilai;
    };

    if (sheetBerubah && !appBerubah) {
      const nilai = nilaiDariSheet();
      if (!nilai) tolak(no, row, (b as { galat: string }).galat);
      else await pakaiSheet(nilai);
      continue;
    }
    if (appBerubah && !sheetBerubah) {
      pakaiApp();
      continue;
    }

    /* --- bentrok: dua sisi berubah sejak sinkron terakhir --- */
    const tSheet = Date.parse(selTeks(sel(row, 'Diubah')).trim());
    const tApp = Date.parse(String(lama.diubah_pada ?? ''));
    const nilai = nilaiDariSheet();
    const sheetMenang = !!nilai && Number.isFinite(tSheet) && tSheet > tApp;
    hasil.konflik++;
    await db.from('sinkron_konflik').insert({
      tabel: tab.tabel,
      record_id: id,
      nilai_app: keObjek(tab, (j) => tab.kolom[j].ke(lama, ctx)),
      nilai_sheet: keObjek(tab, (j) => sel(row, tab.kolom[j].judul)),
      pemenang: sheetMenang ? 'sheet' : 'app',
    });
    if (sheetMenang) {
      if (!(await pakaiSheet(nilai!))) {
        // isi sheet ditolak validasi → versi aplikasi yang dipakai
        r.tulis = r.tulis.filter((w) => w.baris !== no);
        r.warna = r.warna.filter((w) => w.baris !== no);
        hasil.ditolak--;
        pakaiApp();
      }
    } else pakaiApp();
  }

  /* --- baris database yang tidak ada di sheet --- */
  const hilangBaru: Rec[] = [];
  let noBaru = Math.max(baris.length, 1) + 1; // baris 1 = judul kolom
  for (const x of dbSemua) {
    const id = x.id as string;
    if (terlihat.has(id) || (tab.tampil && !tab.tampil(x))) continue;
    if (x.sheet_hash) {
      // pernah ada di sheet lalu hilang → JANGAN dihapus, catat untuk ditinjau
      hilangBaru.push({ tabel: tab.tabel, record_id: id, data: keObjek(tab, (j) => tab.kolom[j].ke(x, ctx)) });
      continue;
    }
    if (x.arsip) continue;
    hasil.keSheet++;
    r.tulis.push({ baris: noBaru++, sel: render({ ...x, diubah_pada: T }) });
    r.sidikNanti.push({ id, hash: sidik(tab, x, ctx) });
    r.barisBaru++;
  }
  if (hilangBaru.length) {
    const { data: sudah } = await db
      .from('sinkron_hilang')
      .select('record_id')
      .eq('tabel', tab.tabel)
      .eq('ditinjau', false)
      .in('record_id', hilangBaru.map((h) => h.record_id as string));
    const ada = new Set((sudah ?? []).map((s) => s.record_id));
    const baru = hilangBaru.filter((h) => !ada.has(h.record_id));
    if (baru.length) {
      await db.from('sinkron_hilang').insert(baru);
      hasil.hilang += baru.length;
    }
  }
  return r;
}

/** Susun satu baris sheet sesuai posisi kolom. null = sel tidak disentuh. */
function susun(r: { tab: Tab; posisi: Map<string, number>; lebar: number }, isi: (c: Tab['kolom'][number]) => Sel): Sel[] {
  const row: Sel[] = Array.from({ length: r.lebar }, () => null);
  for (const c of r.tab.kolom) row[r.posisi.get(c.judul)!] = isi(c);
  return row;
}

/**
 * Perlu sinkron sekarang? Ya kalau ada perubahan aplikasi yang belum ditulis ke sheet,
 * atau tarikan terakhir dari sheet sudah lebih dari 5 menit lalu.
 */
export async function perluSinkron(): Promise<boolean | { cobaLagiMs: number }> {
  if (!konfigSheet()) return false;
  const db = klienAdmin();
  const [{ count }, { data: st }] = await Promise.all([
    db.from('sinkron_antrean').select('id', { count: 'exact', head: true }).eq('diproses', false),
    db.from('sinkron_status').select('terakhir, kunci_sampai').eq('arah', 'dari_sheet').maybeSingle(),
  ]);
  // Baru saja gagal (mis. sheet belum dibagikan)? Tunggu 5 menit, jangan dicoba tiap 30 detik.
  const { data: log } = await db.from('sinkron_log').select('pesan, waktu').order('waktu', { ascending: false }).limit(1).maybeSingle();
  if (log?.pesan?.startsWith('GAGAL') && Date.now() - Date.parse(log.waktu) < 5 * 60_000) return false;
  const terakhir = st?.terakhir ? Date.parse(st.terakhir) : 0;
  // Jarak minimum antarputaran otomatis 10 detik: satu putaran ±4 panggilan API,
  // jadi paling banyak ±24 panggilan per menit — jauh di bawah kuota 60/menit.
  const jeda = 10_000 - (Date.now() - terakhir);
  if (jeda > 0) return count ? { cobaLagiMs: jeda + 500 } : false;
  if (count) return true;
  return Date.now() - terakhir > 5 * 60_000;
}
