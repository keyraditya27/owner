'use client';

/* eslint-disable @next/next/no-img-element -- signed URL Supabase, tidak lewat optimasi next/image */
import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { lihatBukti } from '@/app/(aplikasi)/aksi/transaksi';
import { rp, tgl } from '@/lib/format';
import type { Transaksi } from '@/lib/tipe-db';
import { usePusat } from './PusatForm';

/** Tampilkan bukti transfer lewat signed URL (bucket privat). */
export default function LihatBukti({ transaksi: t, url: awal }: { transaksi: Transaksi; url?: string }) {
  const { tutup } = usePusat();
  const [url, setUrl] = useState(awal);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (awal) return;
    lihatBukti(t.id).then((h) => (h.url ? setUrl(h.url) : setGalat(h.galat ?? 'Gagal membuka bukti.')));
  }, [awal, t.id]);

  const pdf = /\.pdf$/i.test(t.bukti_url ?? '') || /\.pdf$/i.test(t.bukti_nama ?? '');

  return (
    <Modal judul={`Bukti — ${t.keterangan}`} onTutup={tutup}>
      {galat ? <p className="text-[13px] text-merah">{galat}</p> : null}
      {!url && !galat ? <p className="text-[13px] text-muted">Membuka…</p> : null}
      {url ? (
        pdf ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn">
            Buka {t.bukti_nama ?? 'PDF'}
          </a>
        ) : (
          <img src={url} alt="Bukti transaksi" className="block max-w-full rounded-[10px]" />
        )
      ) : null}
      <div className="mt-3 text-[11.5px] text-muted">
        {tgl(t.tanggal)} · {rp(t.nominal)} · {t.kategori}
      </div>
    </Modal>
  );
}
