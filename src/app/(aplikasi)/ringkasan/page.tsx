import Link from 'next/link';
import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import TabelTransaksi from '@/components/halaman/TabelTransaksi';
import { TombolForm } from '@/components/form/PusatForm';
import { Blok, GulirX, Insight, Kosong, Kpi, Kpis, Pill, Seksi, Sub } from '@/components/ui';
import { ambilData, ambilPeriode } from '@/lib/data';
import { bulanLabel, hariSelisih, pct, rp, rpS, tgl } from '@/lib/format';
import {
  danaTitipan,
  deadlineSetor,
  pajakBelumSetor,
  pengeluaranPerKategori,
  saldoRekening,
  statusInv,
  tagihanTerbuka,
  telat,
  totalKas,
  totalPiutang,
  totalTipe,
  totalUtang,
  totalUtangPajak,
  urutTerbaru,
  utangTerbuka,
  type DataKeuangan,
} from '@/lib/hitung';
import { halamanDari, tabAktif } from '@/lib/navigasi';
import { dalamPeriode, labelBanding, periodeLabel, periodeSebelum, type Periode } from '@/lib/periode';

export const metadata = { title: 'Ringkasan' };

const H = halamanDari('/ringkasan');

export default async function Ringkasan({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, d, periode] = await Promise.all([searchParams, ambilData(), ambilPeriode()]);
  const aktif = tabAktif(H, tab);
  const jumlahTelat = telat(d).length;
  const jumlahUtang = utangTerbuka(d).length + pajakBelumSetor(d).length;

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        periode={periode}
        transaksi={d.transaksi}
        badge={periodeLabel(periode)}
        sub={
          <>
            {d.namaPerusahaan} · Saldo kas <b>{rp(totalKas(d))}</b> · Piutang <b>{rp(totalPiutang(d))}</b> · Utang{' '}
            <b>{rp(totalUtang(d) + totalUtangPajak(d))}</b>
          </>
        }
        aksi={
          <TombolForm buka={{ jenis: 'transaksi' }} varian="btn-hero">
            Catat transaksi
          </TombolForm>
        }
        lencana={{ piutang: jumlahTelat || '', utang: jumlahUtang || '' }}
      />
      {aktif === 'ikhtisar' ? <Ikhtisar d={d} p={periode} /> : null}
      {aktif === 'kas' ? <Kas d={d} p={periode} /> : null}
      {aktif === 'piutang' ? <Piutang d={d} /> : null}
      {aktif === 'utang' ? <Utang d={d} /> : null}
    </>
  );
}

const PctTeks = ({ v }: { v: number | null }) =>
  v === null ? (
    <span className="text-muted">bulan pertama</span>
  ) : (
    <span className={`font-bold ${v >= 0 ? 'text-hijau' : 'text-merah'}`}>
      {v >= 0 ? '+' : '−'}
      {Math.abs(v).toFixed(1).replace('.', ',')}%
    </span>
  );

