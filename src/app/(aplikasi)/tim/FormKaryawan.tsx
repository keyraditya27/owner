'use client';

import { useActionState, useEffect, useRef } from 'react';
import { simpanKaryawan } from '@/app/(aplikasi)/aksi/gaji';
import type { Hasil } from '@/lib/aksi-tipe';

export default function FormKaryawan() {
  const [hasil, kirim, proses] = useActionState<Hasil, FormData>(simpanKaryawan, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (hasil.ok) formRef.current?.reset();
  }, [hasil]);

  return (
    <form ref={formRef} action={kirim} className="grid grid-cols-1 gap-[13px] sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="kNama">
          Nama
        </label>
        <input id="kNama" name="nama" required placeholder="Tasya" />
      </div>
      <div>
        <label className="label" htmlFor="kPosisi">
          Posisi
        </label>
        <input id="kPosisi" name="posisi" placeholder="Tim marketing" />
      </div>
      <div>
        <label className="label" htmlFor="kGaji">
          Gaji per bulan
        </label>
        <input id="kGaji" name="gaji" required inputMode="numeric" placeholder="1.500.000" />
      </div>
      {hasil.galat ? (
        <div className="ins ins-bad !mb-0 sm:col-span-3" role="alert">
          <p>{hasil.galat}</p>
        </div>
      ) : null}
      {hasil.pesan ? (
        <div className="ins ins-good !mb-0 sm:col-span-3" role="status">
          <p>{hasil.pesan}</p>
        </div>
      ) : null}
      <div className="sm:col-span-3">
        <button className="btn" disabled={proses}>
          {proses ? 'Menyimpan…' : 'Tambah gaji rutin'}
        </button>
      </div>
    </form>
  );
}
