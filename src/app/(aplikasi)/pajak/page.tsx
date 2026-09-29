import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Pajak' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/pajak" tab={tab} tahap={4} />;
}
