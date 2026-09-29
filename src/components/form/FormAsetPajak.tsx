'use client';

import { useState, useTransition } from 'react';
import Modal from '@/components/Modal';
import { hapusAset, hapusPajak, simpanAset, simpanPajak, simpanPerusahaan } from '@/app/(aplikasi)/aksi/aset-pajak';
import { KATEGORI_ASET, KELOMPOK, KONDISI, STATUS_ASET } from '@/lib/aset';
import type { Hasil } from '@/lib/aksi-tipe';
import { bulanIni, geserBulan, hariIni } from '@/lib/format';
import { JENIS_PAJAK } from '@/lib/konstanta';
import type { Aset, Pajak, Perusahaan } from '@/lib/tipe-db';
import { Grid, InputRupiah, Isian, PesanGalat } from './Isian';
import { usePusat } from './PusatForm';

function useSimpan() {
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

function Kaki({ proses, tutup, simpan, hapus }: { proses: boolean; tutup: () => void; simpan: () => void; hapus?: () => void }) {
  return (
    <>
      {hapus ? (
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
  );
}

/* ---------------------------------------------------------------- ASET — formAset() di prototipe */
export function FormAset({ data, jenis }: { data?: Aset; jenis?: 'tetap' | 'inventaris' }) {
  const { tutup, proses, galat, jalankan } = useSimpan();
  const [f, setF] = useState({
    jenis: data?.jenis ?? jenis ?? 'tetap',
    kode: data?.kode ?? '',
    nama: data?.nama ?? '',
    kategori: data?.kategori ?? 'Komputer & laptop',
    tgl_perolehan: data?.tgl_perolehan ?? hariIni(),
    harga_perolehan: data ? String(data.harga_perolehan) : '',
    nilai_residu: data ? String(data.nilai_residu) : '',
    kelompok: data?.kelompok ?? '1',
    metode: data?.metode ?? 'garis_lurus',
    qty: String(data?.qty ?? 1),
    lokasi: data?.lokasi ?? 'Kantor Bandung',
    penanggung_jawab: data?.penanggung_jawab ?? '',
    kondisi: data?.kondisi ?? 'Baik',
    status: data?.status ?? 'Aktif',
    tgl_lepas: data?.tgl_lepas ?? '',
    nilai_jual: data?.nilai_jual ? String(data.nilai_jual) : '',
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const inv = f.jenis === 'inventaris';
  const bangunan = f.kelompok.startsWith('b');

  return (
    <Modal
      judul={`${data ? 'Ubah' : 'Tambah'} ${inv ? 'Inventaris' : 'Aset Tetap'}`}
      onTutup={tutup}
      kaki={
        <Kaki
          proses={proses}
          tutup={tutup}
          simpan={() => jalankan(() => simpanAset({ ...f, id: data?.id }), 'Aset tersimpan')}
          hapus={data ? () => jalankan(() => hapusAset(data.id), 'Aset dihapus', `Hapus ${data.nama}? Lebih baik ubah status jadi Dilepas/Hilang supaya jejaknya tetap ada.`) : undefined}
        />
      }
    >
      <Grid>
        <Isian label="Jenis pencatatan" htmlFor="aJenis">
          <select id="aJenis" value={f.jenis} onChange={(e) => set('jenis', e.target.value)}>
            <option value="tetap">Aset tetap (disusutkan)</option>
            <option value="inventaris">Inventaris (dibebankan langsung)</option>
          </select>
        </Isian>
        <Isian label="Kode aset" htmlFor="aKode">
          <input id="aKode" value={f.kode} onChange={(e) => set('kode', e.target.value)} placeholder={inv ? 'ARL-INV-002' : 'ARL-LT-004'} />
        </Isian>
        <Isian label="Nama barang" penuh htmlFor="aNama">
          <input id="aNama" value={f.nama} onChange={(e) => set('nama', e.target.value)} placeholder="MacBook Pro 14 M3" />
        </Isian>
        <Isian label="Kategori" htmlFor="aKat">
          <select id="aKat" value={f.kategori} onChange={(e) => set('kategori', e.target.value)}>
            {KATEGORI_ASET.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Tanggal perolehan" htmlFor="aTgl">
          <input id="aTgl" type="date" value={f.tgl_perolehan} onChange={(e) => set('tgl_perolehan', e.target.value)} />
        </Isian>
        <Isian label="Harga perolehan" htmlFor="aHarga">
          <InputRupiah id="aHarga" nilai={f.harga_perolehan} ubah={(v) => set('harga_perolehan', v)} />
        </Isian>
        {inv ? (
          <Isian label="Jumlah unit" htmlFor="aQty">
            <input id="aQty" type="number" min={1} className="num" value={f.qty} onChange={(e) => set('qty', e.target.value)} />
          </Isian>
        ) : (
          <>
            <Isian label="Nilai residu" htmlFor="aResidu">
              <InputRupiah id="aResidu" nilai={f.nilai_residu} ubah={(v) => set('nilai_residu', v)} />
            </Isian>
            <Isian label="Kelompok fiskal" htmlFor="aKel">
              <select id="aKel" value={f.kelompok} onChange={(e) => set('kelompok', e.target.value)}>
                {Object.entries(KELOMPOK).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Isian>
            <Isian label="Metode penyusutan" htmlFor="aMetode">
              <select id="aMetode" value={bangunan ? 'garis_lurus' : f.metode} disabled={bangunan} onChange={(e) => set('metode', e.target.value)}>
                <option value="garis_lurus">Garis lurus</option>
                <option value="saldo_menurun">Saldo menurun</option>
              </select>
            </Isian>
          </>
        )}
        <Isian label="Lokasi" htmlFor="aLok">
          <input id="aLok" value={f.lokasi} onChange={(e) => set('lokasi', e.target.value)} placeholder="Kantor Bandung" />
        </Isian>
        <Isian label="Penanggung jawab" htmlFor="aPJ">
          <input id="aPJ" value={f.penanggung_jawab} onChange={(e) => set('penanggung_jawab', e.target.value)} placeholder="Tasya" />
        </Isian>
        <Isian label="Kondisi" htmlFor="aKondisi">
          <select id="aKondisi" value={f.kondisi} onChange={(e) => set('kondisi', e.target.value)}>
            {KONDISI.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Status" htmlFor="aStatus">
          <select id="aStatus" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_ASET.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Isian>
        {f.status !== 'Aktif' ? (
          <>
            <Isian label={f.status === 'Dilepas' ? 'Tanggal dilepas' : 'Tanggal hilang'} htmlFor="aLepas">
              <input id="aLepas" type="date" value={f.tgl_lepas} onChange={(e) => set('tgl_lepas', e.target.value)} />
            </Isian>
            {f.status === 'Dilepas' ? (
              <Isian label="Harga jual" htmlFor="aJual">
                <InputRupiah id="aJual" nilai={f.nilai_jual} ubah={(v) => set('nilai_jual', v)} />
              </Isian>
            ) : null}
          </>
        ) : null}
        <Isian label="Catatan" penuh htmlFor="aCat">
          <input id="aCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} placeholder="Garansi sampai Mei 2028, serial C02XY" />
        </Isian>
      </Grid>
      {!inv ? (
        <div className="ins !mb-0 mt-4">
          <h4>Cara hitungnya</h4>
          <p>
            Kelompok fiskal menentukan masa manfaat menurut Pasal 11 UU PPh. Garis lurus membagi rata (harga − residu) selama
            masa manfaat; saldo menurun membebankan lebih besar di awal. Bangunan hanya boleh garis lurus. Penyusutan mulai
            dihitung dari bulan perolehan.
          </p>
        </div>
      ) : null}
      <PesanGalat teks={galat} />
    </Modal>
  );
}

/* ---------------------------------------------------------------- PAJAK — formPajak() di prototipe */
export function FormPajak({ data }: { data?: Pajak }) {
  const { tutup, proses, galat, jalankan } = useSimpan();
  const [f, setF] = useState({
    periode: data?.periode ?? geserBulan(bulanIni(), -1),
    jenis: data?.jenis ?? 'PPh 23',
    dpp: data ? String(data.dpp) : '',
    nominal: data ? String(data.nominal) : '',
    tgl_setor: data?.tgl_setor ?? '',
    tgl_lapor: data?.tgl_lapor ?? '',
    ntpn: data?.ntpn ?? '',
    catatan: data?.catatan ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      judul={data ? 'Ubah Kewajiban Pajak' : 'Catat Kewajiban Pajak'}
      onTutup={tutup}
      kaki={
        <Kaki
          proses={proses}
          tutup={tutup}
          simpan={() => jalankan(() => simpanPajak({ ...f, id: data?.id }), 'Kewajiban pajak tersimpan')}
          hapus={data ? () => jalankan(() => hapusPajak(data.id), 'Dihapus', 'Hapus kewajiban pajak ini?') : undefined}
        />
      }
    >
      <Grid>
        <Isian label="Masa pajak" htmlFor="pPer">
          <input id="pPer" type="month" value={f.periode} onChange={(e) => set('periode', e.target.value)} />
        </Isian>
        <Isian label="Jenis pajak" htmlFor="pJenis">
          <select id="pJenis" value={f.jenis} onChange={(e) => set('jenis', e.target.value)}>
            {Object.keys(JENIS_PAJAK).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Isian>
        <Isian label="Dasar pengenaan" htmlFor="pDpp">
          <InputRupiah id="pDpp" nilai={f.dpp} ubah={(v) => set('dpp', v)} />
        </Isian>
        <Isian label="Pajak terutang" htmlFor="pNom">
          <InputRupiah id="pNom" nilai={f.nominal} ubah={(v) => set('nominal', v)} />
        </Isian>
        <Isian label="Tanggal setor" htmlFor="pSetor">
          <input id="pSetor" type="date" value={f.tgl_setor} onChange={(e) => set('tgl_setor', e.target.value)} />
        </Isian>
        <Isian label="Tanggal lapor" htmlFor="pLapor">
          <input id="pLapor" type="date" value={f.tgl_lapor} onChange={(e) => set('tgl_lapor', e.target.value)} />
        </Isian>
        <Isian label="NTPN" htmlFor="pNtpn">
          <input id="pNtpn" value={f.ntpn} onChange={(e) => set('ntpn', e.target.value)} placeholder="0812xxxx" />
        </Isian>
        <Isian label="Catatan" htmlFor="pCat">
          <input id="pCat" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} />
        </Isian>
      </Grid>
      <PesanGalat teks={galat} />
    </Modal>
  );
}

/* ---------------------------------------------------------------- PERUSAHAAN — formPerusahaan() di prototipe */
export function FormPerusahaan({ data }: { data: Perusahaan }) {
  const { tutup, proses, galat, jalankan } = useSimpan();
  const [f, setF] = useState({
    nama: data.nama,
    npwp: data.npwp ?? '',
    pkp: data.pkp ? 'ya' : 'tidak',
    modal_disetor: String(data.modal_disetor || ''),
    batas_kapitalisasi: String(data.batas_kapitalisasi || 5000000),
    alamat: data.alamat ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      judul="Profil Perusahaan"
      onTutup={tutup}
      kaki={<Kaki proses={proses} tutup={tutup} simpan={() => jalankan(() => simpanPerusahaan({ ...f, id: data.id }), 'Profil perusahaan tersimpan')} />}
    >
      <Grid>
        <Isian label="Nama badan usaha" penuh htmlFor="cNama">
          <input id="cNama" value={f.nama} onChange={(e) => set('nama', e.target.value)} />
        </Isian>
        <Isian label="NPWP" htmlFor="cNpwp">
          <input id="cNpwp" value={f.npwp} onChange={(e) => set('npwp', e.target.value)} placeholder="00.000.000.0-000.000" />
        </Isian>
        <Isian label="Status PKP" htmlFor="cPkp">
          <select id="cPkp" value={f.pkp} onChange={(e) => set('pkp', e.target.value)}>
            <option value="ya">PKP — memungut PPN</option>
            <option value="tidak">Non-PKP</option>
          </select>
        </Isian>
        <Isian label="Modal disetor" htmlFor="cModal">
          <InputRupiah id="cModal" nilai={f.modal_disetor} ubah={(v) => set('modal_disetor', v)} />
        </Isian>
        <Isian label="Batas kapitalisasi aset" htmlFor="cBatas">
          <InputRupiah id="cBatas" nilai={f.batas_kapitalisasi} ubah={(v) => set('batas_kapitalisasi', v)} />
        </Isian>
        <Isian label="Alamat" penuh htmlFor="cAlamat">
          <input id="cAlamat" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} placeholder="Bandung, Jawa Barat" />
        </Isian>
      </Grid>
      <div className="ins !mb-0 mt-4">
        <h4>Batas kapitalisasi</h4>
        <p>
          Pembelian barang di atas batas ini dicatat sebagai aset tetap lalu disusutkan bertahun-tahun. Di bawah batas, langsung
          dibebankan tapi tetap masuk daftar inventaris supaya keberadaannya terlacak. Rp5 juta adalah angka yang lazim dipakai
          perusahaan jasa seukuran ARL — pilih satu angka lalu konsisten.
        </p>
      </div>
      <PesanGalat teks={galat} />
    </Modal>
  );
}
