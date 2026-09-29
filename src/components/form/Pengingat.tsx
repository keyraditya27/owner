'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { hariSelisih, rp, tgl } from '@/lib/format';
import type { TagihanTerbuka } from '@/lib/hitung';
import type { Klien } from '@/lib/tipe-db';
import { usePusat } from './PusatForm';

type Nada = 'halus' | 'menagih' | 'tegas';

/** Teks pengingat — susunPesan() di prototipe, nadanya menyesuaikan lama telat. */
function susunPesan(k: Klien, list: TagihanTerbuka[], total: number, d: number, nada: Nada) {
  const rincian = list.map((i) => `• ${i.periode} — ${rp(i.sisa)} (jatuh tempo ${tgl(i.jatuh_tempo)})`).join('\n');
  const sapa = `Selamat pagi ${k.pic || 'Bapak/Ibu'},`;
  const paket = k.paket || 'layanan';
  if (nada === 'halus')
    return `${sapa}\n\nSaya dari Arah Ruang Langit. Mengingatkan tagihan ${paket} berikut:\n\n${rincian}\n\nTotal ${rp(total)}. Kalau invoice atau rekap performanya perlu dikirim ulang, saya siapkan hari ini.\n\nTerima kasih banyak.`;
  if (nada === 'menagih')
    return `${sapa}\n\nMenindaklanjuti tagihan ${paket} yang sudah melewati jatuh tempo:\n\n${rincian}\n\nTotal ${rp(total)}. Boleh dibantu info perkiraan tanggal pembayarannya, supaya kami bisa mengatur jadwal pengerjaan bulan berjalan?\n\nTerima kasih.`;
  return `${sapa}\n\nTagihan ${paket} berikut sudah telat ${Math.abs(d)} hari:\n\n${rincian}\n\nTotal ${rp(total)}. Mohon konfirmasi tanggal pembayarannya. Bila sampai akhir pekan ini belum ada kabar, kami perlu menahan sementara pengerjaan bulan berjalan.\n\nTerima kasih atas perhatiannya.`;
}

export function Pengingat({ klien, tagihan }: { klien: Klien; tagihan: TagihanTerbuka[] }) {
  const { tutup, kabar, buka } = usePusat();
  const total = tagihan.reduce((s, i) => s + i.sisa, 0);
  const utama = tagihan[0];
  const d = hariSelisih(utama.jatuh_tempo);
  const nada: Nada = d < -14 ? 'tegas' : d < 0 ? 'menagih' : 'halus';
  const [pesan, setPesan] = useState(() => susunPesan(klien, tagihan, total, d, nada));

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(pesan);
      kabar('Teks disalin');
    } catch {
      kabar('Tidak bisa menyalin otomatis — salin manual dari kotak teks');
    }
  };

  return (
    <Modal
      judul={`Pengingat — ${klien.nama}`}
      onTutup={tutup}
      kaki={
        <>
          <button className="btn-ghost" onClick={salin}>
            Salin teks
          </button>
          {klien.wa ? (
            <a
              className="btn !bg-hijau !text-white no-underline hover:!bg-hijau-tua"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/${klien.wa}?text=${encodeURIComponent(pesan)}`}
            >
              Kirim via WhatsApp
            </a>
          ) : (
            <button className="btn-ghost" onClick={() => buka({ jenis: 'klien', data: klien })}>
              Isi nomor WhatsApp
            </button>
          )}
        </>
      }
    >
      <div className={`ins ${d < -14 ? 'ins-bad' : d < 0 ? 'ins-warn' : ''}`}>
        <h4>
          {tagihan.length} tagihan · {rp(total)}
        </h4>
        <p>
          {d < 0 ? (
            <>
              Terlama telat <b>{Math.abs(d)} hari</b> ({utama.periode}).
            </>
          ) : (
            <>Jatuh tempo terdekat {tgl(utama.jatuh_tempo)}.</>
          )}{' '}
          Nada pesan disesuaikan: <b>{nada}</b>.
        </p>
      </div>
      <textarea
        rows={13}
        value={pesan}
        onChange={(e) => setPesan(e.target.value)}
        className="!bg-krem !text-[13px] leading-relaxed"
      />
    </Modal>
  );
}

export function PengingatMassal({ telat }: { telat: TagihanTerbuka[] }) {
  const { tutup, buka, klien } = usePusat();
  const perKlien = new Map<string, TagihanTerbuka[]>();
  telat.forEach((i) => perKlien.set(i.klien_id, [...(perKlien.get(i.klien_id) ?? []), i]));

  return (
    <Modal
      judul={`Pengingat Massal — ${telat.length} tagihan telat`}
      onTutup={tutup}
      kaki={
        <button className="btn-ghost" onClick={tutup}>
          Tutup
        </button>
      }
    >
      <p className="mb-3.5 text-[13px] text-muted">Buat satu per satu supaya pesannya tetap personal.</p>
      <table className="tabel">
        <thead>
          <tr>
            <th>Klien</th>
            <th className="text-right">Total Telat</th>
            <th>Terlama</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...perKlien.entries()].map(([id, arr]) => {
            const k = klien.find((x) => x.id === id);
            if (!k) return null;
            return (
              <tr key={id}>
                <td className="font-semibold">{k.nama}</td>
                <td className="num text-right">{rp(arr.reduce((s, i) => s + i.sisa, 0))}</td>
                <td>
                  <span className="pill bg-merah">{Math.abs(hariSelisih(arr[0].jatuh_tempo))} hari</span>
                </td>
                <td className="text-right">
                  <button className="btn btn-sm" onClick={() => buka({ jenis: 'pengingat', klien: k, tagihan: arr })}>
                    Buat
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}
