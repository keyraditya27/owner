import HeaderHP from '@/components/shell/HeaderHP';
import NavBawah from '@/components/shell/NavBawah';
import PanelChat from '@/components/shell/PanelChat';
import Sidebar from '@/components/shell/Sidebar';
import { wajibLogin } from '@/lib/pengguna';

/**
 * Kerangka aplikasi, sama dengan .app di prototipe v7:
 * sidebar 230px · area utama · panel chat 380px.
 * Di bawah 1080px: bilah atas + menu bawah + chat layar penuh.
 */
export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const pengguna = await wajibLogin();
  return (
    <div className="min-h-dvh lebar:grid lebar:grid-cols-[200px_minmax(0,1fr)_330px] xl2:grid-cols-[230px_minmax(0,1fr)_380px]">
      <Sidebar pengguna={pengguna} />
      <HeaderHP pengguna={pengguna} />
      <main className="min-w-0 overflow-x-hidden bg-latar p-3 pb-[calc(96px+env(safe-area-inset-bottom))] lebar:p-[22px]">
        <div className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl bg-white shadow-halaman">{children}</div>
      </main>
      <PanelChat />
      <NavBawah />
    </div>
  );
}
