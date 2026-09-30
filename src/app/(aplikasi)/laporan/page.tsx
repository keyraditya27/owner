import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import TombolCetak from '@/components/halaman/TombolCetak';
import { GulirX, Insight, Kosong, Pill, Seksi, Sub } from '@/components/ui';
import { totalNilaiBuku } from '@/lib/aset';
import { ambilData, ambilPeriode } from '@/lib/data';
import { bulanLabel, hariIni, rp, tgl } from '@/lib/format';
import { totalKas, totalPiutang, type DataKeuangan } from '@/lib/hitung';
import { arusKas, labaRugi, neraca, perKategori } from '@/lib/laporan';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { periodeLabel, ymPatokan, type Periode } from '@/lib/periode';
import { wajibLogin } from '@/lib/pengguna';

export const metadata = { title: 'Laporan' };

const H = halamanDari('/laporan');

export default async function HalamanLaporan({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode, saya] = await Promise.all([searchParams, ambilData(), ambilPeriode(), wajibLogin()]);
  const aktif = tabAktif(H, tab);
  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        periode={periode}
        transaksi={d.transaksi}
        sub={
          <>
            {periodeLabel(periode)} · Saldo kas <b>{rp(totalKas(d))}</b> · Total aset{' '}
            <b>{rp(totalKas(d) + totalPiutang(d) + totalNilaiBuku(d.aset, ymPatokan(periode)))}</b>
          </>
        }
        aksi={
          <>
            <a href={`/api/laporan.csv?jenis=${aktif}`} className="btn-hero no-underline" download>
              Unduh CSV
            </a>
            <TombolCetak />
          </>
        }
      />
      {saya.peran === 'staf' ? (
        <div className="px-[18px] pt-[22px] lebar:px-9">
          <Insight jenis="warn" judul="Angka tanpa data gaji" className="!mb-0">
            Transaksi gaji hanya terlihat oleh pemilik dan admin, jadi laporan di akun ini tidak lengkap. Pakai laporan dari pemilik
            untuk angka resmi.
          </Insight>
        </div>
      ) : null}
      {aktif === 'neraca' ? <Neraca d={d} p={periode} /> : null}
      {aktif === 'labarugi' ? <LabaRugi d={d} p={periode} /> : null}
      {aktif === 'aruskas' ? <ArusKas d={d} p={periode} /> : null}
      {aktif === 'kategori' ? <PerKategori d={d} p={periode} /> : null}
    </>
  );
}

const Grup = ({ children }: { children: React.ReactNode }) => (
  <tr>
    <td colSpan={2} className="!bg-krem">
      <b>{children}</b>
    </td>
  </tr>
);
const Rinci = ({ label, sub, nilai, warna }: { label: string; sub?: string; nilai: string; warna?: string }) => (
  <tr>
    <td className="!pl-5">
      {label}
      {sub ? <Sub>{sub}</Sub> : null}
    </td>
    <td className={`num text-right ${warna ?? ''}`}>{nilai}</td>
  </tr>
);

