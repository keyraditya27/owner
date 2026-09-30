import { NextResponse, type NextRequest } from 'next/server';
import { bulanIni, rp, tgl } from '@/lib/format';
import { sisaTagihan } from '@/lib/hitung';
import { judulTagih, susunIcs, tokenSah, type Acara } from '@/lib/kalender';
import { klienAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kalender/<token>.ics — kalender penagihan untuk Google Calendar (berlangganan lewat URL).
 * Tanpa sesi login (Google yang mengambilnya), jadi dijaga token rahasia dari CRON_SECRET.
 * Isi: jadwal tagih bulanan tiap klien aktif, jatuh tempo tagihan yang belum lunas,
 * dan pengingat gaji tanggal 1 (tanpa nominal gaji).
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenSah(token.replace(/\.ics$/, ''))) return new NextResponse('Tidak ditemukan', { status: 404 });

  const db = klienAdmin();
  const [{ data: klien }, { data: tagihan }, { data: karyawan }] = await Promise.all([
    db.from('klien').select('id, nama, paket, nilai_bulanan, tanggal_tagih, tempo_hari, catatan').eq('aktif', true).eq('arsip', false),
    db.from('tagihan').select('id, klien_id, periode, nominal, dibayar, pph23_dipotong, jatuh_tempo').eq('arsip', false),
    db.from('karyawan').select('nama').eq('aktif', true).gt('gaji_pokok', 0),
  ]);
  const app = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const awalBulan = bulanIni();
  const namaKlien = new Map((klien ?? []).map((k) => [k.id, k.nama]));
  const acara: Acara[] = [];

  for (const k of klien ?? []) {
    const hari = Math.min(28, Math.max(1, k.tanggal_tagih || 1));
    acara.push({
      uid: `tagih-${k.id}`,
      tanggal: `${awalBulan}-${String(hari).padStart(2, '0')}`,
      bulanan: hari,
      judul: judulTagih(k.nama, k.nilai_bulanan),
      isi: [k.paket ? `Paket: ${k.paket}` : '', k.catatan || '', `Tempo bayar ${k.tempo_hari} hari.`, app ? `Buka: ${app}/klien` : '']
        .filter(Boolean)
        .join('\n'),
      url: app ? `${app}/klien` : undefined,
    });
  }

  for (const t of tagihan ?? []) {
    const sisa = sisaTagihan(t);
    if (sisa <= 0 || !t.jatuh_tempo) continue;
    acara.push({
      uid: `jatuh-tempo-${t.id}`,
      tanggal: t.jatuh_tempo,
      judul: `Jatuh tempo: ${namaKlien.get(t.klien_id) ?? 'klien'} ${t.periode} — sisa ${rp(sisa)}`,
      isi: `Tagihan ${t.periode} jatuh tempo ${tgl(t.jatuh_tempo)}.${app ? `\nBuka: ${app}/klien?tab=telat` : ''}`,
    });
  }

  if (karyawan?.length) {
    acara.push({
      uid: 'gaji-bulanan',
      tanggal: `${awalBulan}-01`,
      bulanan: 1,
      judul: `Bayar gaji tim (${karyawan.length} orang)`,
      isi: `${karyawan.map((k) => k.nama).join(', ')}.\nCatat lewat tombol "Catat gaji" di Ringkasan.${app ? `\n${app}/ringkasan` : ''}`,
    });
  }

  return new NextResponse(susunIcs('ARL — Penagihan & Gaji', acara), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
