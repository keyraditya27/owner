'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { simpanProfilInvoice } from '@/app/(aplikasi)/aksi/invoice';
import { Grid, Isian, PesanGalat } from '@/components/form/Isian';
import { usePusat } from '@/components/form/PusatForm';
import type { Perusahaan } from '@/lib/tipe-db';

const KOLOM = [
  ['telp', 'Telepon / WA'],
  ['email', 'Email'],
  ['bank', 'Bank'],
  ['no_rekening', 'Nomor rekening'],
  ['atas_nama', 'Atas nama rekening'],
  ['penanda_tangan', 'Nama penanda tangan'],
  ['jabatan_ttd', 'Jabatan penanda tangan'],
  ['folder_invoice_url', 'Folder Google Drive invoice'],
] as const;

/** Data yang tampil di kop & kotak pembayaran invoice. Nama, alamat, NPWP diubah di Pajak → profil perusahaan. */
export default function FormKop({ p }: { p: Perusahaan }) {
  const { bolehKelola, kabar } = usePusat();
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState('');
  const [f, setF] = useState<Record<string, string>>(
    Object.fromEntries(KOLOM.map(([k]) => [k, (p[k] as string | null | undefined) ?? '']))
  );
  return (
    <div>
      <PesanGalat teks={galat} />
      <Grid>
        {KOLOM.map(([k, label]) => (
          <Isian key={k} label={label} penuh={k === 'folder_invoice_url'}>
            <input
              value={f[k]}
              disabled={!bolehKelola}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              placeholder={k === 'folder_invoice_url' ? 'https://drive.google.com/drive/folders/…' : ''}
            />
          </Isian>
        ))}
      </Grid>
      {bolehKelola ? (
        <button
          className="btn mt-4"
          disabled={proses}
          onClick={() =>
            mulai(async () => {
              setGalat('');
              const h = await simpanProfilInvoice({ ...f, id: p.id });
              if (h.galat) return setGalat(h.galat);
              kabar('Kop invoice tersimpan');
              router.refresh();
            })
          }
        >
          {proses ? 'Menyimpan…' : 'Simpan'}
        </button>
      ) : null}
    </div>
  );
}
