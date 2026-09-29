// =====================================================================
// Impor data lama dari prototipe (arl-keuangan-DATA.json) ke Supabase.
//
//   npm run impor                 → impor sungguhan
//   npm run impor -- --coba       → hanya hitung & tampilkan, tidak menulis apa pun
//
// Idempoten: dijalankan berkali-kali tidak membuat data ganda. Baris yang
// sudah ada TIDAK ditimpa, jadi perubahan yang sudah dibuat di aplikasi aman.
// Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local.
// =====================================================================
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const COBA = process.argv.includes('--coba');
const FILE = process.argv.find((a) => a.endsWith('.json')) ?? 'arl-keuangan-DATA.json';

/** Nama rekening di prototipe → nama rekening di database (dikonfirmasi Key). */
const ALIAS_REKENING = { 'rekening operasional': 'BCA Operasional' };

// ---------------------------------------------------------------- env
function muatEnv(f) {
  if (!existsSync(f)) return;
  for (const baris of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\n/g, '\n');
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
muatEnv('.env.local');
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !KUNCI) {
  console.error('✕ NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local');
  process.exit(1);
}
if (!existsSync(FILE)) {
  console.error(`✕ File ${FILE} tidak ditemukan`);
  process.exit(1);
}
const db = createClient(URL_SB, KUNCI, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync(FILE, 'utf8'));

