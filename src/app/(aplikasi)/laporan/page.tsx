import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Laporan' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/laporan" tab={tab} tahap={4} />;
}
