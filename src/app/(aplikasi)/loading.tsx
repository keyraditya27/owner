/**
 * Tampil seketika saat pindah menu, selagi server mengambil data halaman berikutnya.
 * Tanpa ini, klik menu terasa diam sampai seluruh halaman selesai dimuat.
 */
export default function Memuat() {
  return (
    <div aria-busy="true" aria-label="Memuat">
      <div className="bg-hero px-[18px] py-6 lebar:px-9 lebar:py-[30px]">
        <div className="h-[26px] w-40 animate-pulse rounded-full bg-white/15" />
        <div className="mt-5 h-7 w-64 max-w-full animate-pulse rounded-md bg-white/20" />
        <div className="mt-2.5 h-4 w-80 max-w-full animate-pulse rounded bg-white/10" />
      </div>
      <div className="px-[18px] py-[22px] lebar:px-9 lebar:py-7">
        <div className="grid grid-cols-1 gap-3.5 min-[621px]:grid-cols-2 min-[1081px]:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[10px] border border-garis bg-krem" />
          ))}
        </div>
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-krem" />
          ))}
        </div>
      </div>
    </div>
  );
}
