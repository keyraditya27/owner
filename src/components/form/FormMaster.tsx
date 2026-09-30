'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/Modal';
import {
  hapusRekening,
  hapusUtang,
  hapusVendor,
  simpanRekening,
  simpanUtang,
  simpanVendor,
} from '@/app/(aplikasi)/aksi/master';
import { hariIni } from '@/lib/format';
import { JENIS_REKENING, JENIS_VENDOR } from '@/lib/konstanta';
import type { Hasil } from '@/lib/aksi-tipe';
import type { Rekening, UtangVendor, Vendor } from '@/lib/tipe-db';
import { Grid, InputRupiah, Isian, PesanGalat } from './Isian';
import { usePusat } from './PusatForm';

/** Kerangka modal simpan/hapus yang dipakai tiga form di bawah. */
function useFormModal() {
  const { tutup, kabar } = usePusat();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');
  const jalankan = (fn: () => Promise<Hasil>, pesan: string, konfirmasi?: string) =>
    mulai(async () => {
      if (konfirmasi && !confirm(konfirmasi)) return;
      setGalat('');
      const h = await fn();
      if (h.galat) return setGalat(h.galat);
      tutup();
      kabar(pesan);
    });
  return { tutup, proses, galat, jalankan };
}

function Kaki({
  proses,
  tutup,
  onSimpan,
  onHapus,
}: {
  proses: boolean;
  tutup: () => void;
  onSimpan: () => void;
  onHapus?: () => void;
}) {
  const { bolehHapus } = usePusat();
  return (
    <>
      {onHapus && bolehHapus ? (
        <button className="btn-ghost mr-auto !border-merah-garis !text-merah" onClick={onHapus} disabled={proses}>
          Hapus
        </button>
      ) : null}
      <button className="btn-ghost" onClick={tutup}>
        Batal
      </button>
      <button className="btn" onClick={onSimpan} disabled={proses}>
        {proses ? 'Menyimpan…' : 'Simpan'}
      </button>
    </>
  );
}

