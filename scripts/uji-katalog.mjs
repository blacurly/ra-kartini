// scripts/uji-katalog.mjs
// Uji Langkah 3: memeriksa isi katalog ide pemasukan. Cara pakai (dari folder utama proyek):
//   node scripts/uji-katalog.mjs
import { IDE, filterIdeas, periksaKatalog } from "../lib/incomeIdeas.js";

const masalah = periksaKatalog();
console.log("Jumlah ide:", IDE.length, "| sudah diperiksa tim:", IDE.filter((i) => i.diperiksa).length);
console.log(masalah.length ? "MASALAH DI KATALOG:\n - " + masalah.join("\n - ") : "Pemeriksa isi: bersih, tidak ada kata berisiko atau data yang kurang.");

const contoh = [
  ["Modal nol, 2 jam, tanpa keahlian khusus", { modalMaks: "nol", jamTersedia: 2, keterampilan: [] }],
  ["Modal sangat kecil, 3 jam, bisa memasak", { modalMaks: "sangat-kecil", jamTersedia: 3, keterampilan: ["memasak"] }],
  ["Modal kecil, 4 jam, memasak dan komputer", { modalMaks: "kecil", jamTersedia: 4, keterampilan: ["memasak", "komputer"] }],
];
for (const [nama, p] of contoh) {
  const semua = filterIdeas(p, { termasukBelumDiperiksa: true }).map((i) => i.id);
  const tampil = filterIdeas(p).map((i) => i.id);
  console.log(`\n${nama}\n  cocok (semua ide): ${semua.join(", ") || "-"}\n  tampil ke pengguna (hanya yang diperiksa): ${tampil.join(", ") || "belum ada"}`);
}
