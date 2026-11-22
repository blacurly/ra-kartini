"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/app/components/auth/AuthForm";
import Modal from "@/app/components/ui/Modal";
import ProfileModal from "@/app/components/profile/ProfileModal";
import CtaBanner from "./CtaBanner";
import Features from "./Features";
import GuideModal from "./GuideModal";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import LandingFooter from "./LandingFooter";
import LandingHeader from "./LandingHeader";
import TelegramSection from "./TelegramSection";
import RegistrationPopup from "@/app/components/auth/RegistrationPopup";

export default function LandingPage() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [auth, setAuth] = useState(null); // null | "login" | "register"
  const [guide, setGuide] = useState(false);
  const [info, setInfo] = useState(null); // null | { title, body }
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#login") {
        setAuth("login");
      } else if (hash === "#register") {
        setAuth("register");
      }
    }
  }, []);

  const openAuth = (mode) => {
    setMenu(false);
    setAuth(mode);
  };

  const handleOpenProfile = async (currentUser) => {
    const activeUser = currentUser || (await supabase.auth.getUser())?.data?.user;
    if (!activeUser) return;

    setProfileUser({
      id: activeUser.id,
      name:
        activeUser.user_metadata?.full_name ||
        activeUser.user_metadata?.name ||
        "",
      email: activeUser.email || "",
      phone:
        activeUser.phone ||
        activeUser.user_metadata?.phone ||
        "",
    });
  };

  const handleSaveProfile = async ({ name, email, phone }) => {
    const updates = {
      data: {
        full_name: name,
        name,
        phone,
      },
    };

    if (email && email !== profileUser?.email) {
      updates.email = email;
    }

    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) {
      throw new Error(error.message || "Gagal menyimpan profil");
    }

    if (profileUser?.id) {
      await supabase
        .from("profiles")
        .upsert(
          {
            id: profileUser.id,
            full_name: name,
            phone,
          },
          { onConflict: "id" }
        );
    }

    if (data?.user) {
      router.refresh();
    }

    setProfileUser(null);
  };

  const handleAuthSuccess = async (res) => {
    setAuth(null);

    try {
      let userId = res?.user?.id || res?.data?.user?.id;
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

        router.push(botUser ? "/insight" : "/telegram");
        return;
      }
    } catch (err) {
      console.error("Gagal mengecek status Telegram:", err);
    }

    router.push("/telegram");
  };

  return (
    <div className="bg-sakuIvory text-sakuText antialiased selection:bg-sakuPink-light selection:text-sakuPink-dark">
      <LandingHeader
        menu={menu}
        setMenu={setMenu}
        openAuth={openAuth}
        onOpenProfile={handleOpenProfile}
      />
      <main>
        <Hero openAuth={openAuth} />
        <Features />
        <HowItWorks />
        <TelegramSection openAuth={openAuth} onOpenGuide={() => setGuide(true)} />
        <CtaBanner openAuth={openAuth} />
      </main>
      <LandingFooter setInfo={setInfo} />

      {/* Modal khusus Login */}
      <Modal open={auth === "login"} onClose={() => setAuth(null)}>
        <AuthForm
          mode="login"
          onMode={setAuth}
          onSuccess={handleAuthSuccess}
        />
      </Modal>

      {/* Pop-up khusus Register */}
      {auth === "register" && (
        <RegistrationPopup
          onClose={() => setAuth(null)}
        />
      )}

      {/* Modal Edit Profil saat tombol N diklik */}
      {profileUser && (
        <ProfileModal
          initial={profileUser}
          onSave={handleSaveProfile}
          onClose={() => setProfileUser(null)}
        />
      )}

      <GuideModal
        open={guide}
        onClose={() => setGuide(false)}
        onStart={() => {
          setGuide(false);
          setAuth("register");
        }}
      />
      <Modal open={!!info} onClose={() => setInfo(null)}>
        <h3 className="text-lg font-bold mb-2 pr-6">{info?.title}</h3>
        <p className="text-sm text-sakuText-muted leading-relaxed mb-5">{info?.body}</p>
        <button onClick={() => setInfo(null)} className="w-full bg-sakuGreen text-white font-semibold py-2.5 rounded-lg text-sm">
          Tutup
        </button>
      </Modal>
    </div>
  );
}