/* ---------------- rekening ---------------- */
export function FormRekening({ data }: { data?: Rekening }) {
  const { tutup, proses, galat, jalankan } = useFormModal();
  const [f, setF] = useState({
    nama: data?.nama ?? '',
    jenis: data?.jenis ?? 'Bank',
    bank: data?.bank ?? '',
    no_rek: data?.no_rek ?? '',
    saldo_awal: data ? String(data.saldo_awal) : '',
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      judul={data ? 'Ubah Rekening' : 'Tambah Rekening'}
      onTutup={tutup}
      kaki={
        <Kaki
          proses={proses}
          tutup={tutup}
          onSimpan={() => jalankan(() => simpanRekening({ ...f, id: data?.id }), 'Rekening tersimpan')}
          onHapus={
            data
              ? () =>
                  jalankan(
                    () => hapusRekening(data.id),
                    'Rekening dihapus',
                    `Hapus ${data.nama}? Transaksinya tetap ada tapi tidak lagi tertandai rekening ini.`,
                  )
              : undefined
          }
        />
      }
    >
      <Grid>
        <Isian label="Nama rekening" penuh htmlFor="rNama">
          <input id="rNama" value={f.nama} onChange={(e) => set('nama', e.target.value)} placeholder="BCA Operasional" />
        </Isian>
        <Isian label="Jenis" htmlFor="rJenis">
          <select id="rJenis" value={f.jenis} onChange={(e) => set('jenis', e.target.value)}>
            {JENIS_REKENING.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Bank / penyedia" htmlFor="rBank">
          <input id="rBank" value={f.bank} onChange={(e) => set('bank', e.target.value)} placeholder="BCA" />
        </Isian>
        <Isian label="4 digit terakhir" htmlFor="rNo">
          <input id="rNo" inputMode="numeric" value={f.no_rek} onChange={(e) => set('no_rek', e.target.value)} placeholder="4417" maxLength={12} />
        </Isian>
        <Isian label="Saldo awal" htmlFor="rSaldo">
          <InputRupiah id="rSaldo" nilai={f.saldo_awal} ubah={(v) => set('saldo_awal', v)} bolehNegatif />
        </Isian>
        <Isian label="Catatan" penuh htmlFor="rCat">
          <input id="rCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} placeholder="Khusus budget ads klien" />
        </Isian>
      </Grid>
      <PesanGalat teks={galat} />
    </Modal>
  );
}

/* ---------------- vendor ---------------- */
export function FormVendor({ data }: { data?: Vendor }) {
  const { tutup, proses, galat, jalankan } = useFormModal();
  const [f, setF] = useState({
    nama: data?.nama ?? '',
    jenis: data?.jenis ?? 'KOL / affiliate',
    wa: data?.wa ?? '',
    npwp: data?.npwp ? 'ya' : 'tidak',
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      judul={data ? 'Ubah Vendor' : 'Tambah Vendor'}
      onTutup={tutup}
      kaki={
        <Kaki
          proses={proses}
          tutup={tutup}
          onSimpan={() => jalankan(() => simpanVendor({ ...f, id: data?.id }), 'Vendor tersimpan')}
          onHapus={
            data
              ? () => jalankan(() => hapusVendor(data.id), 'Vendor dihapus', `Hapus ${data.nama} beserta tagihannya?`)
              : undefined
          }
        />
      }
    >
      <Grid>
        <Isian label="Nama vendor" penuh htmlFor="vNama">
          <input id="vNama" value={f.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Host live Rina" />
        </Isian>
        <Isian label="Jenis" htmlFor="vJenis">
          <select id="vJenis" value={f.jenis} onChange={(e) => set('jenis', e.target.value)}>
            {JENIS_VENDOR.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Nomor WhatsApp" htmlFor="vWa">
          <input id="vWa" inputMode="tel" value={f.wa} onChange={(e) => set('wa', e.target.value)} placeholder="6281234567890" />
        </Isian>
        <Isian label="Punya NPWP?" penuh htmlFor="vNpwp">
          <select id="vNpwp" value={f.npwp} onChange={(e) => set('npwp', e.target.value)}>
            <option value="ya">Ya — PPh 23 dipotong 2%</option>
            <option value="tidak">Tidak — PPh 23 dipotong 4%</option>
          </select>
        </Isian>
        <Isian label="Catatan" penuh htmlFor="vCat">
          <input id="vCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} placeholder="Rate Rp750rb per sesi live" />
        </Isian>
      </Grid>
      <PesanGalat teks={galat} />
    </Modal>
  );
}

/* ---------------- utang vendor ---------------- */
export function FormUtang({ vendor, data }: { vendor: Vendor; data?: UtangVendor }) {
  const { tutup, proses, galat, jalankan } = useFormModal();
  const [f, setF] = useState({
    keterangan: data?.keterangan ?? '',
    nominal: data ? String(data.nominal) : '',
    dibayar: data ? String(data.dibayar) : '',
    jatuh_tempo: data?.jatuh_tempo ?? hariIni(),
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      judul={`${data ? 'Ubah' : 'Tambah'} Tagihan — ${vendor.nama}`}
      onTutup={tutup}
      kaki={
        <Kaki
          proses={proses}
          tutup={tutup}
          onSimpan={() => jalankan(() => simpanUtang({ ...f, id: data?.id, vendor_id: vendor.id }), 'Tagihan vendor tersimpan')}
          onHapus={data ? () => jalankan(() => hapusUtang(data.id), 'Dihapus', 'Hapus tagihan vendor ini?') : undefined}
        />
      }
    >
      <Grid>
        <Isian label="Keterangan" penuh htmlFor="uKet">
          <input id="uKet" value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} placeholder="Fee live 4 sesi September" />
        </Isian>
        <Isian label="Nilai" htmlFor="uNom">
          <InputRupiah id="uNom" nilai={f.nominal} ubah={(v) => set('nominal', v)} />
        </Isian>
        <Isian label="Sudah dibayar" htmlFor="uByr">
          <InputRupiah id="uByr" nilai={f.dibayar} ubah={(v) => set('dibayar', v)} />
        </Isian>
        <Isian label="Jatuh tempo" htmlFor="uTempo">
          <input id="uTempo" type="date" value={f.jatuh_tempo} onChange={(e) => set('jatuh_tempo', e.target.value)} />
        </Isian>
        <Isian label="Catatan" htmlFor="uCat">
          <input id="uCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} />
        </Isian>
      </Grid>
      <PesanGalat teks={galat} />
    </Modal>
  );
}
