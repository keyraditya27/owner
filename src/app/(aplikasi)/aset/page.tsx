import BarPeriode from '@/components/halaman/BarPeriode';
import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import { TombolForm } from '@/components/form/PusatForm';
import { Blok, GulirX, Insight, Kosong, Kpi, Kpis, Pill, Seksi, Sub } from '@/components/ui';
import {
  akumulasi,
  asetTetap,
  bulanJalan,
  KELOMPOK,
  labelKelompokPendek,
  nilaiBuku,
  susutBulanan,
  susutBulanIni,
  totalAkumulasi,
  totalNilaiBuku,
  totalPerolehan,
} from '@/lib/aset';
import { ambilData, ambilPeriode } from '@/lib/data';
import { rp, rpS, tgl } from '@/lib/format';
import type { DataKeuangan, WarnaPill } from '@/lib/hitung';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { opsiBulan, periodeLabel, ymPatokan, type Periode } from '@/lib/periode';
import type { Aset } from '@/lib/tipe-db';

export const metadata = { title: 'Aset & Inventaris' };

const H = halamanDari('/aset');

const warnaKondisi = (a: Aset): WarnaPill =>
  a.status !== 'Aktif' ? 'abu' : a.kondisi === 'Baik' ? 'hijau' : a.kondisi === 'Rusak' ? 'merah' : 'amber';

export default async function HalamanAset({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode] = await Promise.all([searchParams, ambilData(), ambilPeriode()]);
  const aktif = tabAktif(H, tab);
  const ym = ymPatokan(periode);
  const tetap = d.aset.filter((a) => a.jenis !== 'inventaris');
  const inv = d.aset.filter((a) => a.jenis === 'inventaris');
  const perhatian = d.aset.filter((a) => a.kondisi !== 'Baik' && a.status === 'Aktif');

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        sub={
          <>
            {tetap.length} aset tetap · Perolehan <b>{rp(totalPerolehan(d.aset))}</b> · Nilai buku <b>{rp(totalNilaiBuku(d.aset, ym))}</b> · Susut{' '}
            <b>{rp(susutBulanIni(d.aset))}</b>/bulan
          </>
        }
        aksi={
          <>
            <TombolForm buka={{ jenis: 'aset', jenisAset: 'tetap' }} varian="btn-hero" hanyaPengelola>
              Tambah aset tetap
            </TombolForm>
            <TombolForm buka={{ jenis: 'aset', jenisAset: 'inventaris' }} varian="btn-hero" hanyaPengelola>
              Tambah inventaris
            </TombolForm>
            <a href="/api/aset.csv" className="btn-hero no-underline" download>
              Unduh daftar
            </a>
          </>
        }
        lencana={{ tetap: tetap.length, inventaris: inv.length, perhatian: perhatian.length || '' }}
      />
      {aktif === 'tetap' ? <TabTetap d={d} ym={ym} /> : null}
      {aktif === 'inventaris' ? <TabInventaris arr={inv} /> : null}
      {aktif === 'penyusutan' ? <TabSusut d={d} p={periode} /> : null}
      {aktif === 'perhatian' ? <TabPerhatian d={d} ym={ym} /> : null}
    </>
  );
}

