'use client';

import { useActionState, useEffect, useRef } from 'react';
import { tambahAnggota, type HasilTambah } from './actions';

export default function FormAnggota() {
  const [hasil, kirim, proses] = useActionState<HasilTambah, FormData>(tambahAnggota, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (hasil.sukses) formRef.current?.reset();
  }, [hasil]);

  return (
    <form ref={formRef} action={kirim} className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="nama">
          Nama
        </label>
        <input id="nama" name="nama" required placeholder="Tasya" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required inputMode="email" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password sementara
        </label>
        <input id="password" name="password" type="text" minLength={10} required autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="peran">
          Peran
        </label>
        <select id="peran" name="peran" defaultValue="staf">
          <option value="staf">Staf — transaksi milik sendiri</option>
          <option value="admin">Admin — hampir setara pemilik</option>
        </select>
      </div>
      {hasil.galat ? (
        <div className="ins ins-bad !mb-0 sm:col-span-2" role="alert">
          <p>{hasil.galat}</p>
        </div>
      ) : null}
      {hasil.sukses ? (
        <div className="ins ins-good !mb-0 sm:col-span-2" role="status">
          <p>{hasil.sukses}</p>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <button className="btn" disabled={proses}>
          {proses ? 'Menyimpan…' : 'Tambah anggota'}
        </button>
      </div>
    </form>
  );
}
