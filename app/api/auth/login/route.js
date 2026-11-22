import { z } from "zod";
import { publicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handler, HttpError, readBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rateLimit";
import { sessionCookie } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("Format email belum benar"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

// POST /api/auth/login  {email, password} -> {user} + session cookie
export const POST = handler(async (request) => {
  rateLimit(`login:${request.headers.get("x-forwarded-for") ?? "local"}`, { limit: 10, windowMs: 60_000 });
  const { email, password } = await readBody(request, schema);
  const user = await db.findUserByEmail(email);
  // same message for "no such user" and "wrong password"
  if (!user || !verifyPassword(password, user.passwordHash)) throw new HttpError(401, "Email atau kata sandi salah");
  
  // CEK LANGSUNG KE TABEL bot_users BERDASARKAN ID USER
  const { data: botUser } = await supabase
    .from("bot_users")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  
  return Response.json(
    { user: publicUser(user), telegramConnected: telegram.connected },
    { headers: { "Set-Cookie": sessionCookie(user.id) } }
  );
});