const TombolUbah = ({ a }: { a: Aset }) => (
  <TombolForm buka={{ jenis: 'aset', data: a }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
    Ubah
  </TombolForm>
);

function TabTetap({ d, ym }: { d: DataKeuangan; ym: string }) {
  const arr = d.aset.filter((a) => a.jenis !== 'inventaris').sort((a, b) => b.tgl_perolehan.localeCompare(a.tgl_perolehan));
  const perolehan = totalPerolehan(d.aset);
  const akum = totalAkumulasi(d.aset, ym);
  const batas = d.perusahaan?.batas_kapitalisasi ?? 5_000_000;
  return (
    <>
      <Blok>
        <Kpis>
          <Kpi label="Harga Perolehan" nilai={rp(perolehan)} catatan={`${asetTetap(d.aset).length} aset aktif`} />
          <Kpi
            label="Akumulasi Penyusutan"
            nilai={rp(akum)}
            kondisi="warn"
            catatan={perolehan ? `${((akum / perolehan) * 100).toFixed(1).replace('.', ',')}% tersusut` : '—'}
          />
          <Kpi label="Nilai Buku" nilai={rp(totalNilaiBuku(d.aset, ym))} kondisi="hl" catatan="Masuk neraca" />
          <Kpi label="Beban / Bulan" nilai={rp(susutBulanIni(d.aset))} catatan="Pengurang pajak yang sah" />
        </Kpis>
      </Blok>
      <Seksi ikon="dok" judul="Daftar Aset Tetap" desk={`Di atas batas kapitalisasi ${rpS(batas)} — dikapitalisasi lalu disusutkan.`}>
        {arr.length ? (
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kode / Nama</th>
                  <th>Kelompok</th>
                  <th>Perolehan</th>
                  <th className="!text-right">Harga</th>
                  <th className="!text-right">Nilai Buku</th>
                  <th>Pemegang</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {arr.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-semibold">{a.nama}</div>
                      <Sub>
                        {a.kode || '—'} · {a.kategori}
                      </Sub>
                    </td>
                    <td>
                      <Pill warna="navy">{labelKelompokPendek(a.kelompok)}</Pill>
                    </td>
                    <td className="num whitespace-nowrap">{tgl(a.tgl_perolehan)}</td>
                    <td className="num text-right">{rp(a.harga_perolehan)}</td>
                    <td className="num text-right">
                      <b>{rp(nilaiBuku(a, ym))}</b>
                    </td>
                    <td>
                      {a.penanggung_jawab || '—'}
                      <Sub>{a.lokasi}</Sub>
                    </td>
                    <td>
                      <Pill warna={warnaKondisi(a)}>{a.status !== 'Aktif' ? a.status : a.kondisi}</Pill>
                    </td>
                    <td className="text-right">
                      <TombolUbah a={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="num text-right">{rp(arr.reduce((s, a) => s + a.harga_perolehan, 0))}</td>
                  <td className="num text-right">{rp(arr.reduce((s, a) => s + nilaiBuku(a, ym), 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </GulirX>
        ) : (
          <Kosong judul="Belum ada aset tetap">Catat laptop, kamera, atau perlengkapan di atas {rpS(batas)}.</Kosong>
        )}
      </Seksi>
    </>
  );
}

function TabInventaris({ arr }: { arr: Aset[] }) {
  return (
    <Seksi ikon="dompet" warna="amber" judul="Inventaris Non-Kapitalisasi" desk="Dibebankan saat beli, tetap dilacak siapa pemegangnya.">
      {arr.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th className="!text-right">Jumlah</th>
                <th className="!text-right">Nilai Beli</th>
                <th>Pemegang</th>
                <th>Lokasi</th>
                <th>Kondisi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {arr.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-semibold">{a.nama}</div>
                    <Sub>
                      {a.kode || '—'} · {tgl(a.tgl_perolehan)}
                    </Sub>
                  </td>
                  <td>{a.kategori}</td>
                  <td className="num text-right">{a.qty || 1}</td>
                  <td className="num text-right">{rp(a.harga_perolehan)}</td>
                  <td>{a.penanggung_jawab || '—'}</td>
                  <td>{a.lokasi || '—'}</td>
                  <td>
                    <Pill warna={warnaKondisi(a)}>{a.status !== 'Aktif' ? a.status : a.kondisi}</Pill>
                  </td>
                  <td className="text-right">
                    <TombolUbah a={a} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total nilai inventaris</td>
                <td className="num text-right">{rp(arr.reduce((s, a) => s + a.harga_perolehan, 0))}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Belum ada inventaris">Catat headset, kursi, atau barang kecil yang tetap perlu dilacak pemegangnya.</Kosong>
      )}
      {arr.some((a) => !a.penanggung_jawab) ? (
        <Insight jenis="warn" judul={`${arr.filter((a) => !a.penanggung_jawab).length} barang belum ada penanggung jawabnya`} className="!mb-0 mt-4">
          Kolom ini yang paling sering disesali kalau kosong: saat ada yang resign, tidak ada yang tahu barang mana yang harus
          dikembalikan.
        </Insight>
      ) : null}
    </Seksi>
  );
}

function TabSusut({ d, p }: { d: DataKeuangan; p: Periode }) {
  const ym = ymPatokan(p);
  const arr = asetTetap(d.aset);
  const setahun = arr.reduce((s, a) => s + susutBulanan(a) * 12, 0);
  const label = p.mode === 'tahun' ? 'akhir ' + periodeLabel(p).toLowerCase() : periodeLabel(p).toLowerCase();
  return (
    <>
      <BarPeriode periode={p} opsiBulan={opsiBulan(d.transaksi.map((t) => t.tanggal))} />
      <Seksi ikon="bar" judul="Jadwal Penyusutan" desk={`Nilai per ${label}. Beban ini mengurangi laba kena pajak.`}>
        {arr.length ? (
          <>
            <GulirX>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Aset</th>
                    <th>Metode</th>
                    <th className="!text-right">Dasar</th>
                    <th className="!text-right">Susut/bln</th>
                    <th className="!text-right">Akumulasi</th>
                    <th className="!text-right">Nilai Buku</th>
                    <th className="!text-right">Sisa Umur</th>
                  </tr>
                </thead>
                <tbody>
                  {arr.map((a) => {
                    const K = KELOMPOK[a.kelompok];
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="font-semibold">{a.nama}</div>
                          <Sub>{K?.label}</Sub>
                        </td>
                        <td>{a.metode === 'saldo_menurun' ? 'Saldo menurun' : 'Garis lurus'}</td>
                        <td className="num text-right">{rp(a.harga_perolehan - a.nilai_residu)}</td>
                        <td className="num text-right">{rp(susutBulanan(a))}</td>
                        <td className="num text-right">{rp(akumulasi(a, ym))}</td>
                        <td className="num text-right">
                          <b>{rp(nilaiBuku(a, ym))}</b>
                        </td>
                        <td className="num text-right">{Math.max(0, (K?.th || 4) * 12 - bulanJalan(a, ym))} bln</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total beban penyusutan</td>
                    <td className="num text-right">{rp(arr.reduce((s, a) => s + susutBulanan(a), 0))}</td>
                    <td className="num text-right">{rp(totalAkumulasi(d.aset, ym))}</td>
                    <td className="num text-right">{rp(totalNilaiBuku(d.aset, ym))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </GulirX>
            <Insight judul={`Setahun penuh: ${rp(setahun)}`} className="!mb-0 mt-4">
              Angka ini mengurangi laba kena pajak. Dengan tarif efektif 11% (fasilitas Pasal 31E), penyusutan ini menghemat sekitar{' '}
              {rp(Math.round(setahun * 0.11))} pajak setahun — asalkan asetnya benar-benar tercatat.
            </Insight>
          </>
        ) : (
          <Kosong judul="Belum ada aset yang disusutkan">Tambahkan aset tetap dulu.</Kosong>
        )}
      </Seksi>
    </>
  );
}

function TabPerhatian({ d, ym }: { d: DataKeuangan; ym: string }) {
  const arr = d.aset.filter((a) => a.kondisi !== 'Baik' || a.status !== 'Aktif');
  const habis = asetTetap(d.aset).filter((a) => nilaiBuku(a, ym) <= (a.nilai_residu || 0) + 1);
  return (
    <>
      <Seksi ikon="lonceng" warna="merah" judul="Kondisi Bermasalah" desk="Aset rusak, perlu perbaikan, atau sudah tidak aktif.">
        {arr.length ? (
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Aset</th>
                  <th>Pemegang</th>
                  <th>Lokasi</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {arr.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-semibold">{a.nama}</div>
                      <Sub>{[a.kode, a.catatan].filter(Boolean).join(' · ')}</Sub>
                    </td>
                    <td>{a.penanggung_jawab || '—'}</td>
                    <td>{a.lokasi || '—'}</td>
                    <td>
                      <Pill warna={a.kondisi === 'Rusak' ? 'merah' : a.kondisi === 'Baik' ? 'hijau' : 'amber'}>{a.kondisi}</Pill>
                    </td>
                    <td>
                      <Pill warna={a.status === 'Aktif' ? 'biru' : 'abu'}>{a.status}</Pill>
                    </td>
                    <td className="text-right">
                      <TombolUbah a={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GulirX>
        ) : (
          <Kosong judul="Semua aset kondisi baik">Tidak ada yang perlu tindakan.</Kosong>
        )}
      </Seksi>
      {habis.length ? (
        <Seksi ikon="dok" warna="amber" judul="Sudah Habis Disusutkan" desk={`${habis.length} aset bernilai buku nol tapi kemungkinan masih dipakai.`}>
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Aset</th>
                  <th>Perolehan</th>
                  <th className="!text-right">Harga Dulu</th>
                  <th>Pemegang</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {habis.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.nama}</td>
                    <td className="num">{tgl(a.tgl_perolehan)}</td>
                    <td className="num text-right">{rp(a.harga_perolehan)}</td>
                    <td>{a.penanggung_jawab || '—'}</td>
                    <td className="text-right">
                      <TombolUbah a={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GulirX>
          <Insight judul="Tiga pilihan" className="!mb-0 mt-4">
            Teruskan pakai (tetap tercatat nilai nol), jual (selisih harga jual jadi laba pelepasan aset), atau hapus buku. Yang
            penting jangan dibiarkan menggantung tanpa keputusan sampai stock opname.
          </Insight>
        </Seksi>
      ) : null}
    </>
  );
}