function Neraca({ d, p }: { d: DataKeuangan; p: Periode }) {
  const n = neraca(d, p);
  return (
    <Seksi
      ikon="dompet"
      judul={`Neraca per ${tgl(hariIni())}`}
      desk="Posisi harta, kewajiban, dan ekuitas. Penyajian ringkas — bukan hasil pembukuan berpasangan."
    >
      <div className="grid grid-cols-1 gap-[18px] min-[900px]:grid-cols-2 print:grid-cols-2">
        <div>
          <h3 className="mb-2 font-serif text-[15px] font-bold">Aset</h3>
          <table className="tabel">
            <tbody>
              <Grup>Aset Lancar</Grup>
              {n.rekening.map((r) => (
                <Rinci key={r.nama} label={r.nama} nilai={rp(r.saldo)} />
              ))}
              {n.tanpaRekening !== null ? <Rinci label="Belum ditandai rekening" nilai={rp(n.tanpaRekening)} /> : null}
              <Rinci label="Piutang usaha" sub={`${n.jumlahTagihan} tagihan`} nilai={rp(n.piutang)} />
              <Grup>Aset Tetap</Grup>
              <Rinci label="Harga perolehan" nilai={rp(n.perolehan)} />
              <Rinci label="Akumulasi penyusutan" nilai={`(${rp(n.akumulasi)})`} />
              <Rinci label="Nilai buku" nilai={rp(n.nilaiBuku)} />
            </tbody>
            <tfoot>
              <tr>
                <td>Total Aset</td>
                <td className="num text-right">{rp(n.totalAset)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <h3 className="mb-2 font-serif text-[15px] font-bold">Kewajiban &amp; Ekuitas</h3>
          <table className="tabel">
            <tbody>
              <Grup>Kewajiban</Grup>
              <Rinci label="Dana titipan klien" sub="Budget ads belum dibelanjakan" nilai={rp(n.titipan)} />
              <Rinci label="Utang usaha" sub={`${n.jumlahUtang} tagihan vendor`} nilai={rp(n.utangVendor)} />
              <Rinci label="Utang pajak" sub={`${n.jumlahPajak} belum setor`} nilai={rp(n.utangPajak)} />
              <Grup>Ekuitas</Grup>
              <Rinci label="Modal disetor" nilai={rp(n.modal)} />
              <Rinci label="Laba ditahan & berjalan" sub="Selisih penyeimbang" nilai={rp(n.labaDitahan)} />
            </tbody>
            <tfoot>
              <tr>
                <td>Total Kewajiban &amp; Ekuitas</td>
                <td className="num text-right">{rp(n.totalAset)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {n.titipan > 0 ? (
        <Insight jenis="warn" judul={`${rp(n.titipan)} bukan uang ARL`} className="mt-[18px]">
          Dana titipan klien tercatat sebagai kewajiban, bukan pendapatan. Harus habis dibelanjakan iklan atau dikembalikan.
        </Insight>
      ) : null}
      {!n.modal ? (
        <Insight judul="Modal disetor belum diisi" className="!mb-0 mt-[18px]">
          Isi lewat Pajak → Profil perusahaan. Selama kosong, seluruh ekuitas tampil sebagai laba ditahan.
        </Insight>
      ) : null}
    </Seksi>
  );
}

function LabaRugi({ d, p }: { d: DataKeuangan; p: Periode }) {
  const r = labaRugi(d, p);
  const label = periodeLabel(p);
  return (
    <Seksi ikon="bar" warna="hijau" judul={`Laba Rugi ${label}`} desk="Pendapatan jasa dikurangi beban operasional dan penyusutan.">
      <GulirX>
        <table className="tabel">
          <tbody>
            <Grup>Pendapatan</Grup>
            {r.pendapatan.length ? (
              r.pendapatan.map(([k, v]) => <Rinci key={k} label={k} nilai={rp(v)} />)
            ) : (
              <Rinci label="Belum ada" nilai="Rp 0" />
            )}
            <tr>
              <td>
                <b>Total pendapatan</b>
              </td>
              <td className="num text-right">
                <b>{rp(r.totalP)}</b>
              </td>
            </tr>
            <Grup>Beban</Grup>
            {r.beban.map(([k, v]) => (
              <Rinci key={k} label={k} nilai={`(${rp(v)})`} />
            ))}
            <Rinci
              label="Penyusutan aset tetap"
              sub={`${r.bulan} bulan${r.belanjaAset ? ` · pembelian aset ${rp(r.belanjaAset)} tidak dihitung sebagai beban` : ''}`}
              nilai={`(${rp(r.susut)})`}
            />
            <tr>
              <td>
                <b>Total beban</b>
              </td>
              <td className="num text-right">
                <b>({rp(r.totalB)})</b>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Laba / rugi {label.toLowerCase()}</td>
              <td className={`num text-right ${r.laba >= 0 ? 'text-hijau' : 'text-merah'}`}>{rp(r.laba)}</td>
            </tr>
          </tfoot>
        </table>
      </GulirX>
      {r.prive ? (
        <>
          <table className="tabel mt-[18px]">
            <tbody>
              <Grup>Di luar laba rugi</Grup>
              <Rinci label="Prive founder" sub="Pengambilan keuntungan, bukan biaya usaha" nilai={`(${rp(r.prive)})`} />
              <tr>
                <td>
                  <b>Sisa laba setelah prive</b>
                </td>
                <td className={`num text-right font-bold ${r.laba - r.prive >= 0 ? 'text-hijau' : 'text-merah'}`}>{rp(r.laba - r.prive)}</td>
              </tr>
            </tbody>
          </table>
          <Insight jenis="warn" judul={`Prive ${rp(r.prive)} bukan beban perusahaan`} className="mt-4">
            Uang yang diambil founder mengurangi ekuitas, bukan biaya usaha. Kalau dicatat sebagai beban, laba terlihat kecil padahal
            usahanya sehat — dan saat pemeriksaan pajak, beban ini pasti dikoreksi karena tidak berhubungan dengan kegiatan
            mendapatkan penghasilan. Kalau ingin penghasilan founder diakui sebagai beban yang sah, ubah skemanya jadi gaji direksi
            dengan slip dan potongan PPh 21.
          </Insight>
        </>
      ) : null}
      <Insight judul="Kenapa beda dari selisih kas" className="!mb-0 mt-3">
        Laba rugi memakai dasar akrual — penyusutan ikut jadi beban meski tidak ada uang keluar, dana titipan klien dikeluarkan
        dari pendapatan, dan prive founder tidak dihitung sebagai biaya. Selisih kas di Ringkasan memakai dasar kas. Keduanya benar
        untuk tujuan berbeda.
      </Insight>
    </Seksi>
  );
}

function ArusKas({ d, p }: { d: DataKeuangan; p: Periode }) {
  const a = arusKas(d, p);
  return (
    <Seksi
      ikon="bar"
      judul="Arus Kas per Bulan"
      desk={p.mode === 'tahun' ? `Sepanjang ${periodeLabel(p).toLowerCase()}.` : 'Seluruh bulan tercatat. Ganti ke Per Tahun untuk menyaring satu tahun saja.'}
    >
      {a.baris.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>Bulan</th>
                <th className="!text-right">Masuk</th>
                <th className="!text-right">Keluar</th>
                <th className="!text-right">Selisih</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {a.baris.map((b) => (
                <tr key={b.bulan}>
                  <td className="font-semibold">{bulanLabel(b.bulan)}</td>
                  <td className="num text-right text-hijau">{rp(b.masuk)}</td>
                  <td className="num text-right text-merah">{rp(b.keluar)}</td>
                  <td className="num text-right">
                    <b>{rp(b.selisih)}</b>
                  </td>
                  <td>
                    <Pill warna={b.selisih >= 0 ? 'hijau' : 'merah'}>{b.selisih >= 0 ? 'Surplus' : 'Defisit'}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num text-right">{rp(a.masuk)}</td>
                <td className="num text-right">{rp(a.keluar)}</td>
                <td className="num text-right">{rp(a.masuk - a.keluar)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Belum ada data">Catat transaksi dulu.</Kosong>
      )}
    </Seksi>
  );
}

function PerKategori({ d, p }: { d: DataKeuangan; p: Periode }) {
  const { baris, totalKeluar } = perKategori(d, p);
  return (
    <Seksi ikon="dompet" judul="Rincian per Kategori" desk={`${periodeLabel(p)} — dipakai untuk melihat pos mana yang paling menyedot kas.`}>
      {baris.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>Kategori</th>
                <th className="!text-right">Transaksi</th>
                <th className="!text-right">Masuk</th>
                <th className="!text-right">Keluar</th>
                <th className="!text-right">Porsi Beban</th>
              </tr>
            </thead>
            <tbody>
              {baris.map(([k, v]) => (
                <tr key={k}>
                  <td className="font-semibold">{k}</td>
                  <td className="num text-right">{v.n}</td>
                  <td className={`num text-right ${v.masuk ? 'text-hijau' : 'text-muted'}`}>{v.masuk ? rp(v.masuk) : '—'}</td>
                  <td className={`num text-right ${v.keluar ? 'text-merah' : 'text-muted'}`}>{v.keluar ? rp(v.keluar) : '—'}</td>
                  <td className="num text-right">{v.keluar ? ((v.keluar / totalKeluar) * 100).toFixed(1).replace('.', ',') + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Tidak ada transaksi">Pilih periode lain.</Kosong>
      )}
    </Seksi>
  );
}
