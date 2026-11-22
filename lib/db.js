import crypto from "node:crypto";
import { HttpError } from "./http";
import { createClient } from "@supabase/supabase-js";

// Supabase admin client (service role, bypasses RLS). Server-only.
// Dibuat lazy supaya build/dev tidak crash saat env Supabase belum diisi.
let _supabaseAdmin;
export function supabaseAdmin() {
  if (_supabaseAdmin !== undefined) return _supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _supabaseAdmin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _supabaseAdmin;
}

export const db = {
  // ---------- users ----------
  async getUser(id) {
    const sb = supabaseAdmin();
    if (!sb || !/^[0-9a-f-]{36}$/i.test(String(id))) return null;
    const { data, error } = await sb.auth.admin.getUserById(id);
    if (error || !data?.user) return null;
    const authUser = data.user;
    return {
      id: authUser.id,
      name: authUser.user_metadata?.name || "Puan",
      email: (authUser.email || "").toLowerCase(),
      phone: authUser.phone || "",
      createdAt: Date.parse(authUser.created_at) || Date.now(),
    };
  },  
  
  // ---------- telegram ----------
  // Token sekali pakai disimpan di Supabase (telegram_link_codes), bukan di memori,
  // karena di Vercel request "buat link" dan webhook Telegram bisa jalan di
  // instance serverless yang berbeda. Tanpa env Supabase, fallback ke memori (dev lokal).
  async createTelegramLink(userId) {
    const token = crypto.randomBytes(16).toString("hex");
    const exp = Date.now() + 15 * 60_000; // aktif 15 menit
    const sb = supabaseAdmin();
    
    const { error } = await sb.from("telegram_link_codes").insert({
      code: token,
      auth_user_id: userId,
      expires_at: new Date(exp).toISOString(),
    });
    // Jangan kirim deep link kalau token gagal disimpan: kalau tidak, webhook
    // pasti gagal mencocokkan token di langkah validasi.
    if (error) {
      console.error("Gagal simpan token ke telegram_link_codes:", error, "userId:", userId);
      throw new HttpError(500, `Gagal membuat link Telegram: ${error.message}`);
    }
    return token;
  },

  /** One-time token -> binds chatId to the user. Returns the user or null. */
  // ---------- telegram ----------
  async createTelegramLink(userId) {
    const token = crypto.randomBytes(16).toString("hex");
    const exp = Date.now() + 15 * 60_000; // aktif 15 menit
    const sb = supabaseAdmin();
    if (!sb) {
      throw new HttpError(500, "Supabase belum dikonfigurasi");
    }
    const { error } = await sb.from("telegram_link_codes").insert({
      code: token,
      auth_user_id: userId,
      expires_at: new Date(exp).toISOString(),
    });
    if (error) {
      console.error("Gagal simpan token ke telegram_link_codes:", error, "userId:", userId);
      throw new HttpError(500, `Gagal membuat link Telegram: ${error.message}`);
    }
    return token;
  },

  /** One-time token -> binds chatId to the user. Returns the user or null. */
  async consumeTelegramLink(token, chatId, username, telegramId) {
    const handle = username ? `@${username}` : "";
    const sb = supabaseAdmin();
    if (!sb) return null;

    // Cek + tandai terpakai dalam satu query, supaya token tidak bisa dipakai dua kali.
    const { data: claim, error } = await sb
      .from("telegram_link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("auth_user_id")
      .maybeSingle();
    if (error) console.error("Gagal validasi token Telegram:", error);
    if (!claim) {
      console.error("Token tidak ditemukan / sudah dipakai / kedaluwarsa:", token);
      return null;
    }
    const userId = claim.auth_user_id;

    const { error: botUserError } = await sb.from("bot_users").upsert(
      {
        auth_user_id: userId,
        telegram_id: String(telegramId ?? chatId),
        telegram_chat_id: String(chatId),
        telegram_username: username || null,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" }
    );
    if (botUserError) {
      console.error("Gagal upsert ke bot_users:", botUserError);
      return null;
    }

    const user = await this.getUser(userId);
    if (user) {
      user.telegramChatId = String(chatId);
      user.telegramUsername = handle;
      return user;
    }
    return { id: userId, name: "", telegramChatId: String(chatId), telegramUsername: handle };
  },

  async findUserByChat(chatId) {
    const sb = supabaseAdmin();
    if (!sb) return null;
    const { data } = await sb
      .from("bot_users")
      .select("auth_user_id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();
    if (!data?.auth_user_id) return null;
    return this.getUser(data.auth_user_id);
  },

  /** {connected, username} dari bot_users (dipakai halaman Sambungkan Telegram). */
  async getTelegramStatus(userId) {
    const sb = supabaseAdmin();
    if (!sb) {
      console.warn("supabaseAdmin() kosong — cek SUPABASE_SERVICE_ROLE_KEY di .env.local");
      return { connected: false, username: "" };
      }

      const { data, error } = await sb
        .from("bot_users")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error cek bot_users:", error.message);
      }

      if (!data) {
        return { connected: false, username: "" };
      }
      
      const uname = data.telegram_username || data.username || "";
      return {
        connected: true,
        username: uname ? (uname.startsWith("@") ? uname : `@${uname}`) : "",
        };
      },
    
  // ---------- health_score (Supabase) ----------
  async upsertHealthScore(userId, scoreData) {
    const sb = supabaseAdmin();
    if (!sb || !userId) return null;

    const { data, error } = await sb
      .from("health_score")
      .insert({
        user_id: userId,
        overall_score: scoreData.totalScore,
        status: scoreData.status,
        category_scores: {
          spend: scoreData.spend,
          save: scoreData.save,
          borrow: scoreData.borrow,
          plan: scoreData.plan
        },
        recommendations_context: scoreData.insight,
        created_at: new Date().toISOString()
      }, { onConflict: ['user_id'] }); // Sesuaikan jika ada kolom unik komposit seperti ['user_id', 'period']

    if (error) {
      console.error("Gagal menyimpan ke tabel health_score:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  },

// ---------- Action Plans (Supabase) ----------
  async getActionPlans(userId) {
    const sb = supabaseAdmin();
    if (!sb || !userId) return [];

    const { data, error } = await sb
      .from("ai_action_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal membaca tabel ai_action_plans:", error.message);
      return [];
    }
    return data || [];
  },
    
    async insertActionPlan(userId, actionText) {
      const sb = supabaseAdmin();
      if (!sb || !userId) return null;

      const { data, error } = await sb
        .from("ai_action_plans")
        .insert({
          user_id: userId,
          action_text: actionText,
          is_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("Gagal menyimpan action plan:", error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    },

    async toggleActionPlanStatus(planId, isCompleted) {
      const sb = supabaseAdmin();
      if (!sb || !planId) return null;

      const { data, error } = await sb
        .from("ai_action_plans")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", planId)
        .select()
        .single();

      if (error) {
        console.error("Gagal memperbarui status action plan:", error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    }
  };
   