/* ---------------------------------------------------------------- IKHTISAR */
function Ikhtisar({ d, p }: { d: DataKeuangan; p: Periode }) {
  const a = d.transaksi.filter((t) => dalamPeriode(p, t.tanggal));
  const pre = periodeSebelum(p);
  const b = pre ? d.transaksi.filter((t) => t.tanggal.startsWith(pre)) : [];
  const m = totalTipe(a, 'masuk'),
    k = totalTipe(a, 'keluar');
  const mL = totalTipe(b, 'masuk'),
    kL = totalTipe(b, 'keluar');
  const laba = m - k,
    labaL = mL - kL;
  const tl = telat(d);
  const kats = pengeluaranPerKategori(a).slice(0, 6);
  const maxK = kats.length ? kats[0][1] : 1;
  const lb = labelBanding(p);
  const label = periodeLabel(p);

  let insight: { c: 'good' | 'warn' | 'bad' | ''; h: string; isi: React.ReactNode };
  if (!a.length)
    insight = { c: '', h: 'Tidak ada transaksi di ' + label, isi: 'Pilih periode lain di atas, atau catat transaksi baru.' };
  else if (tl.length)
    insight = {
      c: 'bad',
      h: `${tl.length} tagihan lewat jatuh tempo`,
      isi: (
        <>
          Total {rp(tl.reduce((s, i) => s + i.sisa, 0))} tertahan di klien. Terlama: <b>{tl[0].klien}</b> {rp(tl[0].sisa)}, telat{' '}
          {Math.abs(hariSelisih(tl[0].jatuh_tempo))} hari.
        </>
      ),
    };
  else if (laba < 0)
    insight = {
      c: 'warn',
      h: 'Pengeluaran melebihi pemasukan',
      isi: (
        <>
          Keluar {rp(k)} melawan masuk {rp(m)} — selisih {rp(laba)}. Pos terbesar: <b>{kats[0]?.[0] ?? '-'}</b> {rp(kats[0]?.[1] ?? 0)}.
        </>
      ),
    };
  else
    insight = {
      c: 'good',
      h: 'Arus kas periode ini positif',
      isi: (
        <>
          Masuk {rp(m)}, keluar {rp(k)}, sisa <b>{rp(laba)}</b>.
        </>
      ),
    };

  return (
    <>
      <Blok>
        <Kpis>
          <Kpi
            label="Uang Masuk"
            nilai={rp(m)}
            kondisi={m >= mL ? 'hl' : 'biasa'}
            catatan={lb ? <>{lb} {rpS(mL)} · <PctTeks v={pct(m, mL)} /></> : '—'}
          />
          <Kpi
            label="Uang Keluar"
            nilai={rp(k)}
            kondisi={k > kL ? 'warn' : 'biasa'}
            catatan={lb ? <>{lb} {rpS(kL)} · <PctTeks v={pct(k, kL)} /></> : '—'}
          />
          <Kpi label="Selisih Kas" nilai={rp(laba)} kondisi={laba >= 0 ? 'hl' : 'bad'} catatan={lb ? `${lb} ${rpS(labaL)}` : '—'} />
          <Kpi label="Transaksi" nilai={a.length} catatan={`${a.filter((t) => t.bukti_url).length} punya bukti`} />
        </Kpis>
        <Insight jenis={insight.c} judul={insight.h} className="!mb-0 mt-5">
          {insight.isi}
        </Insight>
      </Blok>

      <Seksi ikon="bar" judul="Pengeluaran Terbesar" desk={`Enam pos teratas di ${label.toLowerCase()}.`}>
        {kats.length ? (
          kats.map(([kk, v]) => (
            <div key={kk} className="mb-[11px]">
              <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
                <b>{kk}</b>
                <span className="num">
                  <b>{rp(v)}</b> <span className="text-[11.5px] text-muted">{((v / k) * 100).toFixed(1).replace('.', ',')}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-[#E7EDF5]">
                <i className="block h-full rounded-md bg-biru" style={{ width: `${Math.round((v / maxK) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <Kosong judul="Belum ada pengeluaran">Tidak ada beban tercatat di periode ini.</Kosong>
        )}
      </Seksi>

      <Seksi ikon="dok" judul="Transaksi Terbaru" desk="Lima catatan terakhir di periode ini.">
        {a.length ? (
          <TabelTransaksi baris={urutTerbaru(a).slice(0, 5)} />
        ) : (
          <Kosong judul="Kosong">Belum ada transaksi di {label.toLowerCase()}.</Kosong>
        )}
        <div className="mt-3.5">
          <Link href="/transaksi" className="btn-ghost no-underline">
            Buka buku transaksi
          </Link>
        </div>
      </Seksi>
    </>
  );
}

/* ---------------------------------------------------------------- KAS */
function Kas({ d, p }: { d: DataKeuangan; p: Periode }) {
  const a = d.transaksi.filter((t) => dalamPeriode(p, t.tanggal));
  const titipan = danaTitipan(d);
  const tanpaRekening = d.transaksi.filter((t) => !t.rekening_id);
  return (
    <Seksi
      ikon="dompet"
      judul="Saldo per Rekening"
      desk="Saldo kini dihitung dari saldo awal ditambah seluruh mutasi, bukan hanya periode terpilih."
    >
      {d.rekening.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>Rekening</th>
                <th>Jenis</th>
                <th className="!text-right">Saldo Awal</th>
                <th className="!text-right">Mutasi Periode</th>
                <th className="!text-right">Saldo Kini</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.rekening.map((r) => {
                const mut = a.filter((t) => t.rekening_id === r.id).reduce((x, t) => x + (t.tipe === 'masuk' ? t.nominal : -t.nominal), 0);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="font-semibold">{r.nama}</div>
                      <Sub>{[r.bank, r.no_rek ? '••••' + r.no_rek : '', r.catatan].filter(Boolean).join(' · ')}</Sub>
                    </td>
                    <td>
                      <Pill warna="navy">{r.jenis}</Pill>
                    </td>
                    <td className="num text-right">{rp(r.saldo_awal)}</td>
                    <td className={`num text-right ${mut >= 0 ? 'text-hijau' : 'text-merah'}`}>
                      {mut >= 0 ? '+' : '−'}
                      {rp(Math.abs(mut))}
                    </td>
                    <td className="num text-right">
                      <b>{rp(saldoRekening(d, r.id))}</b>
                    </td>
                    <td className="text-right">
                      <TombolForm buka={{ jenis: 'rekening', data: r }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
                        Ubah
                      </TombolForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total kas &amp; setara kas</td>
                <td className="num text-right">{rp(totalKas(d))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Belum ada rekening">Daftarkan rekening supaya saldo bisa dicocokkan dengan mutasi bank.</Kosong>
      )}
      {tanpaRekening.length ? (
        <Insight jenis="warn" judul={`${tanpaRekening.length} transaksi belum ditandai rekeningnya`} className="!mb-0 mt-4">
          Nilainya tetap masuk total kas, tapi tidak bisa dicocokkan dengan mutasi bank mana pun. Buka transaksinya lalu pilih
          rekening.
        </Insight>
      ) : null}
      <div className="mt-3.5">
        <TombolForm buka={{ jenis: 'rekening' }} hanyaPengelola>
          Tambah rekening
        </TombolForm>
      </div>
      {titipan > 0 ? (
        <Insight jenis="warn" judul={`${rp(titipan)} di antaranya milik klien`} className="!mb-0 mt-[18px]">
          Budget iklan yang dititipkan dan belum dibelanjakan. Saldo terlihat besar, tapi bagian ini bukan uang ARL — jangan
          dipakai untuk gaji atau operasional.
        </Insight>
      ) : null}
    </Seksi>
  );
}

/* ---------------------------------------------------------------- PIUTANG */
function Piutang({ d }: { d: DataKeuangan }) {
  const semua = tagihanTerbuka(d);
  const tl = telat(d);
  const perUmur = { '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0 };
  semua.forEach((i) => {
    const h = -hariSelisih(i.jatuh_tempo);
    if (h <= 30) perUmur['0-30'] += i.sisa;
    else if (h <= 60) perUmur['31-60'] += i.sisa;
    else if (h <= 90) perUmur['61-90'] += i.sisa;
    else perUmur['>90'] += i.sisa;
  });
  return (
    <>
      <Seksi ikon="lonceng" warna={tl.length ? 'merah' : 'biru'} judul="Umur Piutang" desk="Semakin tua sebuah tagihan, semakin kecil kemungkinan tertagih.">
        <Kpis>
          {Object.entries(perUmur).map(([k, v], i) => (
            <Kpi
              key={k}
              label={k === '0-30' ? 'Belum / baru lewat' : k + ' hari'}
              nilai={rp(v)}
              kondisi={i === 0 ? 'biasa' : i === 3 ? 'bad' : 'warn'}
              catatan={k === '>90' ? 'Perlu tindakan tegas' : k === '0-30' ? 'Masih wajar' : 'Sudah harus ditagih'}
            />
          ))}
        </Kpis>
      </Seksi>
      <Seksi ikon="user" judul="Daftar Tagihan Terbuka" desk="Urut dari jatuh tempo paling awal.">
        {semua.length ? (
          <>
            <GulirX>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Klien</th>
                    <th>Periode</th>
                    <th>Jatuh Tempo</th>
                    <th className="!text-right">Sisa</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {semua.map((i) => {
                    const s = statusInv(i);
                    const k = d.klien.find((x) => x.id === i.klien_id)!;
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="font-semibold">{i.klien}</div>
                          <Sub>{i.pic || 'PIC belum diisi'}</Sub>
                        </td>
                        <td>{i.periode}</td>
                        <td className="num whitespace-nowrap">{tgl(i.jatuh_tempo)}</td>
                        <td className="num text-right">
                          <b>{rp(i.sisa)}</b>
                        </td>
                        <td>
                          <Pill warna={s.c}>{s.t}</Pill>
                        </td>
                        <td className="text-right">
                          {k ? (
                            <TombolForm buka={{ jenis: 'pengingat', klien: k, tagihan: [i] }} className="btn-sm">
                              Pengingat
                            </TombolForm>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total piutang</td>
                    <td className="num text-right">{rp(totalPiutang(d))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </GulirX>
            {tl.length ? (
              <div className="mt-3.5">
                <TombolForm buka={{ jenis: 'pengingat-massal', telat: tl }}>Pengingat massal {tl.length} yang telat</TombolForm>
              </div>
            ) : null}
          </>
        ) : (
          <Kosong judul="Semua klien lunas">Tidak ada tagihan terbuka.</Kosong>
        )}
      </Seksi>
    </>
  );
}

/* ---------------------------------------------------------------- UTANG & PAJAK */
function Utang({ d }: { d: DataKeuangan }) {
  const ut = utangTerbuka(d);
  const pj = pajakBelumSetor(d);
  return (
    <>
      <Seksi ikon="user" warna="amber" judul="Utang ke Vendor" desk="Fee KOL, freelancer, sewa, dan tools yang belum dibayar.">
        {ut.length ? (
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Keterangan</th>
                  <th>Jatuh Tempo</th>
                  <th className="!text-right">Sisa</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ut.map((u) => {
                  const h = hariSelisih(u.jatuh_tempo);
                  const v = d.vendor.find((x) => x.id === u.vendor_id)!;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-semibold">{u.vendor}</div>
                        <Sub>{u.jenis}</Sub>
                      </td>
                      <td>{u.keterangan}</td>
                      <td className="num whitespace-nowrap">{tgl(u.jatuh_tempo)}</td>
                      <td className="num text-right">
                        <b>{rp(u.sisa)}</b>
                      </td>
                      <td>
                        <Pill warna={h < 0 ? 'merah' : h <= 3 ? 'amber' : 'biru'}>
                          {h < 0 ? `Telat ${Math.abs(h)} hari` : h === 0 ? 'Hari ini' : 'H-' + h}
                        </Pill>
                      </td>
                      <td className="text-right">
                        {v ? (
                          <TombolForm buka={{ jenis: 'utang', vendor: v, data: u }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
                            Ubah
                          </TombolForm>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total utang usaha</td>
                  <td className="num text-right">{rp(totalUtang(d))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </GulirX>
        ) : (
          <Kosong judul="Tidak ada utang terbuka">Semua tagihan vendor sudah dibayar.</Kosong>
        )}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <TombolForm buka={{ jenis: 'vendor' }} varian="btn-ghost" hanyaPengelola>
            Tambah vendor
          </TombolForm>
          {d.vendor.slice(0, 4).map((v) => (
            <TombolForm key={v.id} buka={{ jenis: 'utang', vendor: v }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
              + tagihan {v.nama}
            </TombolForm>
          ))}
          {d.vendor.slice(0, 4).map((v) => (
            <TombolForm key={'u' + v.id} buka={{ jenis: 'vendor', data: v }} varian="btn-ghost" className="btn-sm" hanyaPengelola>
              Ubah {v.nama}
            </TombolForm>
          ))}
        </div>
      </Seksi>

      <Seksi ikon="lonceng" warna={pj.length ? 'merah' : 'biru'} judul="Pajak Belum Disetor" desk="Uang ini ada di rekening ARL tapi bukan milik ARL.">
        {pj.length ? (
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Masa</th>
                  <th>Jenis</th>
                  <th className="!text-right">Terutang</th>
                  <th>Batas Setor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pj.map((p) => {
                  const h = hariSelisih(deadlineSetor(p.periode));
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold">{bulanLabel(p.periode)}</td>
                      <td>{p.jenis}</td>
                      <td className="num text-right">
                        <b>{rp(p.nominal)}</b>
                      </td>
                      <td className="num whitespace-nowrap">{tgl(deadlineSetor(p.periode))}</td>
                      <td>
                        <Pill warna={h < 0 ? 'merah' : h <= 5 ? 'amber' : 'abu'}>{h < 0 ? `Telat ${Math.abs(h)} hari` : 'H-' + h}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total utang pajak</td>
                  <td className="num text-right">{rp(totalUtangPajak(d))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </GulirX>
        ) : (
          <Kosong judul="Tidak ada tunggakan pajak">Semua kewajiban sudah disetor.</Kosong>
        )}
        <div className="mt-3.5">
          <Link href="/pajak" className="btn-ghost no-underline">
            Buka halaman pajak
          </Link>
        </div>
      </Seksi>
    </>
  );
}
