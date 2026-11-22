'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/app/components/ui/Logo';
import { CloseIcon } from '@/app/components/ui/Icons';
import { Container } from './primitives';
import { supabase } from '@/lib/supabase';

const navLinks = [
  ["/#fitur", "Fitur"],
  ["/#cara-kerja", "Cara Kerja"],
  ["/#panduan", "Panduan"],
  ["/tentang-kami", "Tentang Kami"],
];

function getInitial(user) {
  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    '';
  const trimmed = fullName.trim();
  return trimmed ? trimmed[0].toUpperCase() : 'U';
}

function UserActions({ user, initial, onOpenProfile, onAfterClick, compact = false }) {
  if (!user) return null;

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center gap-2.5"}>
      {!compact && (
        <Link
          href="/dashboard"
          onClick={onAfterClick}
          className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-semibold bg-sakuPink-light text-sakuPink-dark border border-sakuPink-border hover:opacity-90 transition-opacity"
        >
          Beranda
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          onAfterClick?.();
          onOpenProfile?.(user);
        }}
        title={user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Edit Profil"}
        className="w-9 h-9 rounded-full bg-sakuPink-light text-sakuPink-dark border border-sakuPink-border font-bold text-sm flex items-center justify-center shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
      >
        {initial}
      </button>
    </div>
  );
}

export default function LandingHeader({ menu, setMenu, openAuth, onOpenProfile }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (active) setUser(data?.user ?? null);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const initial = getInitial(user);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-sakuIvory/90 border-b border-sakuGreen-light/60">
      <Container>
        <div className="h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group rounded-lg p-1">
            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Logo />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center text-lg sm:text-xl font-bold tracking-widest leading-none">
                <span className="text-sakuPink">SAKU</span>
                <span className="text-sakuGreen">PUAN</span>
              </div>
              <span className="text-[11px] text-sakuText-muted font-medium mt-1">
                Keuangan Rumah Tangga
              </span>
            </div>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLinks.map(([h, l]) => {
              const isInternalRoute = h.startsWith('/');
              return isInternalRoute ? (
                <Link key={h} href={h} className="hover:text-sakuGreen transition-colors py-1">
                  {l}
                </Link>
              ) : (
                <a key={h} href={h} className="hover:text-sakuGreen transition-colors py-1">
                  {l}
                </a>
              );
            })}
          </nav>

          {/* DESKTOP AUTH / USER ACTIONS */}
          <div className="hidden md:flex items-center gap-2.5">
            {user ? (
              <UserActions
                user={user}
                initial={initial}
                onOpenProfile={onOpenProfile}
              />
            ) : (
              <>
                <button onClick={() => openAuth("login")} className="text-sm font-semibold text-sakuGreen hover:text-sakuGreen-hover px-3 py-2">
                  Login
                </button>
                <button onClick={() => openAuth("register")} className="bg-sakuGreen hover:bg-sakuGreen-hover text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                  Daftar
                </button>
              </>
            )}
          </div>

          {/* MOBILE RIGHT BAR: Tombol Inisial N (Edit Profil) + Hamburger */}
          <div className="flex md:hidden items-center gap-1.5">
            <UserActions
              user={user}
              initial={initial}
              onOpenProfile={onOpenProfile}
              onAfterClick={() => setMenu(false)}
              compact
            />
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              aria-label="Buka Menu Navigasi"
              className="p-2 hover:text-sakuGreen"
            >
              {menu ? (
                <CloseIcon />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </Container>

      {/* MOBILE NAV */}
      {menu && (
        <div className="md:hidden fade-up border-b border-sakuGreen-light bg-sakuIvory px-4 pt-3 pb-6 space-y-1">
          {navLinks.map(([h, l]) => {
            const isInternalRoute = h.startsWith('/');
            return isInternalRoute ? (
              <Link
                key={h}
                href={h}
                onClick={() => setMenu(false)}
                className="block px-3 py-2.5 rounded-md text-base font-medium hover:bg-sakuGreen-light"
              >
                {l}
              </Link>
            ) : (
              <a
                key={h}
                href={h}
                onClick={() => setMenu(false)}
                className="block px-3 py-2.5 rounded-md text-base font-medium hover:bg-sakuGreen-light"
              >
                {l}
              </a>
            );
          })}
          <div className="pt-4 mt-2 border-t border-sakuGreen-light/60 flex flex-col gap-2">
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMenu(false)}
                className="w-full py-2.5 px-3 font-semibold text-sakuPink-dark bg-sakuPink-light border border-sakuPink-border rounded-full flex items-center justify-center"
              >
                Beranda
              </Link>
            ) : (
              <>
                <button onClick={() => openAuth("login")} className="w-full py-2.5 font-medium text-sakuGreen border border-sakuGreen/30 rounded-lg">
                  Login
                </button>
                <button onClick={() => openAuth("register")} className="w-full py-2.5 font-semibold text-white bg-sakuGreen rounded-lg shadow-sm">
                  Mulai Kelola Keuangan
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}