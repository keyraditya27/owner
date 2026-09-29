'use client';

/** Cetak / simpan PDF lewat dialog cetak browser. Tata letak cetak diatur di globals.css (@media print). */
export default function TombolCetak() {
  return (
    <button className="btn-hero" onClick={() => window.print()}>
      Cetak / PDF
    </button>
  );
}
