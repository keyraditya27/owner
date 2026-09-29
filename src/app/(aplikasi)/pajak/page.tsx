import BarPeriode from '@/components/halaman/BarPeriode';
import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import { Kalkulator, TombolBuatPajak } from '@/components/halaman/AlatPajak';
import { TombolForm } from '@/components/form/PusatForm';
import { GulirX, Insight, Kosong, Pill, Seksi, Sub } from '@/components/ui';
import { ambilData, ambilPeriode } from '@/lib/data';
import { bulanIni, bulanLabel, geserBulan, hariIni, hariSelisih, rp, tgl } from '@/lib/format';
import { deadlineLapor, deadlineSetor, pajakBelumSetor, totalUtangPajak, type DataKeuangan, type WarnaPill } from '@/lib/hitung';
import { estimasiPPhBadan } from '@/lib/laporan';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { opsiBulan, type Periode } from '@/lib/periode';

export const metadata = { title: 'Pajak' };

const H = halamanDari('/pajak');

const DASAR: Record<string, string> = {
  'PPh 21': 'Gaji & honor karyawan',
  'PPh 23': 'Jasa dari vendor ber-NPWP',
  'PPh 4(2)': 'Sewa tanah/bangunan',
  'PPN Keluaran': 'Penjualan jasa (khusus PKP)',
  'PPh 25': 'Angsuran PPh badan bulanan',
};

export default async function HalamanPajak({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode] = await Promise.all([searchParams, ambilData(), ambilPeriode()]);
  const aktif = tabAktif(H, tab);
  const belum = pajakBelumSetor(d);
  const lewat = belum.filter((p) => hariSelisih(deadlineSetor(p.periode)) < 0);
  const lalu = bulanLabel(geserBulan(bulanIni(), -1));

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        sub={
          <>
            {d.namaPerusahaan} · {d.perusahaan?.pkp ? 'PKP' : 'Non-PKP'} · {belum.length} belum disetor <b>{rp(totalUtangPajak(d))}</b>
            {lewat.length ? (
              <>
                {' '}
                · <b>{lewat.length} telat</b>
              </>
            ) : null}
          </>
        }
        aksi={
          <>
            <TombolForm buka={{ jenis: 'pajak' }} varian="btn-hero" hanyaPengelola>
              Catat kewajiban
            </TombolForm>
            <TombolBuatPajak label={`Buat dari data ${lalu}`} />
            {d.perusahaan ? (
              <TombolForm buka={{ jenis: 'perusahaan', data: d.perusahaan }} varian="btn-hero" hanyaPengelola>
                Profil perusahaan
              </TombolForm>
            ) : null}
          </>
        }
        lencana={{ kewajiban: d.pajak.length || '' }}
      />
      {aktif === 'kewajiban' ? <Kewajiban d={d} lalu={lalu} /> : null}
      {aktif === 'kalkulator' ? (
        <Seksi ikon="bar" judul="Kalkulator Cepat" desk="Hitung sebelum menerbitkan invoice atau membayar vendor.">
          <Kalkulator />
        </Seksi>
      ) : null}
      {aktif === 'tahunan' ? <PphBadan d={d} p={periode} /> : null}
      {aktif === 'panduan' ? <Panduan /> : null}
    </>
  );
}

