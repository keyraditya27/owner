'use client';

/**
 * Galat saat memuat halaman. Di produksi Next.js menyembunyikan pesan aslinya,
 * jadi yang ditampilkan petunjuk umum; detailnya ada di log server (Vercel → Logs).
 */
export default function Galat({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="px-[18px] py-[22px] lebar:px-9 lebar:py-7">
      <div className="ins ins-bad">
        <h4>Halaman gagal dimuat</h4>
        <p>
          Biasanya karena koneksi ke database terputus, atau ada file SQL di README yang belum dijalankan di Supabase.
          Coba lagi; kalau tetap gagal, periksa log di Vercel.
        </p>
      </div>
      <button className="btn" onClick={reset}>
        Coba lagi
      </button>
    </section>
  );
}
