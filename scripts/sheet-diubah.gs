/**
 * Apps Script untuk sheet KEUANGAN ARL — mengisi kolom "Diubah" otomatis saat baris diedit.
 *
 * Kenapa perlu: kalau baris yang sama diubah di aplikasi DAN di sheet sebelum sempat
 * disinkronkan, pemenangnya ditentukan dari Diubah paling baru. Tanpa skrip ini kolom
 * Diubah di sheet tidak pernah bergerak, jadi aplikasi selalu menang.
 *
 * Cara pasang (sekali saja, oleh pemilik sheet):
 *   1. Buka sheet → Extensions → Apps Script
 *   2. Hapus isi Code.gs, tempel seluruh file ini, Save
 *   3. Selesai. onEdit berjalan sendiri tiap ada yang mengetik di sheet.
 *
 * Skrip ini hanya menulis cap waktu. Tidak membaca atau mengirim data ke mana pun.
 */
var TAB_DATA = ['Transaksi', 'Klien', 'Tagihan', 'Vendor', 'Utang', 'Aset', 'Pajak', 'Rekening'];
var KOLOM_SISTEM = ['ID', 'Diubah', 'Sumber'];

function onEdit(e) {
  var sheet = e.range.getSheet();
  if (TAB_DATA.indexOf(sheet.getName()) < 0) return;

  var judul = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var kolDiubah = judul.indexOf('Diubah') + 1;
  if (!kolDiubah) return;

  // Edit yang hanya menyentuh kolom sistem tidak dihitung sebagai perubahan isi
  var semuaSistem = true;
  for (var c = e.range.getColumn(); c <= e.range.getLastColumn(); c++) {
    if (KOLOM_SISTEM.indexOf(judul[c - 1]) < 0) semuaSistem = false;
  }
  if (semuaSistem) return;

  var cap = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss") + '+07:00';
  var awal = Math.max(e.range.getRow(), 2);
  var akhir = e.range.getLastRow();
  if (akhir < awal) return;
  var sel = sheet.getRange(awal, kolDiubah, akhir - awal + 1, 1);
  sel.setNumberFormat('@'); // simpan sebagai teks, jangan diubah jadi tanggal
  var isi = [];
  for (var r = awal; r <= akhir; r++) isi.push([cap]);
  sel.setValues(isi);
}
