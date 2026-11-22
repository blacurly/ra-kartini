// scripts/uji-saran.mjs
// Uji Langkah 2: memanggil lib/gemini.js dengan DATA FIKTIF (bukan data pengguna).
// Cara pakai (dari folder utama proyek):  node --env-file=.env.local scripts/uji-saran.mjs
import { z } from "zod";
import { askGeminiJson } from "../lib/gemini.js";

const schema = z.object({
  ringkasan: z.string().min(1).max(300),
  langkah: z.array(z.object({ judul: z.string().min(1).max(80), isi: z.string().min(1).max(240) })).min(2).max(3),
});

const system = [
  "Kamu adalah pendamping keuangan rumah tangga yang hangat untuk ibu rumah tangga di Indonesia.",
  "Tulis dalam bahasa Indonesia sehari-hari, ringkas, dan tidak menggurui.",
  "Jangan mengarang angka. Hanya pakai angka yang diberikan.",
  "Jangan menyarankan investasi, pinjaman, atau produk keuangan.",
  "Ini bukan nasihat keuangan profesional.",
  'Balas HANYA dengan JSON: {"ringkasan": "...", "langkah": [{"judul": "...", "isi": "..."}]} berisi 2 atau 3 langkah.',
].join("\n");

const prompt = [
  "DATA FIKTIF UNTUK UJI.",
  "Skor periode ini: 45 dari 100 (status: Waspada).",
  "Nilai dimensi: arus kas 44, tabungan 25, cicilan 67.",
  "Pangan adalah 38% dari seluruh pengeluaran.",
].join("\n");

console.log("Memanggil Gemini (batas tunggu 20 detik)...");
const mulai = Date.now();
const hasil = await askGeminiJson({ system, prompt, schema });
console.log("Selesai dalam", Date.now() - mulai, "ms\n");
console.log(JSON.stringify(hasil, null, 2));
console.log(hasil.ok ? "\nBERHASIL: balasan AI lolos pemeriksaan bentuk." : "\nGAGAL dengan alasan: " + hasil.reason + " (lihat tabel arti di panduan).");
