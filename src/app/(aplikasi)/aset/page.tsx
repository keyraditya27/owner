import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Aset & Inventaris' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/aset" tab={tab} tahap={4} />;
}
