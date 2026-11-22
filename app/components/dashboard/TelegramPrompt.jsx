'use client';

import { useState } from 'react';
import { Icons } from '@/app/components/ui/Icons';
// Sesuaikan jalur import supabase ini dengan struktur folder Anda.
// Jika file supabase ada di folder lib, gunakan: import { supabase } from '@/lib/supabase';
import { supabase } from '@/lib/supabase'; 

export default function TelegramPrompt({ onConnect, onDismiss }) {
  const [loading, setLoading] = useState(false);
  const setOpen = () => onDismiss();
  
  // Inisialisasi Supabase (Sesuaikan jika Anda menggunakan import langsung seperti di atas)
  const handleConnectTelegram = async () => {
    setLoading(true);
    try {
      // 1. Cek user yang sedang login
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Anda harus login terlebih dahulu.");

      // 2. Buat kode unik 8 karakter
      const uniqueCode = Math.random().toString(36).substring(2, 10);
      const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

      // 3. Simpan ke database
      const { error: insertError } = await supabase
        .from('telegram_link_codes')
        .insert({
          code: uniqueCode,
          auth_user_id: user.id,
          expires_at: expiresAt
        });

      if (insertError) throw insertError;

      // 4. Buka Telegram
      // PENTING: Ganti SAKUPUAN_BOT_USERNAME dengan username bot Anda tanpa awalan @
      const telegramUrl = `https://t.me/sakupuan_bot?start=${uniqueCode}`;
      window.open(telegramUrl, '_blank');

      // 5. Tutup pop-up setelah berhasil membuka Telegram
      if (onConnect) onConnect();

    } catch (error) {
      console.error("Gagal menghubungkan:", error.message);
      alert("Terjadi kesalahan saat menghubungkan Telegram. Pastikan Anda sudah login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-sakuText/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="tg-prompt-title" onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="w-14 h-14 rounded-full bg-sakuPink-light text-sakuPink flex items-center justify-center mx-auto mt-6">
          <Icons.Telegram className="w-7 h-7" />
        </div>
        
        <div className="space-y-1.5 text-center p-6 pb-4">
          <h3 id="tg-prompt-title" className="text-lg font-extrabold text-sakuText">
            Sambungkan Telegram
          </h3>
          <p className="text-sm text-sakuText-muted leading-relaxed">
            Biar catat belanja dapur otomatis, cukup kirim pesan singkat ke SAKUPUAN Bot.
          </p>
        </div>
        
        <div className="space-y-2 p-6 pt-2">
          {/* Tombol dimodifikasi untuk memanggil handleConnectTelegram dan menampilkan status loading */}
          <button 
            onClick={handleConnectTelegram} 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-sakuGreen hover:bg-sakuGreen-dark text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Icons.Telegram className="w-4 h-4" /> 
            {loading ? 'Menyiapkan Tautan...' : 'Sambungkan Sekarang'}
          </button>
          
          <button 
            onClick={() => setOpen(false)} 
            disabled={loading}
            className="w-full text-sm font-semibold text-sakuText-light hover:text-sakuText py-3 transition-colors disabled:opacity-50"
          >
            Ingatkan Nanti
          </button>
        </div>
        
      </div>
    </div>
  );
}
