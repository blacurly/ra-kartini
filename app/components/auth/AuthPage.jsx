"use client";

import { useRouter } from "next/navigation";
import AuthForm from "./AuthForm";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();

  const handleSuccess = async (res) => {
    try {
      // Ambil user ID dari parameter res (jika dikirim) atau langsung dari sesi lokal Supabase
      let userId = res?.user?.id;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }

      if (userId) {
        const { data: botUser } = await supabase
          .from("bot_users")
          .select("auth_user_id")
          .eq("auth_user_id", userId)
          .maybeSingle();

        // Jika sudah ada di bot_users -> ke /insight, jika belum -> ke /telegram  
        router.push(botUser ? "/insight" : "/telegram");
        return;
      }
    } catch (err) {
      console.error("Gagal mengecek status Telegram:", err);
    }

    router.push("/telegram");
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl p-6 sm:p-8 shadow-floating border border-sakuGreen-light fade-up">
      <AuthForm onSuccess={handleSuccess} />
    </div>
  );
}