// ---------------------------------------------------------------- util
/** UUID tetap dari isi baris — dasar idempotensi (id di prototipe acak tiap ekspor). */
function uuidDari(...bagian) {
  const h = createHash('sha1').update('arl-impor:' + bagian.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const bulat = (v) => Math.max(0, Math.round(Number(v) || 0));
const tglAtauNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const kosongJadiNull = (v) => (v === '' || v === undefined ? null : v);
const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const cek = (hasil, apa) => {
  if (hasil.error) throw new Error(`${apa}: ${hasil.error.message}`);
  return hasil.data;
};

/** Sisipkan baris yang id-nya belum ada. Mengembalikan baris yang benar-benar baru. */
async function sisipkanBaru(tabel, baris, kunci = 'id') {
  if (!baris.length) return [];
  const nilai = baris.map((b) => b[kunci]);
  const ada = new Set();
  for (let i = 0; i < nilai.length; i += 200) {
    const d = cek(await db.from(tabel).select(kunci).in(kunci, nilai.slice(i, i + 200)), `baca ${tabel}`);
    d.forEach((r) => ada.add(r[kunci]));
  }
  const baru = baris.filter((b) => !ada.has(b[kunci]));
  if (!COBA && baru.length) {
    for (let i = 0; i < baru.length; i += 200) cek(await db.from(tabel).insert(baru.slice(i, i + 200)), `sisip ${tabel}`);
  }
  return baru;
}

const laporan = [];
const catat = (tabel, total, baru) => laporan.push({ tabel, 'di file': total, 'baru dimasukkan': baru, 'sudah ada': total - baru });

// ================================================================ MULAI
console.log(`${COBA ? '[MODE COBA — tidak menulis] ' : ''}Impor dari ${FILE} ke ${URL_SB}\n`);

// ---------------------------------------------------------------- pemilik (untuk dibuat_oleh)
const pemilik = cek(await db.from('pengguna').select('id').eq('peran', 'pemilik').limit(1), 'baca pengguna')[0]?.id ?? null;

// ---------------------------------------------------------------- perusahaan (perbarui, jangan buat baru)
const p = data.perusahaan ?? {};
const perusahaanLama = cek(await db.from('perusahaan').select('*').limit(1), 'baca perusahaan')[0];
if (perusahaanLama) {
  const ubah = {};
  if (p.nama) ubah.nama = p.nama;
  if (p.npwp) ubah.npwp = p.npwp;
  if (typeof p.pkp === 'boolean') ubah.pkp = p.pkp;
  if (p.alamat) ubah.alamat = p.alamat;
  if (p.modalDisetor) ubah.modal_disetor = bulat(p.modalDisetor);
  if (p.batasKapitalisasi) ubah.batas_kapitalisasi = bulat(p.batasKapitalisasi);
  if (!COBA) cek(await db.from('perusahaan').update(ubah).eq('id', perusahaanLama.id), 'perbarui perusahaan');
  laporan.push({ tabel: 'perusahaan', 'di file': 1, 'baru dimasukkan': 0, 'sudah ada': 1 });
} else {
  console.warn('! Baris perusahaan tidak ada — jalankan schema.sql dulu. Dilewati.');
}

// ---------------------------------------------------------------- rekening
const rekDb = cek(await db.from('rekening').select('id, nama'), 'baca rekening');
const cariRek = (nama) => {
  const n = (ALIAS_REKENING[nama.toLowerCase()] ?? nama).toLowerCase();
  return rekDb.find((r) => r.nama.toLowerCase() === n);
};
const petaRekening = {}; // id prototipe → id database
const rekBaru = [];
for (const r of data.rekening ?? []) {
  const ada = cariRek(r.nama);
  if (ada) {
    petaRekening[r.id] = ada.id;
    continue;
  }
  const baris = {
    id: uuidDari('rekening', r.nama),
    nama: r.nama,
    jenis: ['Bank', 'Kas', 'E-wallet'].includes(r.jenis) ? r.jenis : 'Bank',
    bank: kosongJadiNull(r.bank),
    no_rek: r.noRek ? String(r.noRek).replace(/\D/g, '').slice(-4) || null : null,
    saldo_awal: Math.round(Number(r.saldoAwal) || 0),
    catatan: kosongJadiNull(r.catatan),
  };
  rekBaru.push(baris);
  petaRekening[r.id] = baris.id;
}
catat('rekening', (data.rekening ?? []).length, (await sisipkanBaru('rekening', rekBaru)).length);

// ---------------------------------------------------------------- klien + tagihan
const klienDb = cek(await db.from('klien').select('id, nama'), 'baca klien');
const petaKlien = {};
const klienBaru = [];
for (const k of data.klien ?? []) {
  const ada = klienDb.find((x) => x.nama.toLowerCase() === k.nama.toLowerCase());
  if (ada) {
    petaKlien[k.id] = ada.id;
    continue;
  }
  const baris = {
    id: uuidDari('klien', k.nama.toLowerCase()),
    nama: k.nama,
    pic: kosongJadiNull(k.pic),
    wa: kosongJadiNull(String(k.wa ?? '').replace(/\D/g, '')),
    paket: kosongJadiNull(k.paket),
    nilai_bulanan: bulat(k.nilai),
    tanggal_tagih: Math.min(28, Math.max(1, Number(k.tanggalTagih) || 1)),
    tempo_hari: Math.min(90, Math.max(0, Number(k.tempoHari ?? 7))),
    catatan: kosongJadiNull(k.catatan),
  };
  klienBaru.push(baris);
  petaKlien[k.id] = baris.id;
}
catat('klien', (data.klien ?? []).length, (await sisipkanBaru('klien', klienBaru)).length);

const tagihan = [];
for (const k of data.klien ?? []) {
  (k.tagihan ?? []).forEach((i, n) => {
    const tglInvoice = tglAtauNull(i.tglTagih) ?? tglAtauNull(i.jatuhTempo) ?? new Date().toISOString().slice(0, 10);
    tagihan.push({
      id: uuidDari('tagihan', k.nama.toLowerCase(), i.periode, i.jatuhTempo, n),
      klien_id: petaKlien[k.id],
      periode: i.periode || 'Tanpa periode',
      nominal: bulat(i.nominal),
      dibayar: Math.min(bulat(i.dibayar), bulat(i.nominal)),
      tgl_invoice: tglInvoice,
      jatuh_tempo: tglAtauNull(i.jatuhTempo) ?? tglInvoice,
      catatan: kosongJadiNull(i.catatan),
    });
  });
}
catat('tagihan', tagihan.length, (await sisipkanBaru('tagihan', tagihan)).length);

// ---------------------------------------------------------------- vendor + utang
const vendorDb = cek(await db.from('vendor').select('id, nama'), 'baca vendor');
const petaVendor = {};
const vendorBaru = [];
for (const v of data.vendor ?? []) {
  const ada = vendorDb.find((x) => x.nama.toLowerCase() === v.nama.toLowerCase());
  if (ada) {
    petaVendor[v.id] = ada.id;
    continue;
  }
  const baris = {
    id: uuidDari('vendor', v.nama.toLowerCase()),
    nama: v.nama,
    jenis: v.jenis || 'Lain-lain',
    wa: kosongJadiNull(String(v.wa ?? '').replace(/\D/g, '')),
    npwp: !!v.npwp,
    catatan: kosongJadiNull(v.catatan),
  };
  vendorBaru.push(baris);
  petaVendor[v.id] = baris.id;
}
catat('vendor', (data.vendor ?? []).length, (await sisipkanBaru('vendor', vendorBaru)).length);

const utang = [];
for (const v of data.vendor ?? []) {
  (v.utang ?? []).forEach((u, n) =>
    utang.push({
      id: uuidDari('utang', v.nama.toLowerCase(), u.keterangan, u.jatuhTempo, n),
      vendor_id: petaVendor[v.id],
      keterangan: u.keterangan || 'Tagihan',
      nominal: bulat(u.nominal),
      dibayar: Math.min(bulat(u.dibayar), bulat(u.nominal)),
      jatuh_tempo: tglAtauNull(u.jatuhTempo) ?? new Date().toISOString().slice(0, 10),
      catatan: kosongJadiNull(u.catatan),
    }),
  );
}
catat('utang_vendor', utang.length, (await sisipkanBaru('utang_vendor', utang)).length);

// ---------------------------------------------------------------- transaksi
const hitungan = {};
const trx = (data.transaksi ?? [])
  .slice()
  .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || String(a.keterangan).localeCompare(String(b.keterangan)))
  .map((t) => {
    // Baris kembar (tanggal, nominal, keterangan sama) dibedakan dengan nomor urut kemunculan.
    const dasar = [t.tanggal, t.tipe, bulat(t.nominal), t.kategori, t.keterangan].join('|');
    hitungan[dasar] = (hitungan[dasar] ?? 0) + 1;
    return {
      _bukti: t.bukti,
      _buktiNama: t.buktiNama,
      id: uuidDari('transaksi', dasar, hitungan[dasar]),
      tanggal: t.tanggal,
      tipe: t.tipe === 'masuk' ? 'masuk' : 'keluar',
      nominal: bulat(t.nominal),
      kategori: t.kategori || 'Lain-lain',
      keterangan: t.keterangan || 'Transaksi',
      metode: t.metode || 'Transfer bank',
      klien_id: t.klienId ? petaKlien[t.klienId] ?? null : null,
      rekening_id: t.rekeningId ? petaRekening[t.rekeningId] ?? null : null,
      sumber: 'impor',
      dibuat_oleh: pemilik,
    };
  });
const salah = trx.filter((t) => !tglAtauNull(t.tanggal));
if (salah.length) throw new Error(`${salah.length} transaksi tanggalnya tidak valid — perbaiki di file dulu`);

const trxBaru = await sisipkanBaru(
  'transaksi',
  trx.map((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('_')))),
);
catat('transaksi', trx.length, trxBaru.length);

