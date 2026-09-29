import PusatForm from '@/components/form/PusatForm';
import HeaderHP from '@/components/shell/HeaderHP';
import NavBawah from '@/components/shell/NavBawah';
import PanelChat from '@/components/shell/PanelChat';
import Sidebar from '@/components/shell/Sidebar';
import { ambilData } from '@/lib/data';
import { telat } from '@/lib/hitung';
import { wajibLogin } from '@/lib/pengguna';
import { klienServer } from '@/lib/supabase/server';

/**
 * Kerangka aplikasi, sama dengan .app di prototipe v7:
 * sidebar 230px · area utama · panel chat 380px.
 * Di bawah 1080px: bilah atas + menu bawah + chat layar penuh.
 */
export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const pengguna = await wajibLogin();
  const db = await klienServer();
  const [data, { count: menunggu }] = await Promise.all([
    ambilData(),
    // pemilik/admin melihat semua pengajuan; staf hanya miliknya (RLS)
    db.from('pengajuan').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
  ]);
  return (
    <PusatForm
      pilihan={{
        klien: data.klien,
        rekening: data.rekening,
        vendor: data.vendor,
        peran: pengguna.peran,
        penggunaId: pengguna.id,
      }}
    >
      <div className="min-h-dvh print:!block lebar:grid lebar:grid-cols-[200px_minmax(0,1fr)_330px] xl2:grid-cols-[230px_minmax(0,1fr)_380px]">
        <Sidebar pengguna={pengguna} tunggakan={telat(data).length} menunggu={menunggu ?? 0} />
        <HeaderHP pengguna={pengguna} menunggu={menunggu ?? 0} />
        <main className="min-w-0 overflow-x-hidden bg-latar p-3 pb-[calc(96px+env(safe-area-inset-bottom))] lebar:p-[22px]">
          <div className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl bg-white shadow-halaman">{children}</div>
        </main>
        <PanelChat />
        <NavBawah />
      </div>
    </PusatForm>
  );
}
