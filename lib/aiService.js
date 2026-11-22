import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemPrompt = `Kamu adalah Asisten Edukasi Finansial SAKUPUAN yang empatik, objektif, dan profesional. 
Tugasmu adalah menganalisis data keuangan pengguna dan memberikan strategi penganggaran serta solusi praktis.

ATURAN KETAT (HARUS DIPATUHI 100%):
1. Larangan Rekomendasi Produk: Jangan pernah menyebutkan, merekomendasikan, atau membandingkan nama bank, aplikasi, saham, reksa dana, asuransi, kripto, atau produk investasi spesifik.
2. Larangan Halusinasi Angka: Gunakan HANYA angka yang secara eksplisit diberikan dalam prompt.
3. ATURAN KHUSUS SKOR DI BAWAH 40: Jika skor finansial pengguna di bawah 40 (0-39), WAJIB berikan saran alternatif pemasukan tambahan (*side hustle*) yang realistis, bisa dikerjakan oleh ibu rumah tangga dari rumah dengan modal minimal (misalnya kuliner/masakan rumahan, pre-order, jasa titip lokal, atau pemanfaatan keahlian digital), serta berfokus pada perbaikan arus kas kecil.
4. Format Output: Berikan balasan dalam format JSON MURNI dengan struktur berikut:
{
  "reply": "Teks jawaban lengkap mencakup ringkasan kondisi, strategi taktis, saran pemasukan tambahan (jika skor < 40), dan ditutup dengan disclaimer wajib: 'Catatan: Informasi ini ditujukan untuk edukasi dan bukan merupakan nasihat keuangan profesional...'",
  "suggestion": {
    "title": "Judul aksi praktis untuk Action Plan (maks 160 karakter)",
    "desc": "Penjelasan singkat cara memulai aksi tersebut dengan modal minimal (maks 300 karakter)",
    "cat": "Kebutuhan rumah tangga" // Kategori valid: "Makanan & minuman", "Investasi & Tabungan", "Cicilan & utang", "Kebutuhan rumah tangga"
  }
}
`;

export async function callAi(endpoint, payload) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  const { message, city, userName, financialScore } = payload;
  
  // Ambil skor keseluruhan untuk evaluasi kondisi
  const overallScore = financialScore?.overall_score ?? 50;

  const structuredPrompt = `
Informasi Kontekstual Pengguna:
- Nama: ${userName || "Puan"}
- Kota Domisili: ${city || "Kudus"}
- Skor Finansial Keseluruhan: ${overallScore} ${overallScore < 40 ? "(PERHATIAN: Skor di bawah 40, wajib berikan ide pemasukan tambahan modal minimal dari rumah)" : ""}
- Detail Data Keuangan & Asesmen: ${JSON.stringify(financialScore || {})}

Pesan/Pertanyaan Pengguna: "${message}"
`;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: structuredPrompt,
      config: {
        systemInstruction: systemPrompt,
        // Memaksa AI mengembalikan output dalam format JSON murni
        responseMimeType: "application/json",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900,
        },
      },
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Respons kosong dari Gemini.");

    const parsedData = JSON.parse(rawText);

    return {
      reply: parsedData.reply || rawText,
      suggestion: parsedData.suggestion || null,
    };
  } catch (error) {
    console.error("Gagal memanggil Gemini di callAi:", error);
    throw error;
  }
}