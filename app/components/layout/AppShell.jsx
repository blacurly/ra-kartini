"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AdvisorToggle from "@/app/components/advisor/AdvisorToggle";
import ProfileModal from "@/app/components/profile/ProfileModal";
import LogoutButton from "@/app/components/auth/LogoutButton";
import { useApp } from "@/app/components/providers/AppProvider";
import { Icons } from "@/app/components/ui/Icons";
import Logo from "@/app/components/ui/Logo";
import { NAV_ITEMS, NO_NAV_PREFIXES, WIDE_PREFIXES } from "@/lib/constants";
import { supabase } from "@/lib/supabase"; // 1. Import Supabase

const startsWithAny = (path, prefixes) => prefixes.some((p) => path.startsWith(p));

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, authLoading, updateProfile, city } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  // 2. State untuk menyimpan data pengguna dari Supabase
  const [supabaseUser, setSupabaseUser] = useState(null);

  const isAuthPage = pathname.startsWith("/auth");
  const showAppNav = !startsWithAny(pathname, NO_NAV_PREFIXES);
  const wide = startsWithAny(pathname, WIDE_PREFIXES);

  // 3. Tarik data profil pengguna dari Supabase setelah render pertama
  useEffect(() => {
    async function fetchUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setSupabaseUser({
          name: authUser.user_metadata?.name || "Puan",
          email: authUser.email || "",
          phone: authUser.user_metadata?.phone || ""
        });
      }
    }
    fetchUser();
  }, []);

  // 4. Gabungkan data: Jika ada dari Supabase pakai itu, jika tidak fallback ke Context (simulasi)
  const displayUser = supabaseUser || user;

  // Client-side route guard (the API enforces auth too).
  useEffect(() => {
    if (!authLoading && !user && !isAuthPage) router.replace("/auth");
  }, [authLoading, user, isAuthPage, router]);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const ready = isAuthPage || (!authLoading && user);

  return (
    <div className="min-h-screen bg-sakuIvory text-sakuText font-sans flex flex-col selection:bg-sakuPink-light selection:text-sakuPink">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sakuGreen-light shadow-sm">
        <div className="relative max-w-275 mx-auto px-4 h-16 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-8">
          <Link href="/" className="flex items-center gap-2 justify-self-start">
            <Logo className="w-7 h-7" />
            <div className="flex flex-col">
              <div className="flex items-center text-base font-extrabold tracking-wider leading-none">
                <span className="text-sakuPink">SAKU</span>
                <span className="text-sakuGreen">PUAN</span>
              </div>
              <span className="text-[10px] text-sakuText-muted font-medium hidden sm:inline">Dapur Tenang, Dompet Senang</span>
            </div>
          </Link>

          {showAppNav && (
            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 text-sm font-semibold">
              {NAV_ITEMS.map((n) => {
                const Icon = Icons[n.icon];
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${
                      pathname.startsWith(n.href) ? "bg-sakuGreen-light text-sakuGreen" : "text-sakuText-light hover:text-sakuGreen"
                    }`}
                  >
                    <Icon className="w-4 h-4 hidden lg:block" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {showAppNav && displayUser && (
            <div className="flex items-center gap-2 ml-auto mr-2 justify-self-end">
              <button
                onClick={() => setProfileOpen(true)}
                aria-label="Profil"
                aria-haspopup="dialog"
                className="w-10 h-10 rounded-full bg-sakuPink-light text-sakuPink hover:ring-2 hover:ring-sakuPink-border flex items-center justify-center text-sm font-extrabold transition-shadow capitalize"
              >
                {/* 5. Pakai displayUser untuk inisial tombol profil */}
                {displayUser.name.trim() ? (
                  displayUser.name.trim()[0]
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="md:hidden w-10 h-10 rounded-full bg-white shadow-soft text-sakuText flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round">
                  {menuOpen ? <path d="M6 18 18 6M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          )}
        </div>

        {showAppNav && menuOpen && (
          <>
            <div className="md:hidden fixed inset-0 top-16 z-[-1] bg-sakuText/30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <nav id="mobile-menu" aria-label="Menu halaman" className="md:hidden absolute top-full inset-x-0 bg-white border-b border-sakuGreen-light shadow-floating px-3 py-3 fade-up">
              {NAV_ITEMS.map((n) => {
                const Icon = Icons[n.icon];
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      active ? "bg-sakuGreen-light text-sakuGreen" : "text-sakuText-muted hover:bg-sakuIvory"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </header>

      <main className={`flex-1 w-full mx-auto px-4 py-6 sm:py-8 ${wide ? "md:max-w-none md:px-0" : "max-w-250"}`}>
        {ready ? children : <p className="text-center text-sm text-sakuText-light py-20">Memuat...</p>}
      </main>

      {/* 6. Teruskan displayUser ke ProfileModal */}
      {profileOpen && displayUser && (
        <ProfileModal
          initial={{ name: displayUser.name, email: displayUser.email, phone: displayUser.phone || "" }}
          onSave={async (v) => {
            await updateProfile(v);
            setProfileOpen(false);
          }}
          onClose={() => setProfileOpen(false)}
        >
          <div className="mt-4 pt-4 border-t border-gray-100">
            <LogoutButton />
           </div>
        </ProfileModal> 
      )}
      {showAppNav && displayUser && <AdvisorToggle name={displayUser.name} city={city} />}

      <footer className="hidden md:block bg-sakuText text-white py-6 mt-auto border-t border-sakuText-muted/40">
        <div className="max-w-250 mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5" />
            <span className="font-bold text-white">SAKUPUAN Prototype</span>
          </div>
          <p>© 2026 SAKUPUAN. Asesmen Finansial & Pencatatan Kontekstual.</p>
        </div>
      </footer>
    </div>
  );
}