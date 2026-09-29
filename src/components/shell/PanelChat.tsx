'use client';

import { useEffect, useState } from 'react';
import IkonSvg from '@/components/IkonSvg';

const CONTOH = ['saldo sekarang?', 'siapa belum bayar?', 'laporan bulan ini', 'EZCAT sudah bayar'];

/**
 * Panel chat AI. Desktop: menempel di kanan, selalu terlihat (CLAUDE.md).
 * HP: tombol melayang yang membuka chat layar penuh.
 * Tahap 1 hanya kerangka — pengiriman ke /api/chat dibangun di Tahap 3.
 */
export default function PanelChat() {
  const [bukaHP, setBukaHP] = useState(false);

  // Kunci gulir halaman di belakang saat chat layar penuh terbuka di HP.
  useEffect(() => {
    document.body.style.overflow = bukaHP ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [bukaHP]);

  return (
    <>
      <button
        onClick={() => setBukaHP(true)}
        aria-label="Buka chat"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-biru text-white shadow-toast lebar:hidden"
      >
        <IkonSvg nama="chat" className="h-6 w-6" />
      </button>

      <section
        aria-label="Catat lewat chat"
        className={`${
          bukaHP ? 'fixed inset-0 z-40 flex' : 'hidden'
        } flex-col bg-white lebar:sticky lebar:top-0 lebar:z-auto lebar:flex lebar:h-dvh lebar:border-l lebar:border-garis`}
      >
        <div className="pt-aman bg-navy text-white">
          <div className="flex items-center justify-between gap-2.5 px-4 py-3.5">
            <div>
              <b className="font-serif text-[14.5px]">Catat lewat chat</b>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-langit-4">
                <span className="h-[7px] w-[7px] rounded-full bg-amber" />
                Belum aktif · dibangun di Tahap 3
              </div>
            </div>
            <button
              onClick={() => setBukaHP(false)}
              aria-label="Tutup chat"
              className="rounded-lg p-1.5 text-langit-4 hover:text-white lebar:hidden"
            >
              <IkonSvg nama="tutup" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-[11px] overflow-y-auto bg-[#F7FAFD] p-4">
          <div className="max-w-[92%] self-start whitespace-pre-wrap rounded-xl rounded-bl-[3px] border border-garis bg-white px-3 py-[9px] text-[13px] text-teks2">
            {'Ketik perintah biasa — sistem langsung mengubah datanya.\n\n'}
            <b>Mencatat</b>
            {'\n• "bayar iklan meta Batik Ayman 750rb"\n• "gaji tim 12jt kemarin" + lampirkan bukti\n\n'}
            <b>Mengoreksi</b>
            {'\n• "EZCAT sudah bayar" → tagihan ditandai lunas\n• "Batik Ayman transfer 3jt" → dipotong sebagian\n• "yang top up shopee tadi bukan 4,2jt tapi 4,5jt"\n• "hapus transaksi canva"\n\n'}
            <b>Menanyakan</b>
            {'\n• "siapa belum bayar?" · "saldo sekarang?" · "laporan bulan ini"'}
          </div>
        </div>

        <div className="pb-aman border-t border-garis bg-white p-3">
          <div className="flex items-end gap-2">
            <button
              disabled
              title="Lampirkan bukti"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-garis bg-white disabled:opacity-50"
            >
              <IkonSvg nama="plus" className="h-[17px] w-[17px] text-navy" />
            </button>
            <textarea
              rows={1}
              disabled
              placeholder="Contoh: bayar iklan meta Batik Ayman 750rb"
              className="min-h-[42px] resize-none rounded-[9px] text-[13px] disabled:bg-krem"
            />
            <button
              disabled
              title="Kirim"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] bg-biru text-white disabled:opacity-50"
            >
              <IkonSvg nama="kirim" className="h-[17px] w-[17px]" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTOH.map((c) => (
              <span
                key={c}
                className="rounded-full border border-garis bg-krem px-2.5 py-1 text-[11.5px] text-muted"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
