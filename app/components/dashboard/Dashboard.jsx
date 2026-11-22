'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/app/components/providers/AppProvider';
import { Icons } from '@/app/components/ui/Icons';
import TelegramPrompt from './TelegramPrompt';
import { supabase } from '@/lib/supabase';
// 1. Import fungsi kalkulasi skor
import { calculatePeriodScore } from '@/lib/scoring';

export default function Dashboard() {
  const router = useRouter();
  const { user, telegramPromptSeen, setTelegramPromptSeen } = useApp(); // "score" dari useApp bisa dihapus nanti jika sudah tak terpakai
  
  const [namaPengguna, setNamaPengguna] = useState("Memuat...");
  const [isTelegramConnected, setIsTelegramConnected] = useState(true);
  
  // 2. State baru untuk menampung hasil perhitungan skor riil
  const [periodScore, setPeriodScore] = useState(null);

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user: activeUser } } = await supabase.auth.getUser();
      
      if (activeUser) {
        if (activeUser.user_metadata?.name) {
          setNamaPengguna(activeUser.user_metadata.name);
        } else if (user?.name) {
          setNamaPengguna(user.name);
        }

        // Cek status Telegram
        const { data: botUser } = await supabase
          .from("bot_users")
          .select("auth_user_id")
          .eq("auth_user_id", activeUser.id)
          .maybeSingle();

        setIsTelegramConnected(!!botUser);

        // 3. Tarik data transaksi & Hitung Skor Dinamis
        // Catatan: Pastikan nama kolom untuk ID pengguna di tabel transactions adalah "user_id"
        // Jika menggunakan nama lain (misal "auth_user_id"), silakan ubah bagian .eq() di bawah ini
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select("type, category, amount")
          .eq("user_id", activeUser.id);

        if (txError) {
          console.error("DETAIL ERROR SUPABASE:", txError.message);
        }

        // 2. MAPPING FINAL - Paksa kategori sesuai daftar CATEGORIES
        const mappedTransactions = (txData || []).map(tx => {
          let cat = tx.category ? tx.category.toLowerCase().trim() : "lainnya";
        
          // --- PEMASUKAN ---
          if (tx.type === 'income') {
            if (cat.includes('gaji') || cat.includes('utama')) cat = 'gaji';
            else if (cat.includes('pinjam') || cat.includes('utang')) cat = 'pinjaman'; // Pinjaman cair
            else cat = 'uang-masuk'; 
          }

          // --- PENGELUARAN ---
          else if (tx.type === 'expense') {
            if (cat.includes('tabung') || cat.includes('simpan')) cat = 'tabungan';
            else if (cat.includes('cicil') || cat.includes('utang') || cat.includes('pinjam') || cat.includes('paylater')) cat = 'cicilan';
            else if (cat.includes('pangan') || cat.includes('dapur') || cat.includes('sembako')) cat = 'belanja-dapur';
            else if (cat.includes('makan') || cat.includes('minum') || cat.includes('jajan') || cat.includes('restoran')) cat = 'makanan';
            else if (cat.includes('tagihan') || cat.includes('rutin') || cat.includes('listrik') || cat.includes('air')) cat = 'tagihan';
            else if (cat.includes('transport') || cat.includes('bensin') || cat.includes('gojek') || cat.includes('grab')) cat = 'transportasi';
            else if (cat.includes('top up') || cat.includes('top-up') || cat.includes('emoney')) cat = 'top-up';
            else if (cat.includes('sehat') || cat.includes('obat') || cat.includes('dokter')) cat = 'kesehatan';
            else if (cat.includes('didik') || cat.includes('sekolah') || cat.includes('buku') || cat.includes('kursus')) cat = 'pendidikan';
            else if (cat.includes('hibur') || cat.includes('nonton') || cat.includes('main') || cat.includes('langganan')) cat = 'hiburan';
            else if (cat.includes('biaya') || cat.includes('admin') || cat.includes('pajak')) cat = 'biaya';
            else cat = 'uang-keluar';
          }

          return {
            flow: tx.type === 'expense' ? 'out' : 'in',
            cat: cat,
            amount: tx.amount
          };
        });

        // 3. Cek hasil terjemahan di konsol
        console.log("Data yang masuk ke Mesin Skor:", mappedTransactions);

        // Hitung jumlah hari unik secara otomatis dari tanggal transaksi, 
        // atau fallback ke angka minimal (misal: 7 hari atau length data)
          const uniqueDays = new Set((txData || []).map(tx => tx.created_at ? tx.created_at.split('T')[0] : '')).size;
          const activeDays = uniqueDays > 0 ? uniqueDays : 7;

        // 4. Masukkan data yang SUDAH DITERJEMAHKAN ke dalam perhitungan
          const calculated = calculatePeriodScore({
          transactions: mappedTransactions, 
          loggedDays: activeDays, // Sesuai hitungan hari aktif Anda > untuk test ubah jadi 30
          declaredNoDebt: false,
          emergencyMonths: 3, 
          periodClosed: false      // <-- UBAH SEMENTARA JADI TRUE (Tutup Buku) untuk test
        });
        
        console.log("Hasil Hitung Skor:", calculated);
        setPeriodScore(calculated);

        if (calculated && calculated.totalScore !== null) {
          try {
            await fetch('/api/scoring', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: activeUser.id,
                transactions: mappedTransactions,
                loggedDays: activeDays,
                declaredNoDebt: false,
                emergencyMonths: 3,
                periodClosed: false
              }),
            });
            console.log("Skor berhasil disinkronkan ke database Supabase!");
          } catch (apiErr) {
            console.error("Gagal mengirim skor ke API:", apiErr);
          }
        }

      } else {
        setIsTelegramConnected(true);
      }
    }  
    
    fetchUserData();
  }, [user?.name]);

  const Chevron = ({ className = "" }) => (
    <svg className={`w-5 h-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>
  );
  
  const card = "w-full text-left bg-white rounded-[20px] border border-sakuGreen-light p-4 flex items-center gap-3 transition-shadow hover:shadow-soft";
  
  if (isTelegramConnected === null) {
    return <div className="max-w-xl mx-auto p-6 text-center text-xs text-gray-400">Memeriksa status akun...</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 fade-up">
      {/* Header */}
      <div>
        <div>
          <p className="text-xs font-semibold text-sakuText-muted">Halo</p>
          <h2 className="text-xl font-extrabold text-sakuText tracking-tight capitalize">
            {namaPengguna}
          </h2>
        </div>
      </div>

      {/* Card 1 — Financial Health Score (Kini Dinamis) */}
      <section className="rounded-3xl bg-linear-to-br from-sakuGreen to-sakuGreen-dark text-white p-5 shadow-soft space-y-3">
        <div className="flex justify-between text-sakuGreen-border">
          <span className="text-[10px] font-extrabold uppercase tracking-wider">
            Skor Kesehatan Keuangan
          </span>
          <span className="text-[11px]">Bulan Ini</span>
        </div>
        
        <p className="leading-none">
          <span className="text-5xl font-extrabold">
            {/* Tampilkan skor riil, atau "-" jika data belum cukup */}
            {periodScore ? (periodScore.totalScore !== null ? periodScore.totalScore : "-") : "..."}
          </span>
          <span className="text-lg font-semibold text-sakuGreen-border">
            /100
          </span>
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold bg-sakuGreen-border text-sakuGreen-dark px-3 py-1 rounded-full">
            ● {periodScore ? periodScore.label : "Memuat..."}
          </span>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('sakupuan:open-advisor', {
                  detail: { message: 'Analisa skor keuangan saya' },
                })
              );
            }}
            className="text-xs font-bold text-white hover:underline"
          >
            Lihat Deskripsi →
          </button>
        </div>
      </section>

      {/* Card 3 — AI Insight */}
      <button onClick={() => router.push("/insight")} className="w-full text-left bg-sakuPink-light border border-sakuPink-border rounded-[20px] p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-sakuPink text-white flex items-center justify-center shrink-0">
          <Icons.Bulb className="w-5 h-5"/>
        </span>
        <span className="flex-1">
          <span className="block text-[10px] font-bold uppercase text-sakuPink">
            Wawasan Arus Kas
          </span>
          <span className="block text-sm font-extrabold text-sakuText">
            {periodScore?.label ? `Status: ${periodScore.label}` : "Wawasan Arus Kas"}
          </span>
          <span className="block text-xs text-sakuText-muted line-clamp-2">
            {periodScore?.insight ? periodScore.insight : "Catat pengeluaran di Telegram agar AI bisa memberikan insight khusus."}
          </span>
        </span>
        <Chevron className="text-sakuPink"/>
      </button>

      {/* Card 4 — Forecast */}
      <button onClick={() => router.push("/forecast")} className={card}>
        <span className="w-10 h-10 rounded-xl bg-sakuGreen-light text-sakuGreen flex items-center justify-center shrink-0">
          <Icons.Trend className="w-5 h-5"/>
        </span>
        <span className="flex-1">
          <span className="block text-[10px] font-bold uppercase text-sakuGreen">
            Prediksi
          </span>
          <span className="block text-sm font-bold text-sakuText">
            Tren Harga Pangan 
          </span>
          <span className="block text-xs text-sakuText-muted">
            Cek harga pangan terbaru dan prediksinya.
          </span>
        </span>
        <Chevron className="text-sakuGreen"/>
      </button>

      {/* Card 5 — Action Plan */}
      <button onClick={() => router.push("/action-plan")} className={`${card} border-dashed border-sakuPink`}>
        <span className="w-10 h-10 rounded-xl bg-sakuPink-light text-sakuPink flex items-center justify-center shrink-0">
          <Icons.List className="w-5 h-5"/>
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-sakuText">
            Rekomendasi Aksi Tersedia
          </span>
          <span className="block text-xs text-sakuText-muted">
            Langkah NYATA buat bantu capai tujuanmu.
          </span>
        </span>
        <Chevron className="text-sakuPink"/>
      </button>

      {!isTelegramConnected && !telegramPromptSeen && (
        <TelegramPrompt 
          onConnect={() => {
            setTelegramPromptSeen(true);
            router.push("/telegram");
          }} 
          onDismiss={() => setTelegramPromptSeen(true)}
        />
      )}
    </div>
  );
}