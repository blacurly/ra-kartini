'use client';

import { Container } from './primitives';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CtaBanner({ openAuth }) {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (active) {
        setUser(data?.user ?? null);
        setCheckingAuth(false);
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setCheckingAuth(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="pb-14 sm:pb-16 lg:pb-20">
      <Container>
        <div className="relative rounded-3xl bg-sakuGreen text-white px-6 py-10 sm:p-12 lg:p-16 overflow-hidden shadow-floating text-center">
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" fill="none">
            <circle cx="400" cy="200" r="300" stroke="white" strokeWidth="40" />
            <circle cx="400" cy="200" r="200" stroke="#FF4B93" strokeWidth="20" />
          </svg>
          <div className="relative max-w-2xl mx-auto space-y-6">
            <h2 className="text-[28px] sm:text-4xl font-bold tracking-tight text-balance">
              Mulai Kenali Pola Pengeluaranmu.
            </h2>
            <p className="text-base sm:text-lg text-emerald-100 leading-relaxed">
              Bangun kebiasaan mencatat keuangan dan pahami perubahan
              pengeluaran belanja dengan lebih baik bersama SAKUPUAN.
            </p>
            {!checkingAuth && !user && (
              <div className="pt-2 flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => openAuth("register")}
                  className="w-full sm:w-auto bg-sakuPink hover:bg-sakuPink-hover font-bold px-8 py-3.5 rounded-lg shadow-md transition-all active:scale-[0.98]"
                >
                  Daftar Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}