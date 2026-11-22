import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { advisorReply } from "@/lib/advisor";
import { askGeminiJson } from "@/lib/gemini";
import { IDE, ideById, tampilanIde } from "@/lib/incomeIdeas";
import { DEFAULT_CITY, TASK_CATEGORIES } from "@/lib/constants";
import { handler, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";

// 1. Validasi request
const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  city: z.string().trim().max(60).default(DEFAULT_CITY),
});

// 2. Validasi respons Gemini
const aiResponseSchema = z.object({
  reply: z.string().min(1),
  incomeIdeaId: z.string().nullable().optional(),
  suggestion: z.object({
    title: z.string().max(160),
    desc: z.string().max(300),
    cat: z.string().optional(),
  }).nullable().optional(),
});

// 3. Endpoint POST
export const POST = handler(async (request) => {
  // Autentikasi pengguna
  const user = await requireUser(request);

  rateLimit(`advisor:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });

  // Validasi input
  const { message, city } = await readBody(request, bodySchema);

  // 4. Ambil skor finansial dari Supabase lewat service role di server
  let financialData = null;

  try {
    const db = supabaseAdmin();
    if (!db) {
      console.error("supabaseAdmin belum terkonfigurasi.");
    } else {
      const { data, error } = await db
        .from("health_score")
        .select(
          "overall_score, category_scores, status, recommendations_context"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Gagal mengambil health_score:", error.message);
      } else {
        financialData = data;
      }
    }
  } catch (err) {
    console.error("Error Supabase:", err);
  }

  // Pastikan skor berupa angka dan tidak keliru menganggap null sebagai 0
  const hasScore =
    financialData !== null &&
    financialData.overall_score !== null &&
    financialData.overall_score !== undefined;

  const rawScore = hasScore ? Number(financialData.overall_score) : NaN;
  const score = Number.isFinite(rawScore) ? rawScore : 50;
  const isLowScore = score < 40;

  // 5. Siapkan daftar ide dan kategori valid
  const daftarIdIde = IDE.map((item) => item.id).join(", ");
  const daftarKategoriValid = TASK_CATEGORIES.join(", ");

  // 6. System Prompt Gemini
  const systemPrompt = `
Kamu adalah Asisten Edukasi Finansial SakuPuan
yang empatik, objektif, dan profesional.

KONDISI PENGGUNA:
Skor keuangan saat ini: ${score}/100.

${
  isLowScore
    ? `PENTING:
Skor pengguna di bawah 40.
Kamu WAJIB memilih SATU ide pemasukan tambahan
yang paling relevan dari daftar ID resmi berikut:
[${daftarIdIde}].

Masukkan ID tersebut ke properti incomeIdeaId.`
    : `Skor pengguna 40 atau lebih.
Isi incomeIdeaId dengan null.`
}

ATURAN:
1. Jangan merekomendasikan produk investasi,
   bank, atau aplikasi spesifik.
2. Gunakan hanya angka yang diberikan dalam prompt.
3. Properti cat harus menggunakan salah satu
   kategori valid berikut: [${daftarKategoriValid}].
4. Berikan jawaban yang empatik, praktis,
   dan sesuai kondisi pengguna.
5. Kembalikan JSON sesuai struktur berikut:

{
  "reply": "Analisis dan saran lengkap",
  "incomeIdeaId": ${isLowScore ? '"id-dari-daftar-resmi"' : "null"},
  "suggestion": {
    "title": "Judul aksi maksimal 160 karakter",
    "desc": "Penjelasan maksimal 300 karakter",
    "cat": "Kategori valid"
  }
}
`;

  const promptKonteks = `
Nama: ${user.name || "Puan"}
Kota: ${city}
Skor Finansial: ${score}
Pesan User: "${message}"
`;

  // 7. Panggil Gemini
  let aiResult = {
    ok: false,
    reason: "not_called",
  };

  try {
    console.log("[advisor] Memanggil askGeminiJson...");
    console.log(
      "[advisor] Tipe fungsi:",
      typeof askGeminiJson
    );

    const result = await askGeminiJson({
      system: systemPrompt,
      prompt: promptKonteks,
      schema: aiResponseSchema,
      maxOutputTokens: 2500,
    });

    console.log("[advisor] Raw result:", result);

    aiResult = result ?? {
      ok: false,
      reason: "empty_return",
    };
  } catch (err) {
    console.error("[advisor] Gemini exception:", err);

    aiResult = {
      ok: false,
      reason: "exception",
    };
  }

  console.log("[advisor] Final Gemini result:", {
    ok: aiResult.ok,
    reason: aiResult.reason,
    hasData: Boolean(aiResult.data),
    resultType: typeof aiResult,
  });

  // 8. Evaluasi respons Gemini
  if (
    aiResult &&
    aiResult.ok === true &&
    aiResult.data
  ) {
    const dataAi = aiResult.data;

    // Pastikan ID ide tersedia di katalog resmi
    let selectedIdea = null;

    if (dataAi.incomeIdeaId) {
      try {
        const rawIdea = ideById(dataAi.incomeIdeaId);

        if (rawIdea) {
          selectedIdea = tampilanIde(rawIdea);
        } else {
          console.warn(
            "ID ide tidak ditemukan di katalog:",
            dataAi.incomeIdeaId
          );
        }
      } catch (err) {
        console.error("Gagal mengambil ide pemasukan:", err);
      }
    }

    return Response.json({
      reply: dataAi.reply,
      suggestion: dataAi.suggestion || undefined,
      incomeIdea: selectedIdea,
      source: "ai",
    });
  }

  // 9. Fallback ke Rule-Based Advisor
  const reason =
    aiResult && aiResult.reason
      ? aiResult.reason
      : "unknown_error";

  console.warn(
    "Gemini gagal merespons. Menggunakan fallback rules.",
    "Alasan:",
    reason
  );

  try {
    const fallbackResult = advisorReply(message, city);

    const fallbackText =
      fallbackResult && fallbackResult.text
        ? fallbackResult.text
        : "Maaf Puan, saya belum dapat memberikan saran saat ini. Silakan coba kembali.";

    return Response.json({
      reply: fallbackText,
      suggestion:
        fallbackResult && fallbackResult.suggestion
          ? fallbackResult.suggestion
          : undefined,
      incomeIdea: null,
      source: "rules",
    });
  } catch (err) {
    console.error("Fallback Advisor juga gagal:", err);

    // 10. Respons pengaman terakhir
    return Response.json({
      reply:
        "Maaf, layanan asisten finansial sedang mengalami kendala. Silakan coba beberapa saat lagi.",
      suggestion: null,
      incomeIdea: null,
      source: "fallback_error",
    });
  }
});