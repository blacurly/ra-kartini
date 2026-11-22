import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Ambil daftar action plan berdasarkan user yang sedang login
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const plans = await db.getActionPlans(userId);
    return NextResponse.json({ success: true, data: plans }, { status: 200 });
  } catch (error) {
    console.error("Error GET Action Plans:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Tambah action plan baru
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, actionText } = body;

    if (!userId || !actionText) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const result = await db.insertActionPlan(userId, actionText);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error POST Action Plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Update status centang (selesai / belum)
export async function PUT(req) {
  try {
    const body = await req.json();
    const { planId, isCompleted } = body;

    if (!planId) {
      return NextResponse.json({ success: false, message: "ID plan tidak ditemukan" }, { status: 400 });
    }

    const result = await db.toggleActionPlanStatus(planId, isCompleted);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error PUT Action Plan:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}