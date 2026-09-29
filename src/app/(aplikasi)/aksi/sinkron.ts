'use server';

/** Tahap 6: pemicu sinkron Google Sheets & tinjauan bentrok/baris hilang. */
import { Tolak, idWajib, jalankan, pesanGalat, segarkan } from '@/lib/aksi';
import type { Hasil } from '@/lib/aksi-tipe';
import { wajibLogin } from '@/lib/pengguna';
import { perluSinkron, sinkron } from '@/lib/sheets/sinkron';
import { klienServer } from '@/lib/supabase/server';

const TABEL_SINKRON = ['transaksi', 'klien', 'tagihan', 'vendor', 'utang_vendor', 'aset', 'pajak', 'rekening'];

async function wajibPengelola() {
  const p = await wajibLogin();
  if (p.peran === 'staf') throw new Tolak('Hanya pemilik atau admin yang bisa mengatur sinkron sheet.');
  return p;
}

/**
 * Dipanggil otomatis dari aplikasi yang sedang terbuka (tiap 30 detik & saat dibuka).
 * Langsung selesai kalau tidak ada yang perlu — antrean kosong dan tarikan terakhir < 5 menit.
 * `cobaLagiMs` = ada perubahan menunggu tapi putaran sebelumnya baru saja jalan (jarak minimum
 * demi kuota API) — peramban diminta memanggil lagi setelah jeda itu.
 */
export async function pemicuSinkron(): Promise<{ cobaLagiMs?: number }> {
  await wajibLogin();
  try {
    const perlu = await perluSinkron();
    if (!perlu) return {};
    if (typeof perlu === 'object') return perlu;
    const h = await sinkron('otomatis');
    if (h.masukDb) segarkan();
    return {};
  } catch {
    // galat sudah dicatat di sinkron_log & sinkron_status; jangan ganggu pengguna tiap 30 detik
    return {};
  }
}

/** Tombol "Tarik dari Sheet". */
export async function tarikDariSheet(): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    try {
      const h = await sinkron('manual');
      if (!h.jalan) return { galat: h.alasan ?? 'Sinkron tidak berjalan.' };
      segarkan();
      const bagian = [
        `${h.masukDb} baris masuk dari sheet`,
        `${h.keSheet} ditulis ke sheet`,
        h.ditolak ? `${h.ditolak} ditolak (merah di sheet)` : '',
        h.konflik ? `${h.konflik} bentrok` : '',
        h.hilang ? `${h.hilang} hilang dari sheet` : '',
      ].filter(Boolean);
      return { ok: true, pesan: 'Sinkron selesai: ' + bagian.join(', ') };
    } catch (e) {
      return { galat: 'Sinkron gagal: ' + (e instanceof Error ? e.message : String(e)) };
    }
  });
}

export async function tinjauKonflik(id: number): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    const db = await klienServer();
    const { error } = await db.from('sinkron_konflik').update({ ditinjau: true }).eq('id', Number(id));
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: 'Ditandai sudah ditinjau' };
  });
}

export async function tinjauHilang(id: number): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    const db = await klienServer();
    const { error } = await db.from('sinkron_hilang').update({ ditinjau: true }).eq('id', Number(id));
    if (error) return { galat: pesanGalat(error) };
    segarkan();
    return { ok: true, pesan: 'Ditandai sudah ditinjau — data tetap ada di aplikasi' };
  });
}

/** Baris yang terhapus dari sheet ditulis ulang di putaran sinkron berikutnya. */
export async function kembalikanKeSheet(id: number): Promise<Hasil> {
  return jalankan(async () => {
    await wajibPengelola();
    const db = await klienServer();
    const { data: h } = await db.from('sinkron_hilang').select('tabel, record_id').eq('id', Number(id)).maybeSingle();
    if (!h || !TABEL_SINKRON.includes(h.tabel)) return { galat: 'Catatan tidak ditemukan.' };
    // sidik dikosongkan → sinkron menganggapnya belum pernah ada di sheet → ditambahkan lagi
    const { error } = await db.from(h.tabel).update({ sheet_hash: null }).eq('id', idWajib(h.record_id));
    if (error) return { galat: pesanGalat(error) };
    await db.from('sinkron_hilang').update({ ditinjau: true }).eq('id', Number(id));
    segarkan();
    return { ok: true, pesan: 'Akan ditulis ulang ke sheet dalam 30 detik' };
  });
}
