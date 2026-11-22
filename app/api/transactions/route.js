import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { supabaseAdmin } from "@/lib/db";
import { HttpError, handler, readBody } from "@/lib/http";
import { buildPeriods, dateLabel, periodKey } from "@/lib/periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ACCOUNTS = [
  { id: "tabungan", label: "Tabungan" },
  { id: "giro", label: "Giro" },
];

function mapRowToTransaction(row) {
  const refDate = row.transaction_date
    ? new Date(row.transaction_date)
    : new Date(row.created_at || Date.now());
  const validDate = Number.isNaN(refDate.getTime()) ? new Date() : refDate;
  const flow = row.type === "income" || row.type === "in" ? "in" : "out";

  return {
    id: row.id,
    userId: row.user_id,
    flow,
    type: row.type,
    cat: row.category,
    category: row.category,
    title: row.title || row.item || "",
    item: row.item || row.title || "",
    amount: Number(row.amount) || 0,
    account: row.account || "tabungan",
    period: periodKey(validDate),
    date: dateLabel(validDate),
    transaction_date: row.transaction_date,
    created_at: row.created_at,
    source: row.source || "manual",
    status: row.status || "confirmed",
  };
}

export const GET = handler(async (request) => {
  const sb = supabaseAdmin();
  if (!sb) throw new HttpError(500, "Supabase belum dikonfigurasi");

  const user = await requireUser(request);
  const url = new URL(request.url);
  const period = url.searchParams.get("period");
  const account = url.searchParams.get("account");

  const { data, error } = await sb
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("transaction_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal membaca tabel transactions:", error.message);
    throw new HttpError(500, "Gagal memuat data transaksi");
  }

  const all = (data || []).map(mapRowToTransaction);
  const transactions = all.filter(
    (t) =>
      (!period || t.period === period) &&
      (!account || account === "all" || t.account === account),
  );

  return Response.json({
    periods: buildPeriods(all.map((t) => t.period)),
    accounts: DEFAULT_ACCOUNTS,
    transactions,
  });
});

const schema = z.object({
  flow: z.enum(["in", "out"]),
  cat: z.string().refine((c) => c in CATEGORIES, "Kategori tidak dikenal"),
  title: z.string().trim().min(1).max(120),
  amount: z.number().int().positive().max(1_000_000_000_000),
  account: z.enum(["tabungan", "giro"]).default("tabungan"),
});

// POST /api/transactions {flow, cat, title, amount, account?} -> 201 {transaction}
export const POST = handler(async (request) => {
  const sb = supabaseAdmin();
  if (!sb) throw new HttpError(500, "Supabase belum dikonfigurasi");

  const user = await requireUser(request);
  const body = await readBody(request, schema);
  const now = new Date();
  const isoNow = now.toISOString();
  const dbType = body.flow === "in" ? "income" : "expense";

  const { data, error } = await sb
    .from("transactions")
    .insert({
      user_id: user.id,
      type: dbType,
      category: body.cat,
      title: body.title,
      item: body.title,
      amount: body.amount,
      source: "manual",
      status: "confirmed",
      is_deleted: false,
      transaction_date: isoNow,
      created_at: isoNow,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Gagal menyimpan transaksi ke Supabase:", error.message);
    throw new HttpError(500, "Gagal menyimpan transaksi");
  }

  return Response.json({ transaction: mapRowToTransaction(data) }, { status: 201 });
});