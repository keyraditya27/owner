'use client';

import { useActionState } from 'react';
import { masuk, type HasilLogin } from './actions';

export default function FormLogin({ lanjut }: { lanjut: string }) {
  const [hasil, kirim, proses] = useActionState<HasilLogin, FormData>(masuk, {});
  return (
    <form action={kirim} className="flex flex-col gap-3">
      <input type="hidden" name="lanjut" value={lanjut} />
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {hasil.galat ? (
        <div className="ins ins-bad !mb-0" role="alert">
          <p>{hasil.galat}</p>
        </div>
      ) : null}
      <button className="btn mt-1 w-full" disabled={proses}>
        {proses ? 'Memeriksa…' : 'Masuk'}
      </button>
    </form>
  );
}
