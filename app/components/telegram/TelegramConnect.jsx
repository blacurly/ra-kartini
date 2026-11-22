'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/app/components/providers/AppProvider';
import { Icons } from '@/app/components/ui/Icons';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'sakupuan_bot';

export default function TelegramConnect() {
  const router = useRouter();
  const { user } = useApp();
  const [status, setStatus] = useState({ connected: false, username: '' });
  const connected = status.connected;
  const [opening, setOpening] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');

  // Status awal dari server (tabel bot_users)
  useEffect(() => {
    if (!user?.id) return;
    api.get(`/api/telegram/status?t=${Date.now()}`).then(setStatus).catch(() => {});
  }, [user?.id]);

  // 1) Simpan kode unik ke telegram_link_codes, 2) buka deeplink, 3) tunggu konfirmasi
  const connect = async () => {
    setOpening(true);
    setError('');
    const tab = window.open('', '_blank');
    try {
      if (!user?.id) throw new Error('Pastikan Anda sudah login terlebih dahulu.');

      const code = Math.random().toString(36).substring(2, 10);
      const { error: insertError } = await supabase
        .from('telegram_link_codes')
        .insert({
          code,
          auth_user_id: user.id, // Pastikan nama kolom ini sama dengan yang di TelegramPrompt.jsx
        });

      if (insertError) throw insertError;

      const deeplink = `https://t.me/${BOT}?start=${code}`;
      if (tab) tab.location.href = deeplink;
      else window.location.href = deeplink;
      setWaiting(true);
    } catch (err) {
      if (tab) tab.close();
      setError(err.message || 'Gagal menyiapkan tautan Telegram.');
    } finally {
      setOpening(false);
    }
  };

  // Cek status otomatis: saat kembali dari Telegram Desktop/tab lain, & polling 2 detik
  useEffect(() => {
    if (!user?.id || connected) return;

    const checkStatus = () => {
      api.get(`/api/telegram/status?t=${Date.now()}`)
        .then((res) => {
          if (res?.connected) {
            setStatus(res);
            setWaiting(false);
          }
        })
        .catch(() => {});
    };

    window.addEventListener('focus', checkStatus);
    document.addEventListener('visibilitychange', checkStatus);

    const id = waiting ? setInterval(checkStatus, 2000) : null;
    const stop = waiting ? setTimeout(() => setWaiting(false), 15 * 60 * 1000) : null;

    return () => {
      window.removeEventListener('focus', checkStatus);
      document.removeEventListener('visibilitychange', checkStatus);
      if (id) clearInterval(id);
      if (stop) clearTimeout(stop);
    };
  }, [user?.id, waiting, connected]);

  return (
    <div className="max-w-md mx-auto space-y-5 fade-up">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/dashboard")} aria-label="Kembali" className="p-2 -ml-2 rounded-xl text-sakuText hover:bg-sakuGreen-light">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <h2 className="text-base font-bold text-sakuText">
          Sambungkan Telegram
        </h2>
      </div>

      <div className="bg-white rounded-3xl shadow-soft border border-sakuGreen-light p-6 text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sakuGreen bg-sakuGreen-light px-3 py-1 rounded-full">
          <Icons.Bot className="w-3.5 h-3.5"/> SAKUPUAN Bot Resmi
        </span>
        <div className="w-16 h-16 rounded-full bg-sakuPink-light text-sakuPink flex items-center justify-center mx-auto">
          <Icons.Telegram className="w-8 h-8"/>
        </div>
        <h3 className="text-xl font-extrabold text-sakuText tracking-tight">
          Pencatatan Otomatis Tanpa Ribet!
        </h3>
        <p className="text-[13px] text-sakuText-muted leading-relaxed">
          Tinggal sekali klik untuk membuka Telegram Bot. Catat belanjaan
          dapur cukup kirim pesan singkat seperti chat ke teman!
        </p>
        
        {connected && (
          <p className="text-xs font-semibold text-sakuGreen bg-sakuGreen-light rounded-xl py-2">
            Telegram sudah terhubung {status.username ? `(${status.username})` : ''}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button 
          onClick={connect} 
          disabled={opening || connected} 
          className="w-full flex items-center justify-center gap-2 bg-sakuPink hover:bg-sakuPink-hover disabled:opacity-60 text-white text-sm font-bold py-4 rounded-2xl shadow-floating transition-transform active:scale-[0.98]"
        >
          <Icons.Telegram className="w-5 h-5"/>
          {opening ? "Menyiapkan tautan..." : connected ? "Tersambung" : "Buka Telegram & Hubungkan Otomatis"}
        </button>
        {error && <p role="alert" className="text-xs font-semibold text-sakuPink-dark text-center">{error}</p>}
        {waiting && !connected && (
          <p className="text-xs text-sakuText-muted text-center animate-pulse">
            Menunggu konfirmasi... tekan Start di bot ya!
          </p>
        )}
        <p className="text-[11px] text-sakuText-muted text-center">Menghubungkan langsung ke t.me/{BOT}</p>
      </div>

      <button onClick={() => router.push("/dashboard")} className="w-full border border-sakuGreen text-sakuGreen hover:bg-sakuGreen-light text-sm font-semibold py-3.5 rounded-2xl transition-colors">
        Kembali ke Dashboard Utama
      </button>
    </div>
  );
}