// Bukti base64 → Storage. Hanya untuk transaksi yang baru dimasukkan.
let buktiNaik = 0;
const idBaru = new Set(trxBaru.map((t) => t.id));
for (const t of trx.filter((x) => idBaru.has(x.id) && typeof x._bukti === 'string' && x._bukti.startsWith('data:'))) {
  const m = t._bukti.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) continue;
  const ext = m[1] === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `transaksi/${t.id}/impor.${ext}`;
  if (!COBA) {
    cek(await db.storage.from('bukti').upload(path, Buffer.from(m[2], 'base64'), { contentType: m[1], upsert: true }), 'unggah bukti');
    cek(await db.from('transaksi').update({ bukti_url: path, bukti_nama: t._buktiNama || `bukti.${ext}` }).eq('id', t.id), 'simpan bukti');
  }
  buktiNaik++;
}

// ---------------------------------------------------------------- aset
const JENIS_ASET = { tetap: 'tetap', inventaris: 'inventaris' };
const aset = (data.aset ?? []).map((a) => ({
  id: a.kode ? uuidDari('aset', a.kode) : uuidDari('aset', a.nama, a.tglPerolehan),
  kode: kosongJadiNull(a.kode),
  nama: a.nama,
  kategori: a.kategori || 'Lain-lain',
  jenis: JENIS_ASET[a.jenisAset] ?? 'tetap',
  kelompok: ['1', '2', '3', '4', 'bp', 'bnp'].includes(String(a.kelompok)) ? String(a.kelompok) : '1',
  tgl_perolehan: tglAtauNull(a.tglPerolehan),
  harga_perolehan: bulat(a.hargaPerolehan),
  nilai_residu: Math.min(bulat(a.nilaiResidu), bulat(a.hargaPerolehan)),
  metode: a.metode === 'saldo_menurun' ? 'saldo_menurun' : 'garis_lurus',
  qty: Math.max(1, Number(a.qty) || 1),
  lokasi: kosongJadiNull(a.lokasi),
  penanggung_jawab: kosongJadiNull(a.penanggungJawab),
  kondisi: ['Baik', 'Perlu perbaikan', 'Rusak'].includes(a.kondisi) ? a.kondisi : 'Baik',
  status: ['Aktif', 'Dilepas', 'Hilang'].includes(a.status) ? a.status : 'Aktif',
  tgl_lepas: tglAtauNull(a.tglLepas),
  nilai_jual: a.nilaiJual ? bulat(a.nilaiJual) : null,
  catatan: kosongJadiNull(a.catatan),
}));
const asetSalah = aset.filter((a) => !a.tgl_perolehan);
if (asetSalah.length) throw new Error(`Aset tanpa tanggal perolehan: ${asetSalah.map((a) => a.nama).join(', ')}`);
catat('aset', aset.length, (await sisipkanBaru('aset', aset)).length);

