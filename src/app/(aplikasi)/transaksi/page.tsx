import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Transaksi' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/transaksi" tab={tab} tahap={2} />;
}
