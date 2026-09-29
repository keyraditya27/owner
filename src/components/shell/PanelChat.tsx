'use client';

/* eslint-disable @next/next/no-img-element -- pratinjau lampiran lokal (blob URL) */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import IkonSvg from '@/components/IkonSvg';
import { usePusat } from '@/components/form/PusatForm';
import { ambilChat, ambilTransaksi, batalkanAI, bersihkanChat, type PesanChat } from '@/app/(aplikasi)/aksi/chat';
import type { JawabanChat } from '@/app/api/chat/route';

const CONTOH: [string, string][] = [
  ['saldo sekarang?', 'saldo sekarang berapa?'],
  ['siapa belum bayar?', 'siapa yang belum bayar?'],
  ['laporan bulan ini', 'laporan bulan ini'],
  ['EZCAT sudah bayar', 'EZCAT sudah bayar'],
];

/** Kecilkan foto sebelum dikirim (1100px, JPEG 72%) — sama dengan prototipe. */
async function kecilkan(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  try {
    const bmp = await createImageBitmap(file);
    const sk = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sk);
    c.height = Math.round(bmp.height * sk);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.72));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/**
 * Panel chat AI sebagai pop-up. Semua ukuran layar: tombol chat melayang di kanan bawah.
 * Diklik → desktop: jendela mengambang di kanan bawah; HP: layar penuh.
 * Tombol kecilkan (atau Esc) mengembalikannya ke tombol. Isi chat tetap tersimpan. Pesan dikirim ke /api/chat; kunci AI (NVIDIA/Gemini) tidak
 * pernah sampai ke browser.
 */
