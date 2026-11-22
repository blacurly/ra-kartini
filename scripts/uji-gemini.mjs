// scripts/uji-gemini.mjs  (versi 2: dua tahap, supaya jelas masalahnya di jaringan, kunci, atau model)
// Cara pakai (dari folder utama proyek):  node --env-file=.env.local scripts/uji-gemini.mjs
// Skrip ini TIDAK menampilkan kunci.

const kunci = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

if (!kunci) {
  console.log("GAGAL: GEMINI_API_KEY belum terbaca. Cek .env.local (nama variabel, tanpa spasi di sekitar tanda =).");
  process.exit(1);
}
console.log("Kunci terbaca (panjang " + kunci.length + " karakter). Model yang dipilih:", model);

const sebab = (e) => e?.cause?.code || e?.cause?.message || e?.message || String(e);

// ---------- Tahap A: cek koneksi dan kunci (cepat, tanpa membuat teks) ----------
console.log("\nTAHAP A: menghubungi Google dan meminta daftar model...");
let mulai = Date.now();
try {
  const res = await fetch(`${BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": kunci },
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  console.log("Status HTTP:", res.status, "| waktu:", Date.now() - mulai, "ms");
  if (!res.ok) {
    console.log("Pesan dari Google:", data?.error?.message ?? "(tidak ada pesan)");
    console.log("TAHAP A GAGAL: koneksi ke Google berhasil, tetapi kunci ditolak. Cek kunci (lihat tabel arti status).");
    process.exit(1);
  }
  const bisa = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace("models/", ""));
  const flash = bisa.filter((n) => /flash/i.test(n)).slice(0, 12);
  console.log("TAHAP A BERHASIL. Model 'flash' yang bisa dipakai kunci ini:\n - " + (flash.join("\n - ") || "(tidak ada)"));
  console.log(bisa.includes(model) ? `Model pilihanmu (${model}) tersedia.` : `PERHATIAN: ${model} tidak ada di daftar. Ganti GEMINI_MODEL dengan salah satu model di atas.`);
} catch (e) {
  console.log("TAHAP A GAGAL setelah", Date.now() - mulai, "ms. Penyebab:", sebab(e));
  console.log("Artinya komputer ini belum bisa menghubungi Google (jaringan, VPN, atau firewall). Lihat tabel di panduan.");
  process.exit(1);
}

// ---------- Tahap B: minta satu balasan pendek ----------
console.log("\nTAHAP B: meminta balasan satu kata (batas tunggu 60 detik)...");
mulai = Date.now();
try {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": kunci },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Balas hanya dengan satu kata: siap" }] }],
      generationConfig: { maxOutputTokens: 200 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  console.log("Status HTTP:", res.status, "| waktu:", Date.now() - mulai, "ms");
  if (res.ok) {
    const teks = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    console.log("Balasan AI:", teks.trim() || "(kosong, tetapi koneksi berhasil)");
    console.log("BERHASIL: kunci dan model berfungsi.");
  } else {
    console.log("Pesan dari Google:", data?.error?.message ?? "(tidak ada pesan)");
    console.log("TAHAP B GAGAL. Lihat tabel arti status.");
  }
} catch (e) {
  console.log("TAHAP B GAGAL setelah", Date.now() - mulai, "ms. Penyebab:", sebab(e));
}