function Kewajiban({ d, lalu }: { d: DataKeuangan; lalu: string }) {
  const arr = d.pajak.slice().sort((a, b) => b.periode.localeCompare(a.periode));
  return (
    <Seksi
      ikon="lonceng"
      warna="amber"
      judul="Kewajiban Bulanan"
      desk="Setor tanggal 15, lapor SPT Masa PPh tanggal 20, SPT Masa PPN akhir bulan berikutnya (PMK 81/2024)."
    >
      {arr.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>Masa</th>
                <th>Jenis</th>
                <th className="!text-right">Dasar</th>
                <th className="!text-right">Terutang</th>
                <th>Batas Setor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {arr.map((p) => {
                const ds = deadlineSetor(p.periode);
                const dl = deadlineLapor(p.periode, p.jenis);
                const h = hariSelisih(ds);
                const st: { c: WarnaPill; t: string } =
                  p.tgl_setor && p.tgl_lapor
                    ? { c: 'hijau', t: 'Setor & lapor' }
                    : p.tgl_setor
                      ? { c: 'biru', t: 'Sudah setor' }
                      : h < 0
                        ? { c: 'merah', t: `Telat ${Math.abs(h)} hari` }
                        : h <= 5
                          ? { c: 'amber', t: 'H-' + h }
                          : { c: 'abu', t: 'Belum tempo' };
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold">{bulanLabel(p.periode)}</div>
                      {dl ? <Sub>Lapor {tgl(dl)}</Sub> : null}
                    </td>
                    <td>
                      {p.jenis}
                      <Sub>{DASAR[p.jenis]}</Sub>
                    </td>
                    <td className="num text-right">{p.dpp ? rp(p.dpp) : '—'}</td>
                    <td className="num text-right">
                      <b>{rp(p.nominal)}</b>
                    </td>
                    <td className="num whitespace-nowrap">{tgl(ds)}</td>
                    <td>
                      <Pill warna={st.c}>{st.t}</Pill>
                    </td>
                    <td className="text-right">
                      <TombolForm buka={{ jenis: 'pajak', data: p }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
                        Ubah
                      </TombolForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Belum disetor</td>
                <td className="num text-right">{rp(totalUtangPajak(d))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Belum ada kewajiban tercatat">Klik &quot;Buat dari data {lalu}&quot; untuk menghasilkan daftar otomatis.</Kosong>
      )}
    </Seksi>
  );
}

function PphBadan({ d, p }: { d: DataKeuangan; p: Periode }) {
  const thn = p.mode === 'tahun' ? p.tahun : hariIni().slice(0, 4);
  const e = estimasiPPhBadan(d, thn);
  const Baris = ({ label, sub, nilai, tebal }: { label: string; sub?: string; nilai: string; tebal?: boolean }) => (
    <tr>
      <td>
        {tebal ? <b>{label}</b> : label}
        {sub ? <Sub>{sub}</Sub> : null}
      </td>
      <td className="num text-right">{tebal ? <b>{nilai}</b> : nilai}</td>
    </tr>
  );
  return (
    <>
      <BarPeriode periode={p} opsiBulan={opsiBulan(d.transaksi.map((t) => t.tanggal))} />
      <Seksi
        ikon="dok"
        warna="hijau"
        judul={`Estimasi PPh Badan ${thn}`}
        desk="Perkiraan dari data tercatat. Angka final ditentukan setelah koreksi fiskal oleh konsultan pajak."
      >
        <GulirX>
          <table className="tabel">
            <tbody>
              <Baris label="Peredaran bruto (tanpa dana titipan klien)" nilai={rp(e.omzet)} />
              <Baris label="Beban operasional" sub="Tidak termasuk prive founder" nilai={`(${rp(e.beban)})`} />
              <Baris label="Beban penyusutan aset setahun" nilai={`(${rp(e.susut)})`} />
              <Baris label="Laba komersial sebelum pajak" nilai={rp(e.laba)} tebal />
              {e.koreksi ? (
                <>
                  <Baris label="Koreksi fiskal positif" sub="Sedekah & donasi umum tidak bisa dikurangkan" nilai={`+ ${rp(e.koreksi)}`} />
                  <Baris label="Laba fiskal" nilai={rp(e.labaFiskal)} tebal />
                </>
              ) : null}
              <Baris
                label="Estimasi PPh badan"
                sub={`Tarif 22%${e.omzet <= 4.8e9 ? ' dengan fasilitas Pasal 31E — efektif 11%' : e.omzet < 50e9 ? ' dengan Pasal 31E proporsional' : ''}`}
                nilai={rp(e.pph)}
                tebal
              />
              {e.kreditPph23 ? (
                <>
                  <Baris label="Kredit PPh 23 dipotong klien" sub="Hanya bisa dikreditkan kalau bukti potongnya ada" nilai={`(${rp(e.kreditPph23)})`} />
                  <Baris label="Perkiraan PPh kurang bayar" nilai={rp(e.kurangBayar)} tebal />
                </>
              ) : null}
              <Baris label="Laba setelah pajak" nilai={rp(e.laba - e.pph)} />
              {e.prive ? <Baris label="Prive founder tahun ini" sub="Pengurang ekuitas, di luar laba rugi" nilai={`(${rp(e.prive)})`} /> : null}
            </tbody>
          </table>
        </GulirX>
        {e.tanpaBuktiPotong ? (
          <Insight jenis="bad" judul={`${e.tanpaBuktiPotong} tagihan belum ada bukti potong PPh 23`} className="mt-[18px]">
            Tanpa bukti potong, kredit pajaknya hilang — ARL membayar dua kali. Tagih bukti potongnya ke klien sebelum bulan
            berikutnya lewat.
          </Insight>
        ) : null}
        <Insight jenis="warn" judul="PT tidak bisa lagi pakai PPh final 0,5%" className="!mb-0 mt-[18px]">
          Sejak PP 20/2026 (berlaku 22 April 2026), skema PPh final UMKM hanya untuk orang pribadi, perseroan perorangan, dan
          koperasi. PT yang sudah memakainya boleh melanjutkan sampai jatahnya habis. Setelah itu ARL wajib pembukuan penuh dan
          menghitung PPh badan dari laba fiskal.
        </Insight>
      </Seksi>
    </>
  );
}

function Panduan() {
  const baris = [
    ['PPh 21', 'Gaji & honor karyawan', 'TER per pegawai', 'tgl 15', 'tgl 20'],
    ['PPh 23', 'Jasa vendor ber-NPWP', '2% (4% tanpa NPWP)', 'tgl 15', 'tgl 20'],
    ['PPh 4(2)', 'Sewa tanah/bangunan', '10% final', 'tgl 15', 'tgl 20'],
    ['PPN', 'Penyerahan jasa (jika PKP)', 'efektif 11%', 'tgl 15', 'akhir bulan'],
    ['PPh 25', 'Angsuran badan', 'dari SPT tahun lalu', 'tgl 15', '—'],
    ['SPT Tahunan Badan', 'Laba fiskal setahun', '22% + Pasal 31E', '—', '30 April'],
  ];
  return (
    <Seksi ikon="dok" judul="Kalender & Tarif" desk="Ringkasan yang paling sering dipakai ARL.">
      <GulirX>
        <table className="tabel">
          <thead>
            <tr>
              <th>Kewajiban</th>
              <th>Dasar</th>
              <th>Tarif</th>
              <th>Setor</th>
              <th>Lapor</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b[0]}>
                {b.map((c, i) => (
                  <td key={i} className={i === 0 ? 'font-semibold' : ''}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GulirX>
      <Insight judul="Yang paling sering merugikan agensi" className="mt-[18px]">
        Klien berbentuk PT memotong <b>PPh 23 sebesar 2%</b> dari nilai jasa ARL. Invoice Rp10 juta, masuk rekening Rp9,8 juta.
        Selisihnya bukan piutang macet — itu kredit pajak yang mengurangi PPh badan, <b>asal bukti potongnya dikumpulkan</b>.
        Kalau tidak ditagih, uang itu hilang dua kali. Aturan internal: setiap pembayaran yang kurang dari nilai invoice, tagih
        bukti potongnya sebelum bulan berikutnya lewat.
      </Insight>
      <Insight jenis="warn" judul="Dana titipan klien bukan omzet" className="!mb-0">
        Budget iklan yang ditransfer klien tercatat sebagai kewajiban. Kalau dicatat sebagai pendapatan, omzet menggelembung,
        PPh badan naik, dan kalau ARL jadi PKP, PPN yang dipungut ikut salah.
      </Insight>
    </Seksi>
  );
}
