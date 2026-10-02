'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/Modal';
import { hapusKlien, simpanKlien } from '@/app/(aplikasi)/aksi/klien';
import type { Klien } from '@/lib/tipe-db';
import { Grid, InputRupiah, Isian, PesanGalat } from './Isian';
import { usePusat } from './PusatForm';

export default function FormKlien({ data }: { data?: Klien }) {
  const { tutup, kabar, bolehHapus } = usePusat();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');
  const [f, setF] = useState({
    nama: data?.nama ?? '',
    pic: data?.pic ?? '',
    wa: data?.wa ?? '',
    paket: data?.paket ?? '',
    nilai_bulanan: data ? String(data.nilai_bulanan) : '',
    tanggal_tagih: String(data?.tanggal_tagih ?? 1),
    tempo_hari: String(data?.tempo_hari ?? 7),
    catatan: data?.catatan ?? '',
    npwp: data?.npwp ?? '',
    alamat: data?.alamat ?? '',
    email: data?.email ?? '',
    potong_pph23: data?.potong_pph23 ? 'true' : '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const simpan = () =>
    mulai(async () => {
      setGalat('');
      const h = await simpanKlien({ ...f, id: data?.id });
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar('Klien tersimpan');
    });
  const hapus = () =>
    mulai(async () => {
      if (!data || !confirm(`Hapus ${data.nama}? Semua tagihannya ikut terhapus. Transaksinya tetap ada tanpa nama klien.`))
        return;
      const h = await hapusKlien(data.id);
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar('Klien dihapus');
    });

  return (
    <Modal
      judul={data ? 'Ubah Klien' : 'Tambah Klien'}
      onTutup={tutup}
      kaki={
        <>
          {data && bolehHapus ? (
            <button className="btn-ghost mr-auto !border-merah-garis !text-merah" onClick={hapus} disabled={proses}>
              Hapus klien
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
        <Isian label="Nama klien / brand" penuh htmlFor="kNama">
          <input id="kNama" value={f.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Batik Ayman" />
        </Isian>
        <Isian label="PIC" htmlFor="kPic">
          <input id="kPic" value={f.pic} onChange={(e) => set('pic', e.target.value)} placeholder="Bu Ayu" />
        </Isian>
        <Isian label="Nomor WhatsApp" htmlFor="kWa">
          <input id="kWa" inputMode="tel" value={f.wa} onChange={(e) => set('wa', e.target.value)} placeholder="6281234567890" />
        </Isian>
        <Isian label="Paket / layanan" htmlFor="kPaket">
          <input id="kPaket" value={f.paket} onChange={(e) => set('paket', e.target.value)} placeholder="Shopee Ads + Meta Ads" />
        </Isian>
        <Isian label="Nilai per bulan" htmlFor="kNilai">
          <InputRupiah id="kNilai" nilai={f.nilai_bulanan} ubah={(v) => set('nilai_bulanan', v)} />
        </Isian>
        <Isian label="Tanggal tagih tiap bulan" htmlFor="kTgl">
          <input id="kTgl" type="number" min={1} max={28} value={f.tanggal_tagih} onChange={(e) => set('tanggal_tagih', e.target.value)} />
        </Isian>
        <Isian label="Tempo (hari)" htmlFor="kTempo">
          <input id="kTempo" type="number" min={0} max={90} value={f.tempo_hari} onChange={(e) => set('tempo_hari', e.target.value)} />
        </Isian>
        <Isian label="Alamat (untuk invoice)" penuh htmlFor="kAlamat">
          <input id="kAlamat" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} />
        </Isian>
        <Isian label="NPWP" htmlFor="kNpwp">
          <input id="kNpwp" value={f.npwp} onChange={(e) => set('npwp', e.target.value)} />
        </Isian>
        <Isian label="Email" htmlFor="kEmail">
          <input id="kEmail" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Isian>
        <Isian label="Pajak" penuh>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="!w-auto"
              checked={f.potong_pph23 === 'true'}
              onChange={(e) => set('potong_pph23', e.target.checked ? 'true' : '')}
            />
            Berbentuk PT/CV — memotong PPh 23 2% dari fee
          </label>
        </Isian>
        <Isian label="Catatan" penuh htmlFor="kCat">
          <textarea id="kCat" rows={2} value={f.catatan} onChange={(e) => set('catatan', e.target.value)} />
        </Isian>
      </Grid>
      <PesanGalat teks={galat} />
    </Modal>
  );
}
