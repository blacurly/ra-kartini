import { NextResponse } from "next/server";
import { calculatePeriodScore } from "@/lib/scoring"; 
// Impor db service Anda (sesuaikan jalurnya jika berbeda, misal "@/lib/db")
import { db } from "@/lib/db"; 

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, ...scoringInput } = body; // Ambil userId dan data transaksi lainnya dari request body

    // 1. Hitung skor menggunakan calculatePeriodScore
    const hasilSkor = calculatePeriodScore(scoringInput); 

    // 2. Simpan atau perbarui otomatis ke tabel health_score Supabase jika userId tersedia
    if (userId && hasilSkor.totalScore !== null) {
      const saveResult = await db.upsertHealthScore(userId, hasilSkor);
      if (!saveResult.success) {
        console.error("Gagal menyimpan ke database:", saveResult.error);
      }
    }

    return NextResponse.json({ success: true, data: hasilSkor }, { status: 200 });
    
  } catch (error) {
    console.error("Error di API Scoring:", error);
    return NextResponse.json(
      { success: false, message: "Gagal menghitung dan menyimpan skor", error: error.message }, 
      { status: 500 }
    );
  }
}