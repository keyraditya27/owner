"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  batalkanDokumen,
  hapusDokumen,
  lunasiInvoice,
  simpanDokumen,
  terbitkanDokumen,
} from "@/app/(aplikasi)/aksi/invoice";
import { InputRupiah, PesanGalat } from "@/components/form/Isian";
import { usePusat } from "@/components/form/PusatForm";
import {
  PORSI,
  SATUAN,
  hitungInvoice,
  nilaiBaris,
  type BarisInv,
  type Porsi,
} from "@/lib/invoice";
import type { Dokumen, Kelompok, Layanan } from "@/lib/dokumen";
import type { Klien, Perusahaan } from "@/lib/tipe-db";
import type { Hasil } from "@/lib/aksi-tipe";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const tglID = (i: string) =>
  i
    ? new Date(i + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
function tambahHari(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + (n || 0));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** pilih = dicentang masuk invoice. Yang tidak dicentang tidak dicetak & tidak disimpan. */
type Baris = BarisInv & { kunci: string; pilih: boolean };

const dariLayanan = (
  l: Layanan,
  g: Kelompok | undefined,
  qty: number,
  pilih = false,
): Baris => ({
  kunci: l.id,
  pilih,
  layanan_id: l.id,
  kelompok: g?.nama ?? null,
  nama: l.nama,
  deskripsi: l.deskripsi,
  satuan: l.satuan,
  qty,
  harga: l.harga,
  diskon_persen: 0,
  berulang: l.berulang,
});

export default function Penyusun({
  jenis,
  awal,
  hariIni,
  klien,
  rekening,
  perusahaan,
  kelompok,
  layanan,
}: {
  jenis: "invoice" | "penawaran";
  awal: { dok: Dokumen; baris: BarisInv[] } | null;
  hariIni: string;
  klien: Klien[];
  rekening: { id: string; nama: string }[];
  perusahaan: Perusahaan | null;
  kelompok: Kelompok[];
  layanan: Layanan[];
}) {
  const { bolehKelola, bolehHapus, kabar, buka } = usePusat();
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [galat, setGalat] = useState("");
  const g = (id: string) => kelompok.find((x) => x.id === id);

  const dok = awal?.dok;
  const draf = !dok || dok.status === "Draf";
  const [f, setF] = useState({
    klien_id: dok?.klien_id ?? "",
    tanggal: dok?.tanggal ?? hariIni,
    tempo_hari: dok?.tempo_hari ?? 7,
    durasi_bulan: dok?.durasi_bulan ?? 1,
    porsi: dok?.porsi ?? "standar",
    diskon: dok?.diskon ?? 0,
    diskon_tipe: dok?.diskon_tipe ?? ("rp" as "rp" | "pct"),
    ppn_aktif: dok?.ppn_aktif ?? !!perusahaan?.pkp,
    pph23: dok?.pph23 ?? false,
    catatan: dok?.catatan ?? "",
  });
  // Baris: yang tersimpan (salinan) + layanan katalog lain dengan jumlah 0 supaya bisa ditambah.
  const [baris, setBaris] = useState<Baris[]>(() => {
    if (awal) {
      const ada = awal.baris.map((b, i) => ({
        ...b,
        kunci: b.layanan_id ?? `bebas-${i}`,
        pilih: true,
      }));
      if (!draf) return ada;
      const sisa = layanan
        .filter((l) => !ada.some((b) => b.layanan_id === l.id))
        .map((l) =>
          dariLayanan(l, g(l.kelompok_id), Math.max(1, l.porsi_standar)),
        );
      return [...ada, ...sisa];
    }
    // Invoice baru: belum ada yang dicentang — centang layanan yang dipakai klien saja.
    return layanan.map((l) =>
      dariLayanan(l, g(l.kelompok_id), Math.max(1, l.porsi_standar)),
    );
  });

  const dipilih = useMemo(() => baris.filter((b) => b.pilih), [baris]);
  const h = useMemo(() => hitungInvoice(f, dipilih), [f, dipilih]);
  const kl = klien.find((k) => k.id === f.klien_id);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const ubahBaris = (kunci: string, d: Partial<Baris>) => {
    setBaris((bs) => bs.map((b) => (b.kunci === kunci ? { ...b, ...d } : b)));
    if ("qty" in d) set("porsi", "kustom");
  };

  const terapkanPorsi = (p: Porsi) => {
    setBaris((bs) =>
      bs.map((b) => {
        const l = layanan.find((x) => x.id === b.layanan_id);
        if (!l) return b; // baris bebas tidak diubah
        const qty =
          p === "hemat"
            ? l.porsi_hemat
            : p === "premium"
              ? l.porsi_premium
              : l.porsi_standar;
        return b.pilih ? { ...b, qty } : { ...b, qty: Math.max(1, qty) };
      }),
    );
    set("porsi", p);
  };

  const pilihKlien = (id: string) => {
    const k = klien.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      klien_id: id,
      pph23: !!k?.potong_pph23,
      tempo_hari: k?.tempo_hari ?? x.tempo_hari,
    }));
  };

  // Klien baru dari tombol "+ Klien baru": begitu muncul di daftar, langsung dipilih.
  const idKlienLama = useRef(new Set(klien.map((k) => k.id)));
  const tungguKlienBaru = useRef(false);
  useEffect(() => {
    const baru = klien.find((k) => !idKlienLama.current.has(k.id));
    idKlienLama.current = new Set(klien.map((k) => k.id));
    if (baru && tungguKlienBaru.current) {
      tungguKlienBaru.current = false;
      pilihKlien(baru.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klien]);

  const tambahBebas = () =>
    setBaris((bs) => [
      ...bs,
      {
        kunci: `bebas-${Date.now()}`,
        pilih: true,
        layanan_id: null,
        kelompok: "Lainnya",
        nama: "",
        deskripsi: null,
        satuan: "unit",
        qty: 1,
        harga: 0,
        diskon_persen: 0,
        berulang: false,
      },
    ]);

  const muatan = () => ({
    ...f,
    id: dok?.id,
    jenis,
    baris: dipilih.filter((b) => b.qty > 0),
  });

  const jalan = (
    fn: () => Promise<Hasil>,
    pesan: string,
    konfirmasi?: string,
    ke?: (h: Hasil) => string | null,
  ) =>
    mulai(async () => {
      if (konfirmasi && !confirm(konfirmasi)) return;
      setGalat("");
      const r = await fn();
      if (r.galat) return setGalat(r.galat);
      kabar(r.pesan ?? pesan);
      const tujuan = ke?.(r);
      if (tujuan) router.push(tujuan);
      else router.refresh();
    });

  const simpan = () =>
    jalan(
      () => simpanDokumen(muatan()),
      "Draf tersimpan",
      undefined,
      (r) => (!dok && r.id ? `/invoice/${r.id}` : null),
    );
  const terbit = () =>
    jalan(
      async () => {
        const s = await simpanDokumen(muatan());
        if (s.galat || !s.id) return s;
        const t = await terbitkanDokumen(s.id);
        return t.galat ? t : { ...t, id: s.id };
      },
      "Diterbitkan",
      jenis === "invoice"
        ? `Terbitkan invoice ${rp(h.total)} untuk ${kl?.nama ?? "—"}? Nomor diberikan dan tagihan masuk Piutang Klien. Setelah terbit tidak bisa diubah.`
        : "Terbitkan penawaran ini? Setelah terbit tidak bisa diubah.",
      (r) => (!dok && r.id ? `/invoice/${r.id}` : null),
    );

  const [bayar, setBayar] = useState({
    tanggal: hariIni,
    rekening_id: rekening[0]?.id ?? "",
  });

  const grup = useMemo(() => {
    const m = new Map<string, Baris[]>();
    for (const b of baris) {
      const k = b.kelompok || "Lainnya";
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()];
  }, [baris]);

  return (
    <div className="grid grid-cols-1 xl2:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- penyusun ---------------- */}
      <section className="cetak-sembunyi border-b border-garis px-[18px] py-[22px] lebar:px-9 xl2:border-b-0 xl2:border-r">
        <PesanGalat teks={galat} />
        {!draf ? (
          <div className="ins ins-good mb-4">
            <p>
              Status <b>{dok?.status}</b>. Dokumen yang sudah terbit dikunci
              supaya sama dengan yang dikirim ke klien.
            </p>
          </div>
        ) : null}

        <fieldset disabled={!draf || proses} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Klien</label>
              <div className="flex gap-2">
                <select
                  value={f.klien_id}
                  onChange={(e) => pilihKlien(e.target.value)}
                >
                  <option value="">— pilih klien —</option>
                  {klien.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
                {bolehKelola ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm shrink-0 whitespace-nowrap"
                    onClick={() => {
                      tungguKlienBaru.current = true;
                      buka({ jenis: "klien" });
                    }}
                  >
                    + Klien baru
                  </button>
                ) : null}
              </div>
            </div>
            <div>
              <label className="label">Tanggal</label>
              <input
                type="date"
                value={f.tanggal}
                onChange={(e) => set("tanggal", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Tempo (hari)</label>
              <input
                inputMode="numeric"
                value={f.tempo_hari}
                onChange={(e) =>
                  set(
                    "tempo_hari",
                    Number(e.target.value.replace(/\D/g, "") || 0),
                  )
                }
              />
            </div>
          </div>

          <div>
            <label className="label">Porsi</label>
            <div className="flex flex-wrap gap-2">
              {PORSI.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.desc}
                  onClick={() => terapkanPorsi(p.id)}
                  className={
                    f.porsi === p.id ? "btn btn-sm" : "btn-ghost btn-sm"
                  }
                >
                  {p.nama}
                </button>
              ))}
              {f.porsi === "kustom" ? (
                <span className="self-center text-[12px] text-muted">
                  kustom
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <label className="label">
              Durasi kontrak: {f.durasi_bulan} bulan
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() =>
                  set("durasi_bulan", Math.max(1, f.durasi_bulan - 1))
                }
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={12}
                value={f.durasi_bulan}
                onChange={(e) => set("durasi_bulan", Number(e.target.value))}
                className="flex-1"
              />
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() =>
                  set("durasi_bulan", Math.min(36, f.durasi_bulan + 1))
                }
              >
                +
              </button>
            </div>
          </div>

          <p className="-mb-2 text-[12.5px] text-muted">
            Centang layanan yang dipakai klien — hanya yang dicentang masuk
            invoice &amp; PDF ({dipilih.length} dipilih).
          </p>
          {grup.map(([nama, rows]) => (
            <div key={nama}>
              <div className="rounded-t-md bg-navy px-3 py-1.5 text-[11px] font-bold tracking-[1.5px] text-white">
                {nama.toUpperCase()}
              </div>
              {rows.map((b) => (
                <div
                  key={b.kunci}
                  className={`border-b border-garis px-1 py-2 ${b.pilih && b.qty > 0 ? "" : "opacity-55"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      className="!w-auto h-[17px] w-[17px] accent-biru"
                      aria-label={`Masukkan ${b.nama || "baris"} ke invoice`}
                      checked={b.pilih}
                      onChange={(e) =>
                        ubahBaris(b.kunci, { pilih: e.target.checked })
                      }
                    />
                    {b.layanan_id ? (
                      <div className="min-w-[140px] flex-1 text-[13px] font-semibold">
                        {b.nama}
                      </div>
                    ) : (
                      <input
                        className="min-w-[140px] flex-1"
                        placeholder="Nama item di luar katalog"
                        value={b.nama}
                        onChange={(e) =>
                          ubahBaris(b.kunci, { nama: e.target.value })
                        }
                      />
                    )}
                    {b.pilih ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() =>
                            ubahBaris(b.kunci, { qty: Math.max(0, b.qty - 1) })
                          }
                        >
                          −
                        </button>
                        <span className="num w-8 text-center text-[13px]">
                          {b.qty}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => ubahBaris(b.kunci, { qty: b.qty + 1 })}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                    {b.pilih ? (
                      <span className="num w-28 text-right text-[13px] font-bold">
                        {rp(nilaiBaris(b, f.durasi_bulan))}
                      </span>
                    ) : null}
                  </div>
                  {b.pilih && b.qty > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      {b.layanan_id ? (
                        <span>
                          {rp(b.harga)} / {b.satuan}
                        </span>
                      ) : (
                        <>
                          <div className="w-32">
                            <InputRupiah
                              nilai={String(b.harga || "")}
                              ubah={(v) =>
                                ubahBaris(b.kunci, { harga: Number(v || 0) })
                              }
                            />
                          </div>
                          <select
                            className="!w-24"
                            value={b.satuan}
                            onChange={(e) =>
                              ubahBaris(b.kunci, { satuan: e.target.value })
                            }
                          >
                            {SATUAN.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </>
                      )}
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="!w-auto"
                          checked={b.berulang}
                          onChange={(e) =>
                            ubahBaris(b.kunci, { berulang: e.target.checked })
                          }
                        />
                        tiap bulan
                      </label>
                      <label className="flex items-center gap-1">
                        diskon
                        <input
                          inputMode="numeric"
                          className="!w-14"
                          value={b.diskon_persen || ""}
                          onChange={(e) =>
                            ubahBaris(b.kunci, {
                              diskon_persen: Math.min(
                                100,
                                Number(e.target.value.replace(/\D/g, "") || 0),
                              ),
                            })
                          }
                        />
                        %
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost btn-sm self-start"
            onClick={tambahBebas}
          >
            + Baris bebas (di luar katalog)
          </button>
          {layanan.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              Katalog masih kosong — isi di menu Katalog Layanan, atau pakai
              baris bebas.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Diskon total</label>
              <div className="flex gap-2">
                <select
                  className="!w-20"
                  value={f.diskon_tipe}
                  onChange={(e) =>
                    set("diskon_tipe", e.target.value as "rp" | "pct")
                  }
                >
                  <option value="rp">Rp</option>
                  <option value="pct">%</option>
                </select>
                <input
                  inputMode="numeric"
                  value={
                    f.diskon
                      ? f.diskon_tipe === "rp"
                        ? f.diskon.toLocaleString("id-ID")
                        : f.diskon
                      : ""
                  }
                  onChange={(e) =>
                    set(
                      "diskon",
                      Number(e.target.value.replace(/\D/g, "") || 0),
                    )
                  }
                />
              </div>
            </div>
            <div className="flex flex-col justify-end gap-1.5 text-[13px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="!w-auto"
                  checked={f.ppn_aktif}
                  onChange={(e) => set("ppn_aktif", e.target.checked)}
                />
                PPN 11% {perusahaan?.pkp ? "" : "(ARL belum PKP)"}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="!w-auto"
                  checked={f.pph23}
                  onChange={(e) => set("pph23", e.target.checked)}
                />
                Klien memotong PPh 23 (2%)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Catatan di invoice</label>
              <textarea
                rows={2}
                value={f.catatan}
                onChange={(e) => set("catatan", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* ---------------- tombol ---------------- */}
        <div className="mt-5 flex flex-wrap gap-2">
          {draf ? (
            <>
              <button className="btn-ghost" disabled={proses} onClick={simpan}>
                Simpan draf
              </button>
              {bolehKelola || jenis === "penawaran" ? (
                <button
                  className="btn"
                  disabled={proses || !f.klien_id || h.total <= 0}
                  onClick={terbit}
                >
                  {jenis === "invoice"
                    ? "Terbitkan invoice"
                    : "Terbitkan penawaran"}
                </button>
              ) : null}
            </>
          ) : null}
          <button className="btn-ghost" onClick={() => window.print()}>
            Cetak / PDF
          </button>
          {perusahaan?.folder_invoice_url ? (
            <a
              className="btn-ghost"
              href={perusahaan.folder_invoice_url}
              target="_blank"
              rel="noreferrer"
            >
              Buka folder Drive
            </a>
          ) : null}
          {dok && dok.status === "Terkirim" && bolehKelola ? (
            <button
              className="btn-ghost !text-merah"
              disabled={proses}
              onClick={() =>
                jalan(
                  () => batalkanDokumen(dok.id),
                  "Dibatalkan",
                  "Batalkan dokumen ini? Tagihannya di Piutang dinolkan.",
                )
              }
            >
              Batalkan
            </button>
          ) : null}
          {dok && bolehHapus && dok.status !== "Lunas" ? (
            <button
              className="btn-ghost !text-merah"
              disabled={proses}
              onClick={() =>
                jalan(
                  () => hapusDokumen(dok.id),
                  "Dihapus",
                  "Hapus dokumen ini permanen?",
                  () => "/invoice",
                )
              }
            >
              Hapus
            </button>
          ) : null}
        </div>

        {dok &&
        dok.jenis === "invoice" &&
        dok.status === "Terkirim" &&
        bolehKelola ? (
          <div className="mt-5 rounded-xl border border-hijau bg-hijau-muda p-4">
            <h3 className="mb-1 font-serif text-[16px] font-bold">
              Tandai lunas
            </h3>
            <p className="mb-3 text-[12.5px] text-teks2">
              Mencatat transaksi masuk <b>{rp(dok.diterima)}</b> (yang
              ditransfer)
              {dok.pph23_nilai ? (
                <>
                  {" "}
                  dan PPh 23 <b>{rp(dok.pph23_nilai)}</b> sebagai kredit pajak —
                  minta bukti potongnya ke klien
                </>
              ) : null}
              . Jangan dicatat lagi di Transaksi.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Tanggal masuk</label>
                <input
                  type="date"
                  value={bayar.tanggal}
                  onChange={(e) =>
                    setBayar({ ...bayar, tanggal: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Rekening</label>
                <select
                  value={bayar.rekening_id}
                  onChange={(e) =>
                    setBayar({ ...bayar, rekening_id: e.target.value })
                  }
                >
                  {rekening.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                disabled={proses}
                onClick={() =>
                  jalan(
                    () => lunasiInvoice(dok.id, bayar),
                    "Lunas — transaksi tercatat",
                    `Tandai lunas dan catat ${rp(dok.diterima)} masuk?`,
                  )
                }
              >
                Tandai lunas
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---------------- pratinjau / cetak ---------------- */}
      <section className="bg-krem px-[18px] py-[22px] lebar:px-9 print:bg-white print:p-0">
        <Pratinjau
          judul={jenis === "penawaran" ? "PENAWARAN HARGA" : "INVOICE"}
          nomor={dok?.nomor ?? "(nomor diberikan saat terbit)"}
          tanggal={f.tanggal}
          jatuhTempo={
            jenis === "invoice" ? tambahHari(f.tanggal, f.tempo_hari) : ""
          }
          p={perusahaan}
          k={kl}
          grup={grup
            .map(
              ([n, rows]) =>
                [n, rows.filter((b) => b.pilih && b.qty > 0)] as const,
            )
            .filter(([, rows]) => rows.length > 0)}
          durasi={f.durasi_bulan}
          h={h}
          diskonTipe={f.diskon_tipe}
          diskon={f.diskon}
          catatan={f.catatan}
        />
      </section>
    </div>
  );
}

/** Tata letak cetak — mengikuti invoiceHTML() di prototipe. */
function Pratinjau({
  judul,
  nomor,
  tanggal,
  jatuhTempo,
  p,
  k,
  grup,
  durasi,
  h,
  diskonTipe,
  diskon,
  catatan,
}: {
  judul: string;
  nomor: string;
  tanggal: string;
  jatuhTempo: string;
  p: Perusahaan | null;
  k: Klien | undefined;
  grup: (readonly [string, Baris[]])[];
  durasi: number;
  h: ReturnType<typeof hitungInvoice>;
  diskonTipe: "rp" | "pct";
  diskon: number;
  catatan: string;
}) {
  const kecil = "text-[10.5px] font-bold tracking-[2px] text-biru";
  return (
    <div className="mx-auto max-w-[780px] rounded-xl bg-white p-6 text-[12.5px] text-[#222] shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <div className="mb-6 flex justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/arl-gelap.png"
            alt="Logo ARL"
            className="mb-2 h-[58px]"
          />
          <div className="font-serif text-[16px] font-bold tracking-[.5px]">
            ARAH RUANG LANGIT
          </div>
          <div className="text-[11px] tracking-[2px] text-muted">
            #ZEROTOHERO
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-[24px] font-bold tracking-[2px]">
            {judul}
          </div>
          <div className="mt-2 leading-[1.9] text-[#444]">
            <b>{nomor}</b>
            <br />
            Tanggal: {tglID(tanggal)}
            {jatuhTempo ? (
              <>
                <br />
                Jatuh tempo: <b>{tglID(jatuhTempo)}</b>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <div className={kecil}>DARI</div>
          <div className="text-[14px] font-bold">
            {p?.nama ?? "PT Arah Ruang Langit"}
          </div>
          <div className="leading-[1.75] text-[#555]">
            {p?.alamat}
            {p?.npwp ? <div>NPWP: {p.npwp}</div> : null}
            <div>{[p?.telp, p?.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div>
          <div className={kecil}>UNTUK</div>
          <div className="text-[14px] font-bold">
            {k?.nama ?? (
              <span className="text-[#aaa]">— klien belum dipilih —</span>
            )}
          </div>
          {k ? (
            <div className="leading-[1.75] text-[#555]">
              {k.alamat}
              {k.npwp ? <div>NPWP: {k.npwp}</div> : null}
              {k.pic ? <div>u.p. {k.pic}</div> : null}
              <div>{[k.wa, k.email].filter(Boolean).join(" · ")}</div>
            </div>
          ) : null}
        </div>
      </div>

      {grup.map(([nama, rows]) => (
        <div key={nama} className="mb-4 break-inside-avoid">
          <div className="rounded-t-md bg-navy px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-white">
            {nama.toUpperCase()}
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-krem text-[10.5px] text-muted">
                <th className="px-2.5 py-1.5 text-left">LAYANAN</th>
                <th className="w-[90px] px-2.5 py-1.5 text-center">PORSI</th>
                <th className="w-[110px] px-2.5 py-1.5 text-right">HARGA</th>
                <th className="w-[120px] px-2.5 py-1.5 text-right">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr
                  key={b.kunci}
                  className="border-b border-[#EEF2F7] align-top"
                >
                  <td className="px-2.5 py-2">
                    <b>{b.nama || "—"}</b>
                    {b.deskripsi ? (
                      <div className="mt-0.5 text-[11.5px] leading-[1.55] text-muted">
                        {b.deskripsi}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-2 text-center">
                    {b.qty} {b.satuan}
                    {b.berulang && durasi > 1 ? (
                      <div className="text-[11px] text-muted">
                        × {durasi} bulan
                      </div>
                    ) : null}
                  </td>
                  <td className="num px-2.5 py-2 text-right">
                    {rp(b.harga)}
                    {b.diskon_persen ? (
                      <div className="text-[11px] text-merah">
                        disk {b.diskon_persen}%
                      </div>
                    ) : null}
                  </td>
                  <td className="num px-2.5 py-2 text-right font-bold">
                    {rp(nilaiBaris(b, durasi))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1.1fr_1fr] print:grid-cols-[1.1fr_1fr]">
        <div>
          {catatan ? (
            <>
              <div className={kecil}>CATATAN</div>
              <div className="whitespace-pre-wrap leading-[1.7] text-[#444]">
                {catatan}
              </div>
            </>
          ) : null}
          {p?.bank ? (
            <div className="mt-3 rounded-r-lg border-l-[3px] border-biru bg-krem px-3.5 py-2.5">
              <div className={kecil}>PEMBAYARAN</div>
              <div>
                {p.bank} · <b>{p.no_rekening}</b>
                <br />
                a.n. {p.atas_nama}
              </div>
            </div>
          ) : null}
        </div>
        <div className="num">
          <Baris2 l="Subtotal" v={rp(h.subtotal)} />
          {h.diskonRp ? (
            <Baris2
              l={`Diskon${diskonTipe === "pct" ? ` ${diskon}%` : ""}`}
              v={"− " + rp(h.diskonRp)}
            />
          ) : null}
          {h.ppn ? <Baris2 l="PPN 11%" v={rp(h.ppn)} /> : null}
          <div className="mt-1 flex justify-between border-t-2 border-navy pt-2 text-[15px] font-bold">
            <span>Total</span>
            <span>{rp(h.total)}</span>
          </div>
          {h.pph23_nilai ? (
            <>
              <Baris2
                l="PPh 23 dipotong klien (2%)"
                v={"− " + rp(h.pph23_nilai)}
              />
              <div className="flex justify-between rounded bg-hijau-muda px-2 py-1.5 font-bold">
                <span>Ditransfer</span>
                <span>{rp(h.diterima)}</span>
              </div>
            </>
          ) : null}
          {durasi > 1 ? (
            <div className="mt-1 text-right text-[11px] text-muted">
              ≈ {rp(h.perBulan)} / bulan
            </div>
          ) : null}
        </div>
      </div>

      {p?.penanda_tangan ? (
        <div className="mt-10 flex justify-end">
          <div className="w-56 text-center">
            <div className="mb-16">Hormat kami,</div>
            <div className="border-t border-[#999] pt-1 font-bold">
              {p.penanda_tangan}
            </div>
            <div className="text-[11.5px] text-muted">{p.jabatan_ttd}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Baris2({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5 text-[#444]">
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