export default function PanelChat() {
  const router = useRouter();
  const { buka: bukaForm, kabar } = usePusat();
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState<PesanChat[]>([]);
  const [teks, setTeks] = useState('');
  const [lampiran, setLampiran] = useState<File | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [proses, setProses] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const inputFile = useRef<HTMLInputElement>(null);
  const kotak = useRef<HTMLTextAreaElement>(null);

  const muat = useCallback(() => ambilChat().then(setPesan).catch(() => {}), []);
  useEffect(() => {
    muat();
  }, [muat]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [pesan, proses, buka]);
  useEffect(() => {
    if (!buka) return;
    // Layar penuh hanya di HP — halaman di belakangnya jangan ikut tergulir
    const hp = !window.matchMedia('(min-width: 1080px)').matches;
    if (hp) document.body.style.overflow = 'hidden';
    kotak.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false);
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', esc);
    };
  }, [buka]);

  const pasangLampiran = (f: File | null) => {
    if (pratinjau) URL.revokeObjectURL(pratinjau);
    setLampiran(f);
    setPratinjau(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    if (inputFile.current) inputFile.current.value = '';
  };

  const kirim = async (isi?: string) => {
    const t = (isi ?? teks).trim();
    if ((!t && !lampiran) || proses) return;
    const file = lampiran;
    setTeks('');
    if (kotak.current) kotak.current.style.height = 'auto';
    pasangLampiran(null);
    setPesan((p) => [...p, { id: 'sementara', peran: 'me', isi: t || '(bukti terlampir)', bukti: !!file }]);
    setProses(true);
    try {
      const fd = new FormData();
      fd.set('teks', t);
      if (file) fd.set('gambar', await kecilkan(file));
      const r = await fetch('/api/chat', { method: 'POST', body: fd });
      const j = (await r.json()) as JawabanChat & { galat?: string };
      if (!r.ok) throw new Error(j.galat || 'Gagal mengirim');
      await muat();
      if (j.riwayatId) router.refresh();
    } catch (e) {
      setPesan((p) => [...p, { id: 'galat' + Date.now(), peran: 'ai', isi: 'Gagal: ' + (e instanceof Error ? e.message : 'coba lagi') }]);
    } finally {
      setProses(false);
    }
  };

  const batalkan = async (id: string) => {
    const h = await batalkanAI(id);
    if (h.galat) return kabar(h.galat);
    kabar('Perubahan dibatalkan');
    await muat();
    router.refresh();
  };

  const ubahTrx = async (id: string) => {
    const t = await ambilTransaksi(id);
    if (!t) return kabar('Transaksi sudah tidak ada');
    setBuka(false);
    bukaForm({ jenis: 'transaksi', data: t });
  };

  const bersihkan = async () => {
    if (!confirm('Hapus seluruh riwayat chat? Data keuangan tidak ikut terhapus.')) return;
    const h = await bersihkanChat();
    if (h.galat) return kabar(h.galat);
    setPesan([]);
  };

  return (
    <>
      {!buka ? (
        <button
          onClick={() => setBuka(true)}
          aria-label="Buka chat"
          title="Catat lewat chat"
          className="cetak-sembunyi fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-biru text-white shadow-toast transition hover:bg-biru-tua lebar:bottom-6 lebar:right-6"
        >
          <IkonSvg nama="chat" className="h-6 w-6" />
          {proses ? <span className="absolute right-1 top-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-amber" /> : null}
        </button>
      ) : null}

      {/* Tetap terpasang saat dikecilkan supaya pesan & ketikan tidak hilang */}
      <section
        aria-label="Catat lewat chat"
        className={`cetak-sembunyi ${
          buka ? 'flex' : 'hidden'
        } fixed inset-0 z-40 flex-col overflow-hidden bg-white lebar:inset-auto lebar:bottom-6 lebar:right-6 lebar:h-[min(640px,calc(100dvh-48px))] lebar:w-[400px] lebar:rounded-2xl lebar:border lebar:border-garis lebar:shadow-toast`}
      >
        <div className="pt-aman bg-navy text-white">
          <div className="flex items-center justify-between gap-2.5 px-4 py-3.5">
            <div>
              <b className="font-serif text-[14.5px]">Catat lewat chat</b>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-langit-4">
                <span className="h-[7px] w-[7px] rounded-full bg-hijau" />
                Bukti dibaca otomatis · bisa mengubah data
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={bersihkan} className="btn-hero btn-sm">
                Bersihkan
              </button>
              <button onClick={() => setBuka(false)} aria-label="Kecilkan chat" title="Kecilkan" className="rounded-lg p-1.5 text-langit-4 hover:bg-white/10 hover:text-white">
                <IkonSvg nama="kecilkan" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div ref={log} className="flex flex-1 flex-col gap-[11px] overflow-y-auto bg-[#F7FAFD] p-4" aria-live="polite">
          {!pesan.length ? <Sambutan /> : null}
          {pesan.map((m) =>
            m.peran === 'me' ? (
              <div key={m.id} className="max-w-[92%] self-end whitespace-pre-wrap rounded-xl rounded-br-[3px] bg-navy px-3 py-[9px] text-[13px] text-white">
                {m.isi}
                {m.bukti ? <div className="mt-1 text-[11px] text-langit-4">📎 bukti terlampir</div> : null}
              </div>
            ) : m.peran === 'ai' ? (
              <div key={m.id} className="max-w-[92%] self-start whitespace-pre-wrap rounded-xl rounded-bl-[3px] border border-garis bg-white px-3 py-[9px] text-[13px] text-teks2">
                {m.isi}
              </div>
            ) : (
              <KartuLog key={m.id} m={m} onBatal={batalkan} onUbah={ubahTrx} />
            ),
          )}
          {proses ? (
            <div className="self-start rounded-xl border border-garis bg-white px-3 py-[9px] text-[13px] text-muted">Memproses…</div>
          ) : null}
        </div>

        <div className="pb-aman border-t border-garis bg-white p-3">
          {lampiran ? (
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              {pratinjau ? <img src={pratinjau} alt="Bukti" className="h-9 w-9 rounded-md border border-garis object-cover" /> : null}
              <span className="min-w-0 flex-1 truncate">{lampiran.name}</span>
              <button onClick={() => pasangLampiran(null)} className="text-xs font-bold text-merah">
                Hapus
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              onClick={() => inputFile.current?.click()}
              title="Lampirkan bukti"
              aria-label="Lampirkan bukti"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-garis bg-white hover:bg-krem"
            >
              <IkonSvg nama="plus" className="h-[17px] w-[17px] text-navy" />
            </button>
            <textarea
              ref={kotak}
              rows={1}
              value={teks}
              onChange={(e) => {
                setTeks(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  kirim();
                }
              }}
              placeholder="bayar iklan meta Batik Ayman 750rb"
              aria-label="Pesan"
              className="max-h-[120px] min-h-[42px] resize-none rounded-[9px] text-[13px]"
            />
            <button
              onClick={() => kirim()}
              disabled={proses || (!teks.trim() && !lampiran)}
              title="Kirim"
              aria-label="Kirim"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] bg-biru text-white hover:bg-biru-tua disabled:opacity-50"
            >
              <IkonSvg nama="kirim" className="h-[17px] w-[17px]" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTOH.map(([label, isi]) => (
              <button
                key={label}
                onClick={() => kirim(isi)}
                disabled={proses}
                className="rounded-full border border-garis bg-krem px-2.5 py-1 text-[11.5px] text-muted hover:bg-[#E7F0FB] hover:text-navy"
              >
                {label}
              </button>
            ))}
          </div>
          <input
            ref={inputFile}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 8e6) return kabar('Ukuran file maksimal 8 MB');
              pasangLampiran(f);
            }}
          />
        </div>
      </section>
    </>
  );
}

