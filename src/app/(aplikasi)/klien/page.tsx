import BarPeriode from '@/components/halaman/BarPeriode';
import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import { TombolForm } from '@/components/form/PusatForm';
import { Blok, Insight, Kosong, Pill, Seksi } from '@/components/ui';
import { ambilData, ambilPeriode } from '@/lib/data';
import { rp, rpS, tgl } from '@/lib/format';
import {
  kontribusiKlien,
  sisaTagihan,
  statusInv,
  tagihanTerbuka,
  telat,
  totalPiutang,
  type DataKeuangan,
} from '@/lib/hitung';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { dalamPeriode, opsiBulan, periodeLabel, type Periode } from '@/lib/periode';
import type { Klien } from '@/lib/tipe-db';

export const metadata = { title: 'Klien & Tagihan' };

const H = halamanDari('/klien');

export default async function HalamanKlien({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode] = await Promise.all([searchParams, ambilData(), ambilPeriode()]);
  const aktif = tabAktif(H, tab);
  const semua = d.klien.slice().sort((a, b) => a.nama.localeCompare(b.nama));
  const adaTelat = (k: Klien) => d.tagihan.some((i) => i.klien_id === k.id && statusInv(i).t.startsWith('Telat'));
  const punyaTunggakan = semua.filter(adaTelat);
  const tl = telat(d);
  const list = aktif === 'telat' ? punyaTunggakan : semua;

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        sub={
          <>
            {semua.length} klien · Piutang berjalan <b>{rp(totalPiutang(d))}</b> · <b>{tl.length}</b> tagihan telat
          </>
        }
        aksi={
          <>
            <TombolForm buka={{ jenis: 'klien' }} varian="btn-hero" hanyaPengelola>
              Tambah klien
            </TombolForm>
            {tl.length ? (
              <TombolForm buka={{ jenis: 'pengingat-massal', telat: tl }} varian="btn-hero">
                Pengingat massal
              </TombolForm>
            ) : null}
          </>
        }
        lencana={{ aktif: semua.length, telat: punyaTunggakan.length || '' }}
      />
      {aktif === 'kontribusi' ? (
        <Kontribusi d={d} p={periode} />
      ) : (
        <Blok>
          {!list.length ? (
            <Kosong judul={aktif === 'telat' ? 'Tidak ada tunggakan' : 'Belum ada klien'}>
              {aktif === 'telat' ? 'Semua klien membayar tepat waktu.' : 'Tambahkan klien supaya tagihannya bisa dipantau.'}
            </Kosong>
          ) : null}
          {list.map((k) => (
            <KartuKlien key={k.id} k={k} d={d} telat={adaTelat(k)} />
          ))}
        </Blok>
      )}
    </>
  );
}

