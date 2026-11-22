import { supabaseAdmin } from "./db";
import { HttpError } from "./http";

export { hashPassword, verifyPassword } from "./password";

/** What the browser is allowed to see about a user. */
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || "",
  isVerified: true,
  telegramConnected: !!u.telegramChatId,
  telegramUsername: u.telegramUsername || "",
});

/** Mengambil user aktif langsung dari token Supabase Auth. */
export async function getCurrentUser(request) {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return null;

  const sb = supabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data?.user) return null;

  const authUser = data.user;
  return {
    id: authUser.id,
    name: authUser.user_metadata?.name || "Puan",
    email: (authUser.email || "").toLowerCase(),
    phone: authUser.phone || "",
    createdAt: Date.parse(authUser.created_at) || Date.now(),
  };
}

export async function requireUser(request) {
  const user = await getCurrentUser(request);
  if (!user) throw new HttpError(401, "Silakan login dulu");
  return user;
}