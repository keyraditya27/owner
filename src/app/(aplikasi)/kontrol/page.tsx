import Link from 'next/link';
import { redirect } from 'next/navigation';
import Hero from '@/components/halaman/Hero';
import SubTab from '@/components/halaman/SubTab';
import TombolAksi from '@/components/halaman/TombolAksi';
import UnduhBackup from '@/components/halaman/UnduhBackup';
import { GulirX, Insight, Kosong, Pill, Seksi, Sub } from '@/components/ui';
import {
  backupSekarang,
  bukaPeriode,
  setujuiPengajuan,
  tarikPengajuan,
  tolakPengajuan,
  tutupPeriode,
} from '@/app/(aplikasi)/aksi/kontrol';
import { daftarBackup } from '@/lib/backup';
import { ambilData } from '@/lib/data';
import { bulanIni, bulanLabel, rp, tgl } from '@/lib/format';
import { BATAS_PERSETUJUAN } from '@/lib/konstanta';
import { KONTROL, tabKontrolUntuk } from '@/lib/navigasi';
import { wajibLogin, type PenggunaAktif } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';
import type { AuditLog, Pengajuan, Pengguna, TutupBuku } from '@/lib/tipe-db';

export const metadata = { title: 'Kontrol' };
export const dynamic = 'force-dynamic';

type Cari = { tab?: string; pengguna?: string; tabel?: string; dari?: string; sampai?: string; hal?: string };

export default async function HalamanKontrol({ searchParams }: { searchParams: Promise<Cari> }) {
  const [cari, saya] = await Promise.all([searchParams, wajibLogin()]);
  const tabs = tabKontrolUntuk(saya.peran);
  const aktif = tabs.some((t) => t.kunci === cari.tab) ? cari.tab! : tabs[0].kunci;
  if (cari.tab && cari.tab !== aktif) redirect('/kontrol');

  const db = await klienServer();
  const { data: pengajuan } = await db.from('pengajuan').select('*').order('dibuat_pada', { ascending: false }).limit(200);
  const menunggu = (pengajuan ?? []).filter((p) => p.status === 'menunggu').length;

  return (
    <>
      <Hero
        judul="Kontrol"
        badge="Pengaman"
        sub={
          saya.peran === 'staf'
            ? `Pengeluaran di atas ${rp(BATAS_PERSETUJUAN)} diajukan dulu ke pemilik.`
            : `${menunggu} pengajuan menunggu · tutup buku, riwayat perubahan, dan backup`
        }
      />
      <SubTab halaman={{ ...KONTROL, tabs }} aktif={aktif} lencana={{ persetujuan: menunggu || '' }} />
      {aktif === 'persetujuan' ? <Persetujuan saya={saya} daftar={(pengajuan ?? []) as Pengajuan[]} /> : null}
      {aktif === 'tutupbuku' ? <TutupBukuTab saya={saya} /> : null}
      {aktif === 'riwayat' ? <Riwayat cari={cari} /> : null}
      {aktif === 'backup' ? <Backup /> : null}
    </>
  );
}

async function namaPengguna() {
  const db = await klienServer();
  const { data } = await db.from('pengguna').select('id, nama');
  return new Map(((data ?? []) as Pick<Pengguna, 'id' | 'nama'>[]).map((p) => [p.id, p.nama]));
}

