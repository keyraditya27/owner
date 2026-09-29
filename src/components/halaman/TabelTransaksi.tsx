'use client';

/* eslint-disable @next/next/no-img-element -- thumbnail bukti dari signed URL */
import { useMemo, useState } from 'react';
import { rp, tgl } from '@/lib/format';
import { KATEGORI_GAJI, SEMUA_KATEGORI } from '@/lib/konstanta';
import { totalTipe } from '@/lib/hitung';
import type { Transaksi } from '@/lib/tipe-db';
import { usePusat } from '@/components/form/PusatForm';

/** tabelTrx() di prototipe, plus filter kategori/klien/cari untuk halaman Transaksi. */
export default function TabelTransaksi({
  baris,
  urlBukti = {},
  denganFilter = false,
  denganKaki = false,
}: {
  baris: Transaksi[];
  urlBukti?: Record<string, string>;
  denganFilter?: boolean;
  denganKaki?: boolean;
}) {
  const { klien, buka, bolehKelola, penggunaId } = usePusat();
  const [fKat, setFKat] = useState('');
  const [fKlien, setFKlien] = useState('');
  const [fCari, setFCari] = useState('');

  const tampil = useMemo(() => {
    let arr = baris;
    if (fKat) arr = arr.filter((t) => t.kategori === fKat);
    if (fKlien) arr = arr.filter((t) => t.klien_id === fKlien);
    if (fCari) arr = arr.filter((t) => (t.keterangan || '').toLowerCase().includes(fCari.toLowerCase()));
    return arr;
  }, [baris, fKat, fKlien, fCari]);

  const namaKlien = (id: string | null) => klien.find((k) => k.id === id)?.nama;
  const bolehUbah = (t: Transaksi) => bolehKelola || t.dibuat_oleh === penggunaId;

  return (
    <>
      {denganFilter ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-2 [&>*]:!w-auto [&>*]:min-w-[135px] [&>input]:flex-1 [&>select]:!py-[7px] [&>select]:!text-[12.5px]">
          <select value={fKat} onChange={(e) => setFKat(e.target.value)} aria-label="Saring kategori">
            <option value="">Semua kategori</option>
            {SEMUA_KATEGORI.filter((k) => bolehKelola || k !== KATEGORI_GAJI).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select value={fKlien} onChange={(e) => setFKlien(e.target.value)} aria-label="Saring klien">
            <option value="">Semua klien</option>
            {klien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
          <input
            placeholder="Cari keterangan…"
            value={fCari}
            onChange={(e) => setFCari(e.target.value)}
            className="!py-[7px] !text-[12.5px]"
          />
          {fKat || fKlien || fCari ? (
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setFKat('');
                setFKlien('');
                setFCari('');
              }}
            >
              Bersihkan filter
            </button>
          ) : null}
        </div>
      ) : null}

      {!tampil.length ? (
        <div className="empty">
          <b>Tidak ada yang cocok</b>Ubah filter atau pilih periode lain.
        </div>
      ) : (
        <>
          {/* Desktop & tablet: tabel penuh */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Kategori</th>
                  <th>Klien</th>
                  <th>Bukti</th>
                  <th className="!text-right">Nominal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tampil.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap">{tgl(t.tanggal)}</td>
                    <td>
                      <div className="font-semibold">{t.keterangan}</div>
                      <div className="text-[11.5px] text-muted">
                        {t.metode || '-'}
                        {t.sumber === 'ai' ? ' · dicatat AI' : ''}
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${t.tipe === 'masuk' ? 'bg-hijau' : 'bg-navy'}`}>{t.kategori}</span>
                    </td>
                    <td>{namaKlien(t.klien_id) ?? <span className="text-[11.5px] text-muted">Internal</span>}</td>
                    <td>
                      <Bukti t={t} url={t.bukti_url ? urlBukti[t.bukti_url] : undefined} />
                    </td>
                    <td className={`num whitespace-nowrap text-right font-bold ${t.tipe === 'masuk' ? 'text-hijau' : 'text-merah'}`}>
                      {t.tipe === 'masuk' ? '+ ' : '− '}
                      {rp(t.nominal)}
                    </td>
                    <td className="text-right">
                      {bolehUbah(t) ? (
                        <button className="btn-ghost btn-sm" onClick={() => buka({ jenis: 'transaksi', data: t })}>
                          Ubah
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              {denganKaki ? (
                <tfoot>
                  <tr>
                    <td colSpan={5}>Selisih {tampil.length} baris tampil</td>
                    <td className="num text-right">{rp(totalTipe(tampil, 'masuk') - totalTipe(tampil, 'keluar'))}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          {/* HP: daftar kartu, lebih mudah dibaca & disentuh */}
          <ul className="divide-y divide-garis border-y border-garis sm:hidden">
            {tampil.map((t) => (
              <li key={t.id}>
                <button
                  className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                  onClick={() => bolehUbah(t) && buka({ jenis: 'transaksi', data: t })}
                  disabled={!bolehUbah(t)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{t.keterangan}</div>
                    <div className="truncate text-[11.5px] text-muted">
                      {tgl(t.tanggal)} · {t.kategori}
                      {namaKlien(t.klien_id) ? ' · ' + namaKlien(t.klien_id) : ''}
                      {t.bukti_url ? ' · ada bukti' : ''}
                    </div>
                  </div>
                  <div className={`num whitespace-nowrap text-[13.5px] font-bold ${t.tipe === 'masuk' ? 'text-hijau' : 'text-merah'}`}>
                    {t.tipe === 'masuk' ? '+' : '−'}
                    {rp(t.nominal).replace('Rp ', '')}
                  </div>
                </button>
              </li>
            ))}
            {denganKaki ? (
              <li className="flex justify-between bg-[#EDF3FB] px-2 py-2.5 text-[13px] font-bold">
                <span>Selisih {tampil.length} baris</span>
                <span className="num">{rp(totalTipe(tampil, 'masuk') - totalTipe(tampil, 'keluar'))}</span>
              </li>
            ) : null}
          </ul>
        </>
      )}
    </>
  );
}

function Bukti({ t, url }: { t: Transaksi; url?: string }) {
  const { buka } = usePusat();
  if (!t.bukti_url)
    return (
      <div title="Belum ada bukti" className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-[#CFDAE7] text-[10px] font-bold text-[#A9BACD]">
        —
      </div>
    );
  const pdf = /\.pdf$/i.test(t.bukti_url);
  return (
    <button onClick={() => buka({ jenis: 'bukti', transaksi: t, url })} title="Lihat bukti" className="block">
      {url && !pdf ? (
        <img src={url} alt="bukti" className="h-8 w-8 cursor-zoom-in rounded-md border border-garis object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-garis text-[10px] font-bold text-muted">
          {pdf ? 'PDF' : '•'}
        </div>
      )}
    </button>
  );
}
