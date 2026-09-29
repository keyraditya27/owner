'use client';

import { useActionState } from 'react';
import { buatPemilik, type HasilMulai } from './actions';

export default function FormMulai() {
  const [hasil, kirim, proses] = useActionState<HasilMulai, FormData>(buatPemilik, {});
  return (
    <form action={kirim} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="nama">
          Nama
        </label>
        <input id="nama" name="nama" defaultValue="Key" required autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password (minimal 10 karakter)
        </label>
        <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
      </div>
      {hasil.galat ? (
        <div className="ins ins-bad !mb-0" role="alert">
          <p>{hasil.galat}</p>
        </div>
      ) : null}
      <button className="btn mt-1 w-full" disabled={proses}>
        {proses ? 'Membuat akun…' : 'Buat akun pemilik'}
      </button>
    </form>
  );
}