/* ---------------------------------------------------------------- PERSETUJUAN */
async function Persetujuan({ saya, daftar }: { saya: PenggunaAktif; daftar: Pengajuan[] }) {
  const nama = await namaPengguna();
  const menunggu = daftar.filter((p) => p.status === 'menunggu');
  const selesai = daftar.filter((p) => p.status !== 'menunggu').slice(0, 30);
  const pemilik = saya.peran === 'pemilik';
  return (
    <>
      <Seksi
        ikon="lonceng"
        warna={menunggu.length ? 'amber' : 'biru'}
        judul="Menunggu Persetujuan"
        desk={`Pengeluaran staf di atas ${rp(BATAS_PERSETUJUAN)} belum masuk pembukuan sampai disetujui pemilik.`}
      >
        {menunggu.length ? (
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Diajukan</th>
                  <th className="!text-right">Nominal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {menunggu.map((p) => (
                  <tr key={p.id}>
                    <td className="num whitespace-nowrap">{tgl(p.tanggal)}</td>
                    <td>
                      <div className="font-semibold">{p.keterangan}</div>
                      <Sub>
                        {p.kategori} · {p.metode}
                        {p.bukti_url ? ' · ada bukti' : ' · tanpa bukti'}
                      </Sub>
                    </td>
                    <td>
                      {nama.get(p.diajukan_oleh) ?? '—'}
                      <Sub>{tgl(p.dibuat_pada)}</Sub>
                    </td>
                    <td className="num whitespace-nowrap text-right font-bold text-merah">− {rp(p.nominal)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {pemilik ? (
                          <>
                            <TombolAksi
                              aksi={setujuiPengajuan.bind(null, p.id)}
                              varian="btn"
                              className="btn-sm !bg-hijau hover:!bg-hijau-tua"
                              konfirmasi={`Setujui ${rp(p.nominal)} untuk "${p.keterangan}"? Langsung tercatat sebagai transaksi.`}
                            >
                              Setujui
                            </TombolAksi>
                            <TombolAksi aksi={tolakPengajuan.bind(null, p.id)} className="btn-sm" minta="Alasan penolakan:" wajibIsi>
                              Tolak
                            </TombolAksi>
                          </>
                        ) : p.diajukan_oleh === saya.id ? (
                          <TombolAksi aksi={tarikPengajuan.bind(null, p.id)} className="btn-sm" konfirmasi="Tarik pengajuan ini?">
                            Tarik
                          </TombolAksi>
                        ) : (
                          <span className="text-[11.5px] text-muted">menunggu pemilik</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GulirX>
        ) : (
          <Kosong judul="Tidak ada yang menunggu">
            {saya.peran === 'staf'
              ? `Catat pengeluaran di atas ${rp(BATAS_PERSETUJUAN)} lewat tombol "Catat transaksi" — otomatis masuk ke sini.`
              : 'Semua pengajuan sudah diputuskan.'}
          </Kosong>
        )}
      </Seksi>
      {selesai.length ? (
        <Seksi ikon="dok" judul="Sudah Diputuskan" desk="30 pengajuan terakhir.">
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Diajukan</th>
                  <th className="!text-right">Nominal</th>
                  <th>Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {selesai.map((p) => (
                  <tr key={p.id}>
                    <td className="num whitespace-nowrap">{tgl(p.tanggal)}</td>
                    <td>
                      <div className="font-semibold">{p.keterangan}</div>
                      {p.alasan ? <Sub>Alasan: {p.alasan}</Sub> : null}
                    </td>
                    <td>{nama.get(p.diajukan_oleh) ?? '—'}</td>
                    <td className="num text-right">{rp(p.nominal)}</td>
                    <td>
                      <Pill warna={p.status === 'disetujui' ? 'hijau' : 'merah'}>{p.status}</Pill>
                      <Sub>
                        {nama.get(p.diputus_oleh ?? '') ?? ''} {p.diputus_pada ? '· ' + tgl(p.diputus_pada) : ''}
                      </Sub>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GulirX>
        </Seksi>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- TUTUP BUKU */
async function TutupBukuTab({ saya }: { saya: PenggunaAktif }) {
  const [d, nama, db] = await Promise.all([ambilData(), namaPengguna(), klienServer()]);
  const { data: tutup } = await db.from('tutup_buku').select('*');
  const peta = new Map(((tutup ?? []) as TutupBuku[]).map((t) => [t.periode, t]));
  const bulan = [...new Set([...d.transaksi.map((t) => t.tanggal.slice(0, 7)), bulanIni(), ...peta.keys()])].sort().reverse();
  return (
    <Seksi
      ikon="kunci"
      judul="Tutup Buku Bulanan"
      desk="Setelah ditutup, transaksi di bulan itu terkunci — tidak bisa ditambah, diubah, atau dihapus lewat jalur mana pun sampai pemilik membukanya kembali."
    >
      <GulirX>
        <table className="tabel">
          <thead>
            <tr>
              <th>Bulan</th>
              <th className="!text-right">Transaksi</th>
              <th className="!text-right">Masuk</th>
              <th className="!text-right">Keluar</th>
              <th>Tanpa Bukti</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bulan.map((m) => {
              const arr = d.transaksi.filter((t) => t.tanggal.startsWith(m));
              const tanpa = arr.filter((t) => !t.bukti_url).length;
              const t = peta.get(m);
              return (
                <tr key={m}>
                  <td className="font-semibold">{bulanLabel(m)}</td>
                  <td className="num text-right">{arr.length}</td>
                  <td className="num text-right text-hijau">{rp(arr.filter((x) => x.tipe === 'masuk').reduce((s, x) => s + x.nominal, 0))}</td>
                  <td className="num text-right text-merah">{rp(arr.filter((x) => x.tipe === 'keluar').reduce((s, x) => s + x.nominal, 0))}</td>
                  <td>{tanpa ? <Pill warna="amber">{tanpa}</Pill> : <span className="text-muted">—</span>}</td>
                  <td>
                    {t ? (
                      <>
                        <Pill warna="navy">Ditutup</Pill>
                        <Sub>
                          {nama.get(t.ditutup_oleh ?? '') ?? ''} · {tgl(t.ditutup_pada)}
                          {t.catatan ? ' · ' + t.catatan : ''}
                        </Sub>
                      </>
                    ) : (
                      <Pill warna="hijau">Terbuka</Pill>
                    )}
                  </td>
                  <td className="text-right">
                    {t ? (
                      saya.peran === 'pemilik' ? (
                        <TombolAksi
                          aksi={bukaPeriode.bind(null, m)}
                          className="btn-sm"
                          konfirmasi={`Buka kembali ${bulanLabel(m)}? Transaksinya bisa diubah lagi dan angka laporan yang sudah dikirim bisa berubah.`}
                        >
                          Buka kembali
                        </TombolAksi>
                      ) : null
                    ) : m <= bulanIni() ? (
                      <TombolAksi
                        aksi={tutupPeriode.bind(null, m)}
                        varian="btn"
                        className="btn-sm"
                        minta={`Tutup buku ${bulanLabel(m)}${tanpa ? ` — masih ada ${tanpa} transaksi tanpa bukti` : ''}. Catatan (boleh kosong):`}
                      >
                        Tutup
                      </TombolAksi>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GulirX>
      <Insight judul="Sebelum menutup" className="!mb-0 mt-4">
        Pastikan saldo tiap rekening sudah cocok dengan mutasi bank, semua transaksi berbukti, dan kewajiban pajak bulan itu
        sudah dicatat. Hanya pemilik yang bisa membuka kembali periode yang sudah ditutup.
      </Insight>
    </Seksi>
  );
}

/* ---------------------------------------------------------------- RIWAYAT */
const LEWATI = new Set(['diubah_pada', 'dibuat_pada', 'sheet_diubah', 'sheet_sumber']);
const judulBaris = (v: Record<string, unknown> | null) =>
  v ? String(v.keterangan ?? v.nama ?? v.periode ?? v.kode ?? '').slice(0, 60) : '';
const tampil = (v: unknown) =>
  v === null || v === undefined ? '∅' : typeof v === 'number' && Math.abs(v) >= 1000 ? rp(v) : String(v).slice(0, 40);

function ringkasPerubahan(a: AuditLog) {
  const lama = (a.nilai_lama ?? null) as Record<string, unknown> | null;
  const baru = (a.nilai_baru ?? null) as Record<string, unknown> | null;
  if (a.aksi === 'update' && lama && baru) {
    return Object.keys(baru)
      .filter((k) => !LEWATI.has(k) && JSON.stringify(lama[k]) !== JSON.stringify(baru[k]))
      .map((k) => `${k}: ${tampil(lama[k])} → ${tampil(baru[k])}`);
  }
  const v = baru ?? lama;
  const nominal = v?.nominal ?? v?.harga_perolehan;
  return [[judulBaris(v), typeof nominal === 'number' ? rp(nominal) : ''].filter(Boolean).join(' · ')];
}

async function Riwayat({ cari }: { cari: Cari }) {
  const db = await klienServer();
  const nama = await namaPengguna();
  const per = 100;
  const hal = Math.max(1, Number(cari.hal) || 1);
  let q = db.from('audit_log').select('*', { count: 'exact' }).order('waktu', { ascending: false });
  if (cari.pengguna) q = cari.pengguna === 'sistem' ? q.is('pengguna_id', null) : q.eq('pengguna_id', cari.pengguna);
  if (cari.tabel) q = q.eq('tabel', cari.tabel);
  if (cari.dari && /^\d{4}-\d{2}-\d{2}$/.test(cari.dari)) q = q.gte('waktu', cari.dari + 'T00:00:00+07:00');
  if (cari.sampai && /^\d{4}-\d{2}-\d{2}$/.test(cari.sampai)) q = q.lte('waktu', cari.sampai + 'T23:59:59+07:00');
  const { data, count, error } = await q.range((hal - 1) * per, hal * per - 1);
  const baris = (data ?? []) as AuditLog[];
  const tabel = ['transaksi', 'klien', 'tagihan', 'rekening', 'vendor', 'utang_vendor', 'aset', 'pajak', 'perusahaan', 'tutup_buku', 'pengajuan', 'pengguna'];
  const url = (h: number) => '/kontrol?' + new URLSearchParams({ ...cari, tab: 'riwayat', hal: String(h) } as Record<string, string>).toString();
  const jam = (w: string) =>
    new Date(w).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Seksi ikon="daftar" judul="Riwayat Perubahan" desk="Setiap perubahan data tercatat otomatis oleh database: siapa, kapan, nilai lama, dan nilai baru.">
      <form className="mb-3.5 flex flex-wrap items-end gap-2 [&_input]:!w-auto [&_select]:!w-auto [&_select]:!py-[7px] [&_input]:!py-[7px]" action="/kontrol">
        <input type="hidden" name="tab" value="riwayat" />
        <label className="text-[11px] font-bold uppercase text-muted">
          Pengguna
          <select name="pengguna" defaultValue={cari.pengguna ?? ''} className="mt-1 block">
            <option value="">Semua</option>
            {[...nama.entries()].map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
            <option value="sistem">Sistem / impor</option>
          </select>
        </label>
        <label className="text-[11px] font-bold uppercase text-muted">
          Tabel
          <select name="tabel" defaultValue={cari.tabel ?? ''} className="mt-1 block">
            <option value="">Semua</option>
            {tabel.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-bold uppercase text-muted">
          Dari
          <input type="date" name="dari" defaultValue={cari.dari ?? ''} className="mt-1 block" />
        </label>
        <label className="text-[11px] font-bold uppercase text-muted">
          Sampai
          <input type="date" name="sampai" defaultValue={cari.sampai ?? ''} className="mt-1 block" />
        </label>
        <button className="btn btn-sm">Saring</button>
        {cari.pengguna || cari.tabel || cari.dari || cari.sampai ? (
          <Link href="/kontrol?tab=riwayat" className="btn-ghost btn-sm no-underline">
            Bersihkan
          </Link>
        ) : null}
      </form>

      {error ? (
        <Insight jenis="bad" judul="Riwayat tidak bisa dibaca">
          {error.message}
        </Insight>
      ) : baris.length ? (
        <>
          <GulirX>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Tabel</th>
                  <th>Aksi</th>
                  <th>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((a) => (
                  <tr key={a.id}>
                    <td className="num whitespace-nowrap">{jam(a.waktu)}</td>
                    <td>
                      {a.pengguna_id ? nama.get(a.pengguna_id) ?? '—' : 'Sistem'}
                      {a.sumber && a.sumber !== 'manual' ? <Sub>lewat {a.sumber}</Sub> : null}
                    </td>
                    <td>{a.tabel}</td>
                    <td>
                      <Pill warna={a.aksi === 'insert' ? 'hijau' : a.aksi === 'delete' ? 'merah' : 'biru'}>
                        {a.aksi === 'insert' ? 'tambah' : a.aksi === 'delete' ? 'hapus' : 'ubah'}
                      </Pill>
                    </td>
                    <td className="text-[12px]">
                      {ringkasPerubahan(a).map((r, i) => (
                        <div key={i} className="break-words">
                          {r}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GulirX>
          <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
            <span>
              {count ?? 0} catatan · halaman {hal}
            </span>
            <span className="flex gap-2">
              {hal > 1 ? (
                <Link href={url(hal - 1)} className="btn-ghost btn-sm no-underline">
                  ‹ Lebih baru
                </Link>
              ) : null}
              {(count ?? 0) > hal * per ? (
                <Link href={url(hal + 1)} className="btn-ghost btn-sm no-underline">
                  Lebih lama ›
                </Link>
              ) : null}
            </span>
          </div>
        </>
      ) : (
        <Kosong judul="Tidak ada catatan">Ubah saringan di atas.</Kosong>
      )}
    </Seksi>
  );
}

/* ---------------------------------------------------------------- BACKUP */
async function Backup() {
  const daftar = await daftarBackup();
  return (
    <Seksi
      ikon="dompet"
      judul="Backup Data"
      desk="Seluruh isi database (termasuk gaji dan riwayat perubahan) diekspor ke JSON setiap Senin pukul 01.00 WIB, disimpan di tempat privat."
    >
      <div className="mb-4">
        <TombolAksi aksi={backupSekarang} varian="btn" konfirmasi="Buat backup sekarang?">
          Backup sekarang
        </TombolAksi>
      </div>
      {daftar.length ? (
        <GulirX>
          <table className="tabel">
            <thead>
              <tr>
                <th>File</th>
                <th className="!text-right">Ukuran</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {daftar.map((f) => (
                <tr key={f.nama}>
                  <td className="font-mono text-[12px]">{f.nama}</td>
                  <td className="num text-right">{f.ukuran ? (f.ukuran / 1024).toFixed(0) + ' KB' : '—'}</td>
                  <td className="text-right">
                    <UnduhBackup nama={f.nama} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GulirX>
      ) : (
        <Kosong judul="Belum ada backup">Klik &quot;Backup sekarang&quot;, atau tunggu jadwal mingguan.</Kosong>
      )}
      <Insight judul="Memulihkan" className="!mb-0 mt-4">
        Unduh file backup, lalu jalankan <code>npm run pulihkan -- nama-file.json</code> ke database kosong. Langkah lengkapnya di
        README. File backup berisi data gaji — simpan hanya di tempat pribadi.
      </Insight>
    </Seksi>
  );
}
