import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ambilData } from '@/lib/data';
import { hariIni } from '@/lib/format';
import { penggunaSaatIni } from '@/lib/pengguna';
import { klienAdmin } from '@/lib/supabase/admin';
import { klienServer } from '@/lib/supabase/server';
import { BUKTI_MAKS_BYTE } from '@/lib/konstanta';
import { GalatAI, panggilGemini } from '@/lib/ai/gemini';
import { ambilJSON, instruksiSistem } from '@/lib/ai/instruksi';
import { otakOffline } from '@/lib/ai/offline';
import { rencanakan, type BarisLog } from '@/lib/ai/rencana';

export const maxDuration = 60;

const GAMBAR_AI = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export type JawabanChat = {
  balas: string;
  log: BarisLog[];
  mode: string;
  riwayatId: string | null;
  galat?: string;
};

/**
 * POST /api/chat — teks + (opsional) foto/PDF bukti.
 * 1. susun konteks dari database  2. panggil Gemini (server saja)
 * 3. validasi keluaran model       4. jalankan semua perubahan dalam satu transaksi DB
 * 5. simpan riwayat untuk tombol Batalkan
 */
export async function POST(req: NextRequest) {
  const saya = await penggunaSaatIni();
  if (!saya) return NextResponse.json({ galat: 'Harus login' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ galat: 'Permintaan tidak valid' }, { status: 400 });
  }
  const teks = String(form.get('teks') ?? '').trim().slice(0, 2000);
  const f = form.get('gambar');
  const file = f instanceof File && f.size > 0 ? f : null;
  if (!teks && !file) return NextResponse.json({ galat: 'Pesan kosong' }, { status: 400 });
  if (file && (!GAMBAR_AI.includes(file.type) || file.size > BUKTI_MAKS_BYTE)) {
    return NextResponse.json({ galat: 'Lampiran harus gambar atau PDF, maksimal 8 MB' }, { status: 400 });
  }

  const db = await klienServer();
  const hari = hariIni();
  const [data, tutupQ] = await Promise.all([ambilData(), db.from('tutup_buku').select('periode')]);
  const aset = data.aset;

  // ---- 1-2. tanya model (atau cadangan offline)
  let hasil: { balas?: unknown; aksi?: unknown };
  let mode = 'gemini';
  let catatan = '';
  try {
    const gambar = file ? { mime: file.type, base64: Buffer.from(await file.arrayBuffer()).toString('base64') } : null;
    const r = await panggilGemini(instruksiSistem(data, aset, hari), teks, gambar);
    mode = r.model;
    hasil = ambilJSON(r.teks);
  } catch (e) {
    console.error('AI:', e instanceof Error ? e.message : e);
    catatan = `AI tidak bisa dihubungi${e instanceof GalatAI ? ' — ' + e.message : ''}.\n\n`;
    hasil = otakOffline(teks, data);
    mode = 'offline';
  }

  // ---- 3. validasi — jangan percaya keluaran model
  const { ops, log } = rencanakan(hasil.aksi, {
    data,
    aset,
    batasKapitalisasi: data.perusahaan?.batas_kapitalisasi ?? 5_000_000,
    periodeTutup: new Set((tutupQ.data ?? []).map((t) => t.periode as string)),
    pengguna: { id: saya.id, peran: saya.peran },
    hariIni: hari,
  });

  // ---- 4. satu transaksi database
  let riwayatId: string | null = null;
  if (ops.length) {
    const { data: rid, error } = await db.rpc('terapkan_perubahan', { p_perintah: teks || '(bukti terlampir)', p_ops: ops });
    if (error) {
      console.error('terapkan_perubahan:', error.message);
      log.forEach((l) => {
        if (l.ok) {
          l.ok = false;
          l.trxId = undefined;
        }
      });
      log.push({ ok: false, teks: `Tidak ada yang disimpan: ${error.message}` });
    } else {
      riwayatId = rid as string;
    }
  }

  // Bukti menempel ke transaksi pertama yang dibuat/diubah
  const trxPertama = riwayatId ? log.find((l) => l.ok && l.trxId)?.trxId : undefined;
  if (file && trxPertama) {
    const path = `transaksi/${trxPertama}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'bukti'}`;
    const up = await klienAdmin().storage.from('bukti').upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (!up.error) await db.from('transaksi').update({ bukti_url: path, bukti_nama: file.name.slice(0, 200) }).eq('id', trxPertama);
    else log.push({ ok: false, teks: 'Bukti gagal diunggah — lampirkan ulang lewat halaman Transaksi' });
  }

  // Kalimat model tidak boleh mengklaim sesuatu yang ditolak server.
  const berhasil = log.filter((l) => l.ok).length;
  const kalimatModel = typeof hasil.balas === 'string' ? hasil.balas.slice(0, 2000) : '';
  const balas =
    catatan +
    (log.length && !berhasil
      ? 'Tidak ada yang disimpan — alasannya di bawah.'
      : berhasil < log.length
        ? `${kalimatModel}\n\nSebagian perintah ditolak — lihat rinciannya di bawah.`
        : kalimatModel);

  // ---- simpan riwayat chat
  // Waktu dibuat diberi selisih 1 ms supaya urutan tampil tetap: pesan → balasan → kartu perubahan.
  const t0 = Date.now();
  const baris = [
    { peran: 'me', isi: teks || '(bukti terlampir)', data: { bukti: !!file } },
    ...(balas ? [{ peran: 'ai', isi: balas }] : []),
    ...(log.length ? [{ peran: 'log', data: { log, mode, riwayatId } }] : []),
  ].map((b, i) => ({ ...b, pengguna_id: saya.id, dibuat_pada: new Date(t0 + i).toISOString() }));
  await db.from('chat').insert(baris);

  if (riwayatId) revalidatePath('/', 'layout');
  return NextResponse.json({ balas, log, mode, riwayatId } satisfies JawabanChat);
}
