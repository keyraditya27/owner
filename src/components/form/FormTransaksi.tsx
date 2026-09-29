'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/Modal';
import { hapusTransaksi, simpanTransaksi } from '@/app/(aplikasi)/aksi/transaksi';
import { hariIni } from '@/lib/format';
import { BUKTI_MAKS_BYTE, kategoriUntuk, METODE } from '@/lib/konstanta';
import type { Transaksi } from '@/lib/tipe-db';
import { Grid, InputRupiah, Isian, PesanGalat } from './Isian';
import { usePusat } from './PusatForm';

/** Perkecil foto bukti sebelum diunggah (sama dengan compressImage di prototipe: sisi terpanjang 1100px, JPEG 72%). */
async function kecilkan(file: File, maks = 1100): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  try {
    const bmp = await createImageBitmap(file);
    const sk = Math.min(1, maks / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sk);
    c.height = Math.round(bmp.height * sk);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.72));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function FormTransaksi({ data }: { data?: Transaksi }) {
  const { tutup, kabar, klien, rekening, bolehKelola } = usePusat();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');
  const [f, setF] = useState({
    tipe: data?.tipe ?? 'keluar',
    tanggal: data?.tanggal ?? hariIni(),
    keterangan: data?.keterangan ?? '',
    nominal: data ? String(data.nominal) : '',
    metode: data?.metode ?? 'Transfer bank',
    kategori: data?.kategori ?? 'Lain-lain',
    rekening_id: data?.rekening_id ?? rekening[0]?.id ?? '',
    klien_id: data?.klien_id ?? '',
  });
  const [bukti, setBukti] = useState<File | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const kats = kategoriUntuk(f.tipe);
  const kategori = kats.includes(f.kategori) ? f.kategori : 'Lain-lain';

  const simpan = () =>
    mulai(async () => {
      setGalat('');
      const fd = new FormData();
      if (data) fd.set('id', data.id);
      Object.entries({ ...f, kategori }).forEach(([k, v]) => fd.set(k, v));
      if (bukti) {
        const kecil = await kecilkan(bukti);
        if (kecil.size > BUKTI_MAKS_BYTE) return setGalat('Ukuran bukti maksimal 8 MB.');
        fd.set('bukti', kecil);
      }
      const h = await simpanTransaksi(fd);
      if (h.galat && !h.ok) return setGalat(h.galat);
      tutup();
      kabar(h.galat ?? 'Transaksi tersimpan');
    });

  const hapus = () =>
    mulai(async () => {
      if (!data || !confirm('Hapus transaksi ini? Tindakan tercatat di riwayat perubahan.')) return;
      const h = await hapusTransaksi(data.id);
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar('Transaksi dihapus');
    });

  return (
    <Modal
      judul={data ? 'Ubah Transaksi' : 'Catat Transaksi'}
      onTutup={tutup}
      kaki={
        <>
          {data && bolehKelola ? (
            <button className="btn-ghost mr-auto !border-merah-garis !text-merah" onClick={hapus} disabled={proses}>
              Hapus
            </button>
          ) : null}
          <button className="btn-ghost" onClick={tutup}>
            Batal
          </button>
          <button className="btn" onClick={simpan} disabled={proses}>
            {proses ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <Grid>
        <Isian label="Tipe" htmlFor="mTipe">
          <select id="mTipe" value={f.tipe} onChange={(e) => set('tipe', e.target.value)}>
            <option value="keluar">Uang keluar</option>
            <option value="masuk">Uang masuk</option>
          </select>
        </Isian>
        <Isian label="Tanggal" htmlFor="mTanggal">
          <input id="mTanggal" type="date" value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
        </Isian>
        <Isian label="Keterangan" penuh htmlFor="mKet">
          <input
            id="mKet"
            value={f.keterangan}
            onChange={(e) => set('keterangan', e.target.value)}
            placeholder="Top up Shopee Ads Batik Ayman"
          />
        </Isian>
        <Isian label="Nominal" htmlFor="mNominal">
          <InputRupiah id="mNominal" nilai={f.nominal} ubah={(v) => set('nominal', v)} />
        </Isian>
        <Isian label="Metode" htmlFor="mMetode">
          <select id="mMetode" value={f.metode} onChange={(e) => set('metode', e.target.value)}>
            {METODE.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Kategori" htmlFor="mKat">
          <select id="mKat" value={kategori} onChange={(e) => set('kategori', e.target.value)}>
            {kats.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Rekening" htmlFor="mRek">
          <select id="mRek" value={f.rekening_id} onChange={(e) => set('rekening_id', e.target.value)}>
            <option value="">— belum ditandai —</option>
            {rekening.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nama}
              </option>
            ))}
          </select>
        </Isian>
        <Isian label="Klien" htmlFor="mKlien">
          <select id="mKlien" value={f.klien_id} onChange={(e) => set('klien_id', e.target.value)}>
            <option value="">— internal ARL —</option>
            {klien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </Isian>
        <Isian label={data?.bukti_url ? 'Ganti bukti (opsional)' : 'Bukti (opsional)'} penuh htmlFor="mBukti">
          <input
            id="mBukti"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setBukti(e.target.files?.[0] ?? null)}
          />
          {data?.bukti_nama ? <div className="mt-1 text-[11.5px] text-muted">Sekarang: {data.bukti_nama}</div> : null}
        </Isian>
      </Grid>
      {kategori === 'Ads budget titipan' ? (
        <div className="ins ins-warn !mb-0 mt-3.5">
          <p>Dana titipan klien dicatat sebagai kewajiban, bukan pendapatan ARL. Pilih rekening budget klien.</p>
        </div>
      ) : null}
      <PesanGalat teks={galat} />
    </Modal>
  );
}
