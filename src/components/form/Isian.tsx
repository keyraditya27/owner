'use client';

/** Potongan form bersama: label gaya prototipe, input rupiah, grid dua kolom. */

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">{children}</div>;
}

export function Isian({
  label,
  penuh,
  children,
  htmlFor,
}: {
  label: string;
  penuh?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={penuh ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

const format = (digit: string) => (digit ? Number(digit).toLocaleString('id-ID') : '');

/**
 * Input rupiah: di layar tampil "1.500.000", yang disimpan hanya digit "1500000".
 * Keyboard angka di HP (inputMode numeric). Tidak menerima sen.
 */
export function InputRupiah({
  nilai,
  ubah,
  id,
  bolehNegatif = false,
}: {
  nilai: string;
  ubah: (digit: string) => void;
  id?: string;
  bolehNegatif?: boolean;
}) {
  const neg = bolehNegatif && nilai.startsWith('-');
  const digit = nilai.replace(/\D/g, '');
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        className="num !pl-8"
        value={(neg ? '-' : '') + format(digit)}
        onChange={(e) => {
          const v = e.target.value;
          const n = bolehNegatif && v.trim().startsWith('-');
          ubah((n ? '-' : '') + v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15));
        }}
        autoComplete="off"
      />
    </div>
  );
}

export function PesanGalat({ teks }: { teks?: string }) {
  if (!teks) return null;
  return (
    <div className="ins ins-bad !mb-0 mt-3.5" role="alert">
      <p>{teks}</p>
    </div>
  );
}
