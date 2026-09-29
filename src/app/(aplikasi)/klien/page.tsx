import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Klien & Tagihan' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/klien" tab={tab} tahap={2} />;
}
