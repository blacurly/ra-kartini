// lib/gemini.js
// Pemanggil Gemini untuk SISI SERVER saja (route API Next.js). Jangan diimpor dari komponen browser.
//
// Cara kerja: kirim instruksi + ringkasan angka, minta balasan berbentuk JSON, lalu PERIKSA bentuknya
// dengan skema zod. Fungsi ini tidak pernah melempar error: hasilnya selalu { ok: true, data } atau
// { ok: false, reason }, sehingga pemanggil bisa langsung memakai saran cadangan.
//
// Variabel di .env.local:  GEMINI_API_KEY  (wajib)   GEMINI_MODEL  (opsional, bawaan gemini-3.5-flash)

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Pengaman terakhir: jangan pernah mengirim email atau nomor telepon ke layanan AI.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(?:\+?62|0)8\d{8,12}/;

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const bersihkanJson = (teks) =>
  teks.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

/**
 * @param {object} opsi
 * @param {string} opsi.system   aturan untuk AI
 * @param {string} opsi.prompt   data yang dianalisis (hanya angka ringkasan, tanpa data pribadi)
 * @param {{safeParse: Function}} opsi.schema  skema zod untuk memeriksa balasan
 * @returns {Promise<{ok:true,data:any}|{ok:false,reason:string}>}
 */
export async function askGeminiJson({ system, prompt, schema, timeoutMs = 60000, maxOutputTokens = 1000, temperature = 0.4 }) {
  console.log("[gemini] Fungsi askGeminiJson aktif");
  if (typeof window !== "undefined") throw new Error("lib/gemini.js hanya boleh dipakai di server");

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  if (EMAIL_RE.test(prompt) || PHONE_RE.test(prompt)) return { ok: false, reason: "pii_blocked" };

  const startedAt = Date.now();

  let res;
  try {
    res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens, temperature },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e?.name === "TimeoutError" || e?.name === "AbortError";
    console.warn("[gemini] gagal:", timeout ? "timeout" : e?.cause?.code || e?.message); // isi pesan tidak pernah dicatat
    return { ok: false, reason: timeout ? "timeout" : "network" };
  }

console.log(
  "[gemini] HTTP response diterima dalam",
  Date.now() - startedAt,
  "ms"
);

if (!res.ok) {
  let errorDetail = "";

  try {
    const errorData = await res.json();
    errorDetail = errorData?.error?.message || "";
  } catch {
    errorDetail = "Tidak dapat membaca detail error";
  }

  console.error("[gemini] HTTP Error:", {
    status: res.status,
    statusText: res.statusText,
    detail: errorDetail,
    model,
  });

  return {
    ok: false,
    reason: `http_${res.status}`,
  };
}


  let data;
  try { data = await res.json(); } catch { return { ok: false, reason: "bad_response" }; }

  const cand = data?.candidates?.[0];

  console.log("🔍 CANDIDATE MENTAH DARI GEMINI:", JSON.stringify(cand, null, 2));

  if (data?.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") return { ok: false, reason: "blocked" };
  if (cand?.finishReason === "MAX_TOKENS") return { ok: false, reason: "truncated" };

  const teks = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");

  console.log("🔍 HASIL EKSTRAK TEKS:", JSON.stringify(teks));
  
  if (!teks.trim()) return { ok: false, reason: "empty" };

  let json;
  try { json = JSON.parse(bersihkanJson(teks)); } catch { return { ok: false, reason: "bad_json" }; }

  const hasil = schema.safeParse(json);
  if (!hasil.success) {
    console.error("Zod Validation Error:", hasil.error.format()); // Tambahkan ini
    console.error("JSON dari Gemini:", json);                      // Tambahkan ini
    return { ok: false, reason: "invalid_shape" };
  }

  return { ok: true, data: hasil.data };
}