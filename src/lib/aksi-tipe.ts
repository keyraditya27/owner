/** Bentuk hasil server action — dipisah dari lib/aksi.ts (server-only) supaya bisa diimpor komponen browser. */
export type Hasil = { galat?: string; ok?: boolean; id?: string };
