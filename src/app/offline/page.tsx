import LayarTengah from '@/components/LayarTengah';

export const metadata = { title: 'Sedang offline' };

export default function Offline() {
  return (
    <LayarTengah judul="Tidak ada koneksi" sub="Data keuangan hanya ditampilkan langsung dari server.">
      <div className="ins ins-warn">
        <h4>Sambungkan internet dulu</h4>
        <p>
          Supaya angka di HP dan desktop selalu sama, aplikasi ini tidak menyimpan data di perangkat. Setelah
          tersambung, buka ulang halaman.
        </p>
      </div>
      <a href="/ringkasan" className="btn w-full">
        Coba lagi
      </a>
    </LayarTengah>
  );
}