function Sambutan() {
  return (
    <div className="max-w-[92%] self-start whitespace-pre-wrap rounded-xl rounded-bl-[3px] border border-garis bg-white px-3 py-[9px] text-[13px] text-teks2">
      {'Ketik perintah biasa — sistem langsung mengubah datanya.\n\n'}
      <b>Mencatat</b>
      {'\n• "bayar iklan meta Batik Ayman 750rb"\n• "gaji tim 12jt kemarin" + lampirkan bukti\n\n'}
      <b>Mengoreksi</b>
      {'\n• "EZCAT sudah bayar" → tagihan ditandai lunas\n• "Batik Ayman transfer 3jt" → dipotong sebagian\n• "yang top up shopee tadi bukan 4,2jt tapi 4,5jt"\n• "hapus transaksi canva"\n\n'}
      <b>Menanyakan</b>
      {'\n• "siapa belum bayar?" · "saldo sekarang?" · "laporan bulan ini"'}
    </div>
  );
}

/** Kartu ringkasan perubahan dengan tombol Batalkan — kartuLog() di prototipe. */
function KartuLog({
  m,
  onBatal,
  onUbah,
}: {
  m: Extract<PesanChat, { peran: 'log' }>;
  onBatal: (id: string) => Promise<void>;
  onUbah: (id: string) => void;
}) {
  const [proses, setProses] = useState(false);
  const ok = m.log.filter((l) => l.ok).length;
  const gagal = m.log.length - ok;
  const trx = m.log.find((l) => l.ok && l.trxId)?.trxId;
  return (
    <div
      className={`self-stretch rounded-[10px] border border-t-[3px] border-garis bg-white px-3.5 py-[13px] text-[12.5px] ${
        m.dibatalkan ? 'border-t-muted opacity-70' : gagal && !ok ? 'border-t-merah' : 'border-t-hijau'
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <b className="font-serif text-sm">
          {m.dibatalkan ? 'Dibatalkan' : `${ok} perubahan tersimpan${gagal ? ` · ${gagal} ditolak` : ''}`}
        </b>
        <span className={`pill ${m.mode === 'offline' ? 'bg-amber' : 'bg-hijau'}`}>{m.mode === 'offline' ? 'offline' : 'AI'}</span>
      </div>
      <div className="flex flex-col gap-[5px]">
        {m.log.map((l, i) => (
          <div key={i} className="flex items-start gap-[7px]">
            <span className={`font-bold leading-snug ${l.ok ? 'text-hijau' : 'text-merah'}`}>{l.ok ? '✓' : '✕'}</span>
            <span className={m.dibatalkan && l.ok ? 'line-through' : ''}>{l.teks}</span>
          </div>
        ))}
      </div>
      {m.riwayatId && !m.dibatalkan ? (
        <div className="mt-[11px] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-hijau">Semua halaman sudah ikut diperbarui</span>
          <span className="flex gap-1.5">
            {trx ? (
              <button className="btn-ghost btn-sm" onClick={() => onUbah(trx)}>
                Ubah
              </button>
            ) : null}
            <button
              className="btn-ghost btn-sm"
              disabled={proses}
              onClick={async () => {
                setProses(true);
                await onBatal(m.riwayatId!);
                setProses(false);
              }}
            >
              {proses ? 'Membatalkan…' : 'Batalkan'}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
