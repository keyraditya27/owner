import HalamanKerangka from '@/components/halaman/HalamanKerangka';

export const metadata = { title: 'Ringkasan' };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <HalamanKerangka href="/ringkasan" tab={tab} tahap={2} />;
}