function KartuKlien({ k, d, telat: tunggak }: { k: Klien; d: DataKeuangan; telat: boolean }) {
  const inv = d.tagihan
    .filter((i) => i.klien_id === k.id)
    .sort((a, b) => (b.jatuh_tempo || '').localeCompare(a.jatuh_tempo || ''));
  const sisa = inv.reduce((s, i) => s + Math.max(0, sisaTagihan(i)), 0);
  const terbuka = tagihanTerbuka(d).filter((i) => i.klien_id === k.id);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-garis">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-garis bg-krem px-4 py-3.5">
        <div>
          <h4 className="font-serif text-[15.5px] font-bold">
            {k.nama} {tunggak ? <Pill warna="merah">tunggakan</Pill> : null}
          </h4>
          <div className="mt-0.5 text-xs text-muted">
            {k.pic || 'PIC belum diisi'} · {k.wa || 'WA belum diisi'} · {k.paket || 'paket belum diisi'}
            {k.nilai_bulanan ? (
              <>
                {' '}
                · <b>{rpS(k.nilai_bulanan)}</b>/bulan
              </>
            ) : null}
          </div>
          {sisa > 0 ? (
            <div className="mt-0.5 text-xs text-muted">
              Piutang <b className="text-merah">{rp(sisa)}</b>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {terbuka.length ? (
            <TombolForm buka={{ jenis: 'pengingat', klien: k, tagihan: terbuka }} className="btn-sm">
              Pengingat
            </TombolForm>
          ) : null}
          <TombolForm buka={{ jenis: 'tagihan', klien: k }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
            + Tagihan
          </TombolForm>
          <TombolForm buka={{ jenis: 'klien', data: k }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
            Ubah
          </TombolForm>
        </div>
      </div>
      {inv.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="tabel !mt-0 [&_thead_th]:!bg-navy-kepala">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Jatuh Tempo</th>
                  <th className="!text-right">Nilai</th>
                  <th className="!text-right">Dibayar</th>
                  <th className="!text-right">Sisa</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inv.slice(0, 6).map((i) => {
                  const s = statusInv(i);
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="font-semibold">{i.periode}</div>
                        {i.catatan ? <div className="text-[11.5px] text-muted">{i.catatan}</div> : null}
                        {i.pph23_dipotong ? (
                          <div className="text-[11.5px] text-muted">
                            PPh 23 dipotong {rp(i.pph23_dipotong)}
                            {i.bukti_potong_url ? '' : ' · bukti potong belum ada'}
                          </div>
                        ) : null}
                      </td>
                      <td className="num whitespace-nowrap">{tgl(i.jatuh_tempo)}</td>
                      <td className="num text-right">{rp(i.nominal)}</td>
                      <td className="num text-right">{rp(i.dibayar)}</td>
                      <td className="num text-right">
                        <b>{rp(Math.max(0, sisaTagihan(i)))}</b>
                      </td>
                      <td>
                        <Pill warna={s.c}>{s.t}</Pill>
                      </td>
                      <td className="text-right">
                        <TombolForm buka={{ jenis: 'tagihan', klien: k, data: i }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
                          Ubah
                        </TombolForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {inv.length > 6 ? <div className="px-4 py-2.5 text-[11.5px] text-muted">Menampilkan 6 tagihan terbaru dari {inv.length}.</div> : null}
        </>
      ) : (
        <div className="p-4">
          <Kosong judul="Belum ada tagihan">Tambahkan tagihan bulanan supaya pengingatnya muncul otomatis.</Kosong>
        </div>
      )}
    </div>
  );
}

function Kontribusi({ d, p }: { d: DataKeuangan; p: Periode }) {
  const arr = p.mode === 'semua' ? d.transaksi : d.transaksi.filter((t) => dalamPeriode(p, t.tanggal));
  const rank = kontribusiKlien(arr);
  const tot = rank.reduce((s, r) => s + r[1], 0) || 1;
  const terbuka = tagihanTerbuka(d);
  const tl = telat(d);
  const label = periodeLabel(p);

  return (
    <>
      <BarPeriode periode={p} opsiBulan={opsiBulan(d.transaksi.map((t) => t.tanggal))} />
      <Seksi
        ikon="bar"
        warna="hijau"
        judul="Kontribusi Pendapatan"
        desk={`Pemasukan atas nama tiap klien di ${label.toLowerCase()}, tanpa dana titipan iklan.`}
      >
        {rank.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Klien</th>
                    <th className="!text-right">Pendapatan</th>
                    <th className="!text-right">Porsi</th>
                    <th className="!text-right">Piutang</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rank.map(([id, v]) => {
                    const k = d.klien.find((x) => x.id === id);
                    const piutang = terbuka.filter((i) => i.klien_id === id).reduce((s, i) => s + i.sisa, 0);
                    const menunggak = tl.some((i) => i.klien_id === id);
                    return (
                      <tr key={id}>
                        <td className="font-semibold">{k ? k.nama : '(terhapus)'}</td>
                        <td className="num text-right">{rp(v)}</td>
                        <td className="num text-right">{((v / tot) * 100).toFixed(1).replace('.', ',')}%</td>
                        <td className={`num text-right ${piutang > 0 ? 'text-merah' : 'text-muted'}`}>{rp(piutang)}</td>
                        <td>
                          <Pill warna={menunggak ? 'merah' : piutang > 0 ? 'amber' : 'hijau'}>
                            {menunggak ? 'Menunggak' : piutang > 0 ? 'Ada tagihan' : 'Lancar'}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num text-right">{rp(tot)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
            {rank[0][1] / tot > 0.5 ? (
              <Insight jenis="warn" judul="Ketergantungan pada satu klien" className="!mb-0 mt-4">
                <b>{d.klien.find((x) => x.id === rank[0][0])?.nama}</b> menyumbang {((rank[0][1] / tot) * 100).toFixed(0)}% pendapatan periode
                ini. Kalau kontrak itu berhenti, dampaknya besar ke kas ARL.
              </Insight>
            ) : null}
          </>
        ) : (
          <Kosong judul="Belum ada pemasukan bertanda klien">Tandai transaksi masuk ke nama klien supaya kontribusinya terlihat.</Kosong>
        )}
      </Seksi>
    </>
  );
}
