import Link from 'next/link';
import KepalaHalaman from '@/components/halaman/KepalaHalaman';
import { Kosong, Pill, Seksi } from '@/components/ui';
import { ambilData } from '@/lib/data';
import { ambilDaftarDokumen } from '@/lib/dokumen';
import { rp, tgl } from '@/lib/format';
import { halamanDokumen, tabAktif } from '@/lib/navigasi';

export const metadata = { title: 'Penawaran & Invoice' };
const H = halamanDokumen('/invoice');

const WARNA = { Draf: 'abu', Terkirim: 'biru', Lunas: 'hijau', Batal: 'merah' } as const;

export default async function HalamanInvoice({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, semua, d] = await Promise.all([searchParams, ambilDaftarDokumen(), ambilData()]);
  const aktif = tabAktif(H, tab);
  const namaKlien = new Map(d.klien.map((k) => [k.id, k.nama]));
  const belum = semua.filter((x) => x.jenis === 'invoice' && x.status === 'Terkirim');
  const daftar = semua.filter((x) =>
    aktif === 'draf' ? x.status === 'Draf' : aktif === 'terkirim' ? x.status === 'Terkirim' : aktif === 'lunas' ? x.status === 'Lunas' : true
  );
  const folder = d.perusahaan?.folder_invoice_url;

  return (
    <>
      <KepalaHalaman
        halaman={H}
        aktif={aktif}
        sub={
          <>
            {semua.length} dokumen · {belum.length} invoice belum lunas <b>{rp(belum.reduce((s, x) => s + x.total, 0))}</b>
          </>
        }
        aksi={
          <>
            <Link href="/invoice/baru?jenis=invoice" className="btn-hero">
              Invoice baru
            </Link>
            <Link href="/invoice/baru?jenis=penawaran" className="btn-hero">
              Penawaran baru
            </Link>
            {folder ? (
              <a href={folder} target="_blank" rel="noreferrer" className="btn-hero">
                Folder Drive
              </a>
            ) : null}
          </>
        }
        lencana={{ draf: semua.filter((x) => x.status === 'Draf').length || '', terkirim: belum.length || '' }}
      />
      <Seksi ikon="dok" judul="Dokumen" desk="Invoice yang diterbitkan otomatis masuk Piutang Klien. Saat ditandai lunas, transaksi masuk tercatat sendiri — jangan dicatat ulang di Transaksi.">
        {daftar.length ? (
          <div className="overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Klien</th>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th className="!text-right">Total</th>
                  <th className="!text-right">Ditransfer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/invoice/${x.id}`} className="font-semibold">
                        {x.nomor ?? 'Draf (nomor saat terbit)'}
                      </Link>
                    </td>
                    <td>{(x.klien_id && namaKlien.get(x.klien_id)) || '—'}</td>
                    <td className="num">{tgl(x.tanggal)}</td>
                    <td>{x.jenis === 'invoice' ? 'Invoice' : 'Penawaran'}</td>
                    <td className="num text-right">{rp(x.total)}</td>
                    <td className="num text-right">{rp(x.diterima)}</td>
                    <td>
                      <Pill warna={WARNA[x.status]}>{x.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Kosong judul="Belum ada dokumen">Mulai dari tombol Invoice baru. Isi katalog layanan dulu supaya tinggal pilih.</Kosong>
        )}
      </Seksi>
    </>
  );
}
