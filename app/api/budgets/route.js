import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/db";
import { HttpError, handler, readBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional().default("Anggaran Belanja"),
    amount: z.coerce
      .number()
      .int("Nominal anggaran harus berupa bilangan bulat")
      .positive("Nominal anggaran harus lebih dari 0")
      .max(1_000_000_000_000),
    period_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal mulai tidak valid"),
    period_end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal selesai tidak valid"),
  })
  .refine((val) => val.period_end >= val.period_start, {
    message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai",
    path: ["period_end"],
  });

// GET /api/budgets -> ambil daftar anggaran milik user yang login
export const GET = handler(async (request) => {
  const sb = supabaseAdmin();
  if (!sb) throw new HttpError(500, "Supabase belum dikonfigurasi");

  const user = await requireUser(request);

  const { data, error } = await sb
    .from("budgets")
    .select("id, user_id, name, amount, period_start, period_end, status, created_at")
    .eq("user_id", user.id)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal membaca tabel budgets:", error.message);
    throw new HttpError(500, "Gagal memuat data anggaran");
  }

  return Response.json({ budgets: data || [] });
});

// POST /api/budgets -> simpan anggaran baru beserta rentang tanggalnya
export const POST = handler(async (request) => {
  const sb = supabaseAdmin();
  if (!sb) throw new HttpError(500, "Supabase belum dikonfigurasi");

  const user = await requireUser(request);
  const body = await readBody(request, createBudgetSchema);

  const { data, error } = await sb
    .from("budgets")
    .insert({
      user_id: user.id,
      name: body.name || "Anggaran Belanja",
      amount: body.amount,
      period_start: body.period_start,
      period_end: body.period_end,
      status: "active",
    })
    .select("id, user_id, name, amount, period_start, period_end, status, created_at")
    .single();

  if (error) {
    console.error("Gagal menyimpan anggaran ke Supabase:", error.message);
    throw new HttpError(500, "Gagal menyimpan anggaran");
  }

  return Response.json({ budget: data }, { status: 201 });
});