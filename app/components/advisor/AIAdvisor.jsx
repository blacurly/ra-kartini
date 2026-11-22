'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/app/components/providers/AppProvider';
import { Icons } from '@/app/components/ui/Icons';
import { supabase } from '@/lib/supabase';

export default function AIAdvisor({
  name,
  city,
  onClose,
  initialMessage = '',
  autoSendKey = 0,
}) {
  const app = useApp();
  const [msgs, setMsgs] = useState([
    {
      id: 1,
      from: 'bot',
      text: `Halo ${name}! Puan di sini. Mau ngobrolin apa hari ini? Bisa soal belanja dapur, tabungan, atau cicilan.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const endRef = useRef(null);
  const lastAutoKeyRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, typing, suggestion]);

  const ask = async (text) => {
    const q = String(text || '').trim();
    if (!q || typing) return;

    setMsgs((m) => [...m, { id: Date.now(), from: 'user', text: q }]);
    setInput('');
    setTyping(true);
    setPlanSaved(false);
    setSaveError('');

    let reply;
    let nextSuggestion = null;
    try {
      const res = await api.post('/api/advisor/chat', { message: q, city });
      reply = res?.reply;
      nextSuggestion = res?.suggestion ?? null;
    } catch (err) {
      reply =
        err?.status === 429
          ? 'Pelan-pelan ya, Puan lagi kewalahan. Coba lagi sebentar.'
          : 'Maaf, Puan lagi gangguan. Coba lagi ya.';
    }

    setSuggestion(nextSuggestion);
    setMsgs((m) => [...m, { id: Date.now() + 1, from: 'bot', text: reply }]);
    setTyping(false);
  };

  useEffect(() => {
    if (initialMessage && autoSendKey && autoSendKey !== lastAutoKeyRef.current) {
      lastAutoKeyRef.current = autoSendKey;
      ask(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, autoSendKey]);

  const handleSaveToActionPlan = async () => {
    if (!suggestion || savingPlan || planSaved) return;
    setSavingPlan(true);
    setSaveError('');
    try {
      // 1. Ambil user aktif dari Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      }

      // 2. Kirim langsung ke rute API action-plans Supabase kita
      const res = await fetch('/api/action-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          actionText: suggestion.title, // Judul atau isi rekomendasi AI
        }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan ke database.");
      }

      setPlanSaved(true);
    } catch (err) {
      setSaveError(err?.message || 'Gagal menyimpan ke Rencana Aksi.');
    } finally {
      setSavingPlan(false);
    }
  };

  const quick = [
    'Lihat skor keuangan saya',
    'Harga cabai lagi naik?',
    'Gimana mulai nabung?',
    'Cicilan aman berapa?',
    'Cara bagi gaji',
  ];

  return (
    <div className="bg-white rounded-3xl border border-[#EAF3EC] shadow-2xl flex flex-col w-[calc(100vw-2rem)] sm:w-96 h-[min(560px,calc(100vh-10rem))] overflow-hidden fade-up">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAF3EC]">
        <div className="w-10 h-10 rounded-full bg-[#1F5932] text-white flex items-center justify-center">
          <Icons.Bot className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#1E2D24]">Puan AI</p>
          <p className="text-[11px] text-[#1F5932] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F5932]" />
            online
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Tutup chat"
          className="ml-auto p-1.5 rounded-lg text-[#6E8276] hover:bg-[#EAF3EC] hover:text-[#1E2D24]"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            strokeLinecap="round"
          >
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#FBF8F5]">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`flex fade-up ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <p
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.from === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {suggestion && (
          <div className="bg-white border border-[#B8D8C0] rounded-2xl p-3 space-y-2 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1F5932]">
              Rekomendasi Rencana Aksi ({suggestion.cat})
            </p>
            <p className="text-sm font-bold text-[#1E2D24]">{suggestion.title}</p>
            <p className="text-xs text-[#6E8276]">{suggestion.desc}</p>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <button
              type="button"
              onClick={handleSaveToActionPlan}
              disabled={savingPlan || planSaved}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#1F5932] hover:bg-[#164225] disabled:opacity-60 text-white transition"
            >
              {planSaved
                ? '✓ Tersimpan ke Rencana Aksi'
                : savingPlan
                  ? 'Menyimpan...'
                  : '+ Simpan ke Rencana Aksi'}
            </button>
          </div>
        )}

        {typing && (
          <div className="flex justify-start">
            <span className="chat-bubble-bot px-4 py-3 rounded-2xl flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#6E8276] animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}  
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[#EAF3EC] p-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-[#B8D8C0] text-[#1F5932] hover:bg-[#EAF3EC]"
            >
              {q}
            </button>
          ))}
        </div>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya Puan soal keuangan dapur..."
            className="flex-1 text-base sm:text-sm px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#1F5932] focus:ring-1 focus:ring-[#1F5932]"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="Kirim"
            className="w-11 h-11 rounded-xl bg-[#FF4B93] hover:bg-[#E0367B] disabled:opacity-40 text-white flex items-center justify-center"
          >
            <Icons.Send className="w-4 h-4" />
          </button>
        </form>
        <p className="px-3 py-1.5 text-[11px] text-sakuText-muted leading-snug border-t border-sakuGreen-light/60">
          <strong className="font-semibold text-sakuText">Kebijakan AI:</strong> Respon AI bersifat
          bantuan informatif berdasarkan data Anda, bukan kepastian atau nasihat keuangan resmi.
        </p>
      </div>
    </div>
    );
  }
