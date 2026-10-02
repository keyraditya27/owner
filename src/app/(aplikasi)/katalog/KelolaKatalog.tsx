'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { hapusKelompok, hapusLayanan, simpanKelompok, simpanLayanan } from '@/app/(aplikasi)/aksi/invoice';
import { Grid, InputRupiah, Isian, PesanGalat } from '@/components/form/Isian';
import { usePusat } from '@/components/form/PusatForm';
import { SATUAN } from '@/lib/invoice';
import type { Kelompok, Layanan } from '@/lib/dokumen';
import type { Hasil } from '@/lib/aksi-tipe';

const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const KOSONG = {
  id: '',
  kelompok_id: '',
  nama: '',
  deskripsi: '',
  satuan: 'bulan',
  harga: '',
  porsi_hemat: '0',
  porsi_standar: '1',
  porsi_premium: '1',
  berulang: true,
  aktif: true,
};

/** Daftar harga ARL: kelompok → layanan, dengan tiga porsi bawaan per layanan. */
export default function KelolaKatalog({ kelompok, layanan }: { kelompok: Kelompok[]; layanan: Layanan[] }) {
  const { bolehKelola, bolehHapus, kabar } = usePusat();
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');
  const [grupBaru, setGrupBaru] = useState('');
  const [f, setF] = useState<typeof KOSONG | null>(null);
  // Form ubah ada di bawah daftar (22 layanan) — gulir ke sana supaya klik "Ubah" terlihat ada hasilnya.
  const kotakForm = useRef<HTMLDivElement>(null);
  const idForm = f ? f.id || 'baru:' + f.kelompok_id : '';
  useEffect(() => {
    if (!idForm) return;
    kotakForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    kotakForm.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }, [idForm]);
  const set = (k: keyof typeof KOSONG, v: string | boolean) => setF((x) => (x ? { ...x, [k]: v } : x));

  const jalan = (fn: () => Promise<Hasil>, pesan: string, konfirmasi?: string) =>
    mulai(async () => {
      if (konfirmasi && !confirm(konfirmasi)) return;
      setGalat('');
      const h = await fn();
      if (h.galat) return setGalat(h.galat);
      kabar(pesan);
      router.refresh();
      setF(null);
    });

  const ubah = (l: Layanan) =>
    setF({
      id: l.id,
      kelompok_id: l.kelompok_id,
      nama: l.nama,
      deskripsi: l.deskripsi ?? '',
      satuan: l.satuan,
      harga: String(l.harga),
      porsi_hemat: String(l.porsi_hemat),
      porsi_standar: String(l.porsi_standar),
      porsi_premium: String(l.porsi_premium),
      berulang: l.berulang,
      aktif: l.aktif,
    });

  return (
    <div className="flex flex-col gap-6">
      <PesanGalat teks={galat} />
      {kelompok.length === 0 ? (
        <div className="ins ins-warn !mb-0">
          <p>Katalog masih kosong. Buat kelompok dulu (mis. &quot;Iklan Marketplace&quot;, &quot;Konten&quot;), lalu isi layanannya.</p>
        </div>
      ) : null}

      {kelompok.map((g) => {
        const isi = layanan.filter((l) => l.kelompok_id === g.id);
        return (
          <div key={g.id}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-serif text-[16px] font-bold">{g.nama}</h3>
              <span className="text-[12px] text-muted">{isi.length} layanan</span>
              <div className="ml-auto flex gap-1.5">
                {bolehKelola ? (
                  <button className="btn-ghost btn-sm" onClick={() => setF({ ...KOSONG, kelompok_id: g.id })}>
                    + Layanan
                  </button>
                ) : null}
                {bolehHapus ? (
                  <button
                    className="btn-ghost btn-sm !text-merah"
                    disabled={proses}
                    onClick={() => jalan(() => hapusKelompok(g.id), 'Kelompok dihapus', `Hapus kelompok ${g.nama} beserta layanannya? Invoice lama tidak berubah.`)}
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
            {isi.length ? (
              <div className="overflow-x-auto">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Layanan</th>
                      <th>Satuan</th>
                      <th className="!text-right">Harga</th>
                      <th className="!text-center">Hemat · Standar · Premium</th>
                      <th>Tagih</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {isi.map((l) => (
                      <tr key={l.id} className={l.aktif ? '' : 'opacity-50'}>
                        <td>
                          <b>{l.nama}</b>
                          {l.deskripsi ? <div className="text-[11.5px] text-muted">{l.deskripsi}</div> : null}
                        </td>
                        <td>{l.satuan}</td>
                        <td className="num text-right">{rp(l.harga)}</td>
                        <td className="num text-center">
                          {l.porsi_hemat} · {l.porsi_standar} · {l.porsi_premium}
                        </td>
                        <td>{l.berulang ? 'tiap bulan' : 'sekali'}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {bolehKelola ? (
                              <button className="btn-ghost btn-sm" onClick={() => ubah(l)}>
                                Ubah
                              </button>
                            ) : null}
                            {bolehHapus ? (
                              <button
                                className="btn-ghost btn-sm !text-merah"
                                disabled={proses}
                                onClick={() => jalan(() => hapusLayanan(l.id), 'Layanan dihapus', `Hapus ${l.nama}? Invoice lama tidak berubah.`)}
                              >
                                Hapus
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Belum ada layanan.</p>
            )}
          </div>
        );
      })}

      {f ? (
        <div ref={kotakForm} className="scroll-mt-24 rounded-xl border-2 border-biru bg-krem p-4">
          <h3 className="mb-3 font-serif text-[16px] font-bold">{f.id ? 'Ubah layanan' : 'Layanan baru'}</h3>
          <Grid>
            <Isian label="Kelompok">
              <select value={f.kelompok_id} onChange={(e) => set('kelompok_id', e.target.value)}>
                {kelompok.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </select>
            </Isian>
            <Isian label="Nama layanan">
              <input value={f.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Kelola iklan Shopee" />
            </Isian>
            <Isian label="Deskripsi (tampil di invoice)" penuh>
              <input value={f.deskripsi} onChange={(e) => set('deskripsi', e.target.value)} />
            </Isian>
            <Isian label="Harga per satuan">
              <InputRupiah nilai={f.harga} ubah={(v) => set('harga', v)} />
            </Isian>
            <Isian label="Satuan">
              <select value={f.satuan} onChange={(e) => set('satuan', e.target.value)}>
                {SATUAN.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Isian>
            <Isian label="Porsi Hemat · Standar · Premium (jumlah bawaan)" penuh>
              <div className="grid grid-cols-3 gap-2">
                {(['porsi_hemat', 'porsi_standar', 'porsi_premium'] as const).map((k) => (
                  <input key={k} inputMode="numeric" value={f[k]} onChange={(e) => set(k, e.target.value.replace(/\D/g, ''))} />
                ))}
              </div>
            </Isian>
            <Isian label="Cara tagih" penuh>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={f.berulang} onChange={(e) => set('berulang', e.target.checked)} className="!w-auto" />
                Tiap bulan — dikalikan durasi kontrak (iklan, konten, live). Hapus centang untuk sekali bayar (setup, audit).
              </label>
            </Isian>
          </Grid>
          <div className="mt-4 flex gap-2">
            <button
              className="btn"
              disabled={proses}
              onClick={() => jalan(() => simpanLayanan(f), 'Layanan tersimpan')}
            >
              {proses ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button className="btn-ghost" onClick={() => setF(null)}>
              Batal
            </button>
          </div>
        </div>
      ) : null}

      {bolehKelola ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="label">Kelompok baru</label>
            <input value={grupBaru} onChange={(e) => setGrupBaru(e.target.value)} placeholder="Iklan Marketplace" />
          </div>
          <button
            className="btn"
            disabled={proses || !grupBaru.trim()}
            onClick={() =>
              jalan(async () => {
                const h = await simpanKelompok({ nama: grupBaru, urutan: kelompok.length });
                if (!h.galat) setGrupBaru('');
                return h;
              }, 'Kelompok ditambahkan')
            }
          >
            Tambah kelompok
          </button>
        </div>
      ) : null}
    </div>
  );
}
