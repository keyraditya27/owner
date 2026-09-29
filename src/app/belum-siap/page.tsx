import LayarTengah from '@/components/LayarTengah';

export const metadata = { title: 'Belum tersambung' };

export default function BelumSiap() {
  return (
    <LayarTengah judul="Belum tersambung ke database" sub="Kunci Supabase belum diisi.">
      <div className="ins ins-warn">
        <h4>Yang perlu diisi</h4>
        <p>
          <b>NEXT_PUBLIC_SUPABASE_URL</b> dan <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> — di <code>.env.local</code> kalau
          dijalankan di komputer, atau di Vercel → Settings → Environment Variables kalau sudah online. Langkahnya ada
          di PANDUAN-PEMULA.md langkah 4 dan 7.
        </p>
      </div>
    </LayarTengah>
  );
}
