'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/Modal';
import { hapusTagihan, simpanTagihan } from '@/app/(aplikasi)/aksi/klien';
import { bulanIni, bulanLabel, tambahHari } from '@/lib/format';
import type { Klien, Tagihan } from '@/lib/tipe-db';
import { Grid, InputRupiah, Isian, PesanGalat } from './Isian';
import { usePusat } from './PusatForm';

export default function FormTagihan({ klien, data }: { klien: Klien; data?: Tagihan }) {
  const { tutup, kabar } = usePusat();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');

  // Bawaan sama dengan prototipe: tanggal tagih klien di bulan ini, jatuh tempo + tempo hari.
  const tglTagih = `${bulanIni()}-${String(Math.min(28, klien.tanggal_tagih || 1)).padStart(2, '0')}`;
  const [f, setF] = useState({
    periode: data?.periode ?? bulanLabel(bulanIni()),
    nominal: String(data?.nominal ?? (klien.nilai_bulanan || '')),
    dibayar: String(data?.dibayar ?? ''),
    pph23_dipotong: String(data?.pph23_dipotong || ''),
    tgl_invoice: data?.tgl_invoice ?? tglTagih,
    jatuh_tempo: data?.jatuh_tempo ?? tambahHari(tglTagih, klien.tempo_hari ?? 7),
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const simpan = () =>
    mulai(async () => {
      setGalat('');
      const h = await simpanTagihan({ ...f, id: data?.id, klien_id: klien.id });
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar('Tagihan tersimpan');
    });
  const hapus = () =>
    mulai(async () => {
      if (!data || !confirm('Hapus tagihan ini?')) return;
      const h = await hapusTagihan(data.id);
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar('Tagihan dihapus');
    });

  return (
    <Modal
      judul={`${data ? 'Ubah Tagihan' : 'Tagihan Baru'} — ${klien.nama}`}
      onTutup={tutup}
      kaki={
        <>
          {data ? (
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
        <Isian label="Periode" penuh htmlFor="iPeriode">
          <input id="iPeriode" value={f.periode} onChange={(e) => set('periode', e.target.value)} placeholder="September 2026" />
        </Isian>
        <Isian label="Nilai tagihan" htmlFor="iNominal">
          <InputRupiah id="iNominal" nilai={f.nominal} ubah={(v) => set('nominal', v)} />
        </Isian>
        <Isian label="Sudah dibayar" htmlFor="iDibayar">
          <InputRupiah id="iDibayar" nilai={f.dibayar} ubah={(v) => set('dibayar', v)} />
        </Isian>
        <Isian label="Tanggal invoice" htmlFor="iTagih">
          <input id="iTagih" type="date" value={f.tgl_invoice} onChange={(e) => set('tgl_invoice', e.target.value)} />
        </Isian>
        <Isian label="Jatuh tempo" htmlFor="iTempo">
          <input id="iTempo" type="date" value={f.jatuh_tempo} onChange={(e) => set('jatuh_tempo', e.target.value)} />
        </Isian>
        <Isian label="PPh 23 dipotong klien" htmlFor="iPph">
          <InputRupiah id="iPph" nilai={f.pph23_dipotong} ubah={(v) => set('pph23_dipotong', v)} />
        </Isian>
        <Isian label="Catatan" htmlFor="iCat">
          <input id="iCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} placeholder="Termasuk budget ads Rp3jt" />
        </Isian>
      </Grid>
      <div className="ins !mb-0 mt-3.5">
        <p>
          Klien PT biasanya memotong PPh 23 sebesar 2%. Isi potongannya di sini — itu kredit pajak ARL, bukan piutang
          macet. Kejar bukti potongnya sebelum bulan berikutnya.
        </p>
      </div>
      <PesanGalat teks={galat} />
    </Modal>
  );
}