// ---------------------------------------------------------------- pajak (unik per periode + jenis)
const pajakDb = cek(await db.from('pajak').select('periode, jenis'), 'baca pajak');
const pajak = (data.pajak ?? [])
  .filter((x) => !pajakDb.some((y) => y.periode === x.periode && y.jenis === x.jenis))
  .map((x) => ({
    id: uuidDari('pajak', x.periode, x.jenis),
    periode: x.periode,
    jenis: x.jenis,
    dpp: bulat(x.dpp),
    nominal: bulat(x.nominal),
    tgl_setor: tglAtauNull(x.tglSetor),
    ntpn: kosongJadiNull(x.ntpn),
    tgl_lapor: tglAtauNull(x.tglLapor),
    catatan: kosongJadiNull(x.catatan),
  }));
catat('pajak', (data.pajak ?? []).length, (await sisipkanBaru('pajak', pajak)).length);

// ================================================================ RINGKASAN
console.table(laporan);
if (buktiNaik) console.log(`Bukti diunggah ke Storage: ${buktiNaik}`);

const sumber = COBA
  ? { transaksi: trx, rekening: [...rekDb.map((r) => ({ ...r, saldo_awal: 0 })), ...rekBaru], tagihan, utang }
  : {
      transaksi: cek(await db.from('transaksi').select('tipe, nominal, rekening_id'), 'baca'),
      rekening: cek(await db.from('rekening').select('id, nama, saldo_awal'), 'baca'),
      tagihan: cek(await db.from('tagihan').select('nominal, dibayar, pph23_dipotong'), 'baca'),
      utang: cek(await db.from('utang_vendor').select('nominal, dibayar'), 'baca'),
    };
const masuk = sumber.transaksi.filter((t) => t.tipe === 'masuk').reduce((s, t) => s + t.nominal, 0);
const keluar = sumber.transaksi.filter((t) => t.tipe === 'keluar').reduce((s, t) => s + t.nominal, 0);
const saldoAwal = sumber.rekening.reduce((s, r) => s + (r.saldo_awal || 0), 0);
const piutang = sumber.tagihan.reduce((s, i) => s + Math.max(0, i.nominal - (i.dibayar || 0) - (i.pph23_dipotong || 0)), 0);
const utangTotal = sumber.utang.reduce((s, u) => s + Math.max(0, u.nominal - (u.dibayar || 0)), 0);

console.log(`
Angka ${COBA ? 'yang akan ada' : 'di database sekarang'}:
  Uang masuk      ${rp(masuk)}
  Uang keluar     ${rp(keluar)}
  Total saldo kas ${rp(saldoAwal + masuk - keluar)}
  Total piutang   ${rp(piutang)}
  Total utang     ${rp(utangTotal)}

Cocokkan dengan prototipe: masuk Rp 29.957.363 · keluar Rp 25.919.647 · saldo Rp 4.037.716.`);
for (const r of sumber.rekening) {
  const s = (r.saldo_awal || 0) + sumber.transaksi.filter((t) => t.rekening_id === r.id).reduce((x, t) => x + (t.tipe === 'masuk' ? t.nominal : -t.nominal), 0);
  console.log(`  ${r.nama.padEnd(22)} ${rp(s)}`);
}
