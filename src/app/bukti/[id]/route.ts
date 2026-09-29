import { NextResponse, type NextRequest } from 'next/server';
import { klienAdmin } from '@/lib/supabase/admin';
import { klienServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Tautan bukti di kolom J tab Transaksi. Sheet bisa dibuka siapa saja yang punya
 * tautannya, jadi yang ditulis ke sana tautan ke aplikasi, bukan ke file.
 * Di sini: wajib login (middleware), baris dibaca dengan sesi pengguna (RLS),
 * baru dibuatkan signed URL 60 detik dan dialihkan.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Tidak ditemukan', { status: 404 });
  const db = await klienServer();
  const { data } = await db.from('transaksi').select('bukti_url').eq('id', id).maybeSingle();
  if (!data?.bukti_url) return new NextResponse('Bukti tidak ditemukan, atau akun ini tidak boleh melihatnya.', { status: 404 });
  const { data: url } = await klienAdmin().storage.from('bukti').createSignedUrl(data.bukti_url, 60);
  if (!url?.signedUrl) return new NextResponse('File bukti tidak bisa dibuka.', { status: 404 });
  return NextResponse.redirect(url.signedUrl);
}
