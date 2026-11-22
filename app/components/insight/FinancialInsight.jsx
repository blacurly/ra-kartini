'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { CATEGORIES } from '@/lib/categories';
import { pctLabel, rp } from '@/lib/format';
import { supabase } from "@/lib/supabase";
import BudgetSection from '@/app/components/budgets/BudgetSection';

ChartJS.register(ArcElement, Tooltip);

function CatIcon({ id, className = 'w-5 h-5' }) {
    const catData = CATEGORIES[id] || CATEGORIES['lainnya'];
    return (<svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {catData.icon.map((d) => <path key={d} d={d}/>)}
    </svg>);
}

const Chevron = ({ dir = 'right', className = 'w-5 h-5' }) => (<svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : dir === 'down' ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'}/>
  </svg>);

export default function FinancialInsight() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [periodIdx, setPeriodIdx] = useState(null); 
    const [flow, setFlow] = useState('out');
    const [openCat, setOpenCat] = useState(null);

    // Ambil data langsung dari Supabase dan terjemahkan kategorinya
    useEffect(() => {
      async function fetchInsightData() {
        try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: txData, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id);

          if (error) {
            console.error("Error fetching transactions:", error.message);
            return;
          }

          // MAPPING KATEGORI (Sama persis dengan yang sukses di Dashboard)
          const formattedTransactions = (txData || []).map((tx, index) => {
            let cat = tx.category ? tx.category.toLowerCase().trim() : "lainnya";

            if (tx.type === 'income') {
              if (cat.includes('gaji') || cat.includes('utama')) cat = 'gaji';
              else if (cat.includes('pinjam') || cat.includes('utang')) cat = 'pinjaman';
              else cat = 'uang-masuk'; 
            } else if (tx.type === 'expense') {
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

            // Ekstrak periode dari created_at (contoh: "2026-10")
            const dateStr = tx.created_at ? tx.created_at.split('T')[0] : '2026-10-01';
            const periodKey = dateStr.slice(0, 7);

            return {
              id: tx.id || index,
              title: tx.item || tx.description || cat,
              amount: Number(tx.amount || 0),
              flow: tx.type === 'expense' ? 'out' : 'in',
              cat: cat,
              account: 'utama',
              date: dateStr,
              period: periodKey
            };
          });

          setTransactions(formattedTransactions);
        } catch (err) {
          console.error("Gagal memuat insight:", err);
        } finally {
          setLoading(false);
        }
      }

      fetchInsightData();
    }, []);

    if (loading) {
        return <p className="text-center text-sm text-gray-500 py-20">Memuat rincian Insight...</p>;
    }

    // Buat daftar periode unik dari data transaksi
    const uniquePeriods = Array.from(new Set(transactions.map(t => t.period))).sort();
    const PERIODS = uniquePeriods.length > 0 
      ? uniquePeriods.map(p => ({ key: p, label: `Periode ${p}` }))
      : [{ key: '', label: 'Belum ada transaksi' }];

    const idx = periodIdx ?? PERIODS.length - 1;
    const period = PERIODS[idx] ?? { key: '', label: 'Belum ada transaksi' };
    
    const txns = transactions.filter((t) => t.period === period.key);
    const totalIn = txns.filter((t) => t.flow === 'in').reduce((s, t) => s + t.amount, 0);
    const totalOut = txns.filter((t) => t.flow === 'out').reduce((s, t) => s + t.amount, 0);
    const diff = totalIn - totalOut;
    const flowTotal = flow === 'in' ? totalIn : totalOut;
    const flowLabel = flow === 'in' ? 'pemasukan' : 'pengeluaran';
    
    const groups = new Map();
    txns.filter((t) => t.flow === flow).forEach((t) => groups.set(t.cat, [...(groups.get(t.cat) ?? []), t]));
    
    const breakdown = [...groups.entries()]
        .map(([id, items]) => {
        const amount = items.reduce((s, t) => s + t.amount, 0);
        return { id, items, amount, pct: flowTotal > 0 ? (amount / flowTotal) * 100 : 0 };
    })
        .sort((a, b) => b.amount - a.amount);

    let cumulative = 0;
    const markers = breakdown.map((b) => {
        const mid = flowTotal > 0 ? (cumulative + b.amount / flowTotal / 2) * 2 * Math.PI : 0;
        if (flowTotal > 0) cumulative += b.amount / flowTotal;
        return { id: b.id, show: b.pct >= 8, left: 50 + 39 * Math.sin(mid), top: 50 - 39 * Math.cos(mid) };
    });

    const chartData = {
        labels: breakdown.map((b) => CATEGORIES[b.id]?.label || b.id),
        datasets: [{ data: breakdown.map((b) => b.amount), backgroundColor: breakdown.map((b) => CATEGORIES[b.id]?.color || '#8A9A90'), borderColor: '#FFFFFF', borderWidth: 3, hoverOffset: 0 }],
    };
    
    const chartOptions = {
        cutout: '56%',
        maintainAspectRatio: true,
        animation: { duration: 600 },
        plugins: {
            tooltip: {
                backgroundColor: '#1E2D24',
                padding: 10,
                cornerRadius: 12,
                displayColors: false,
                callbacks: { label: (ctx) => `${rp(ctx.parsed)} (${pctLabel(breakdown[ctx.dataIndex].pct)}%)` },
            },
        },
        onClick: (_, elements) => {
            const hit = elements[0];
            if (hit)
                setOpenCat(breakdown[hit.index].id);
        },
    };

    const changePeriod = (delta) => {
        setPeriodIdx(idx + delta);
        setOpenCat(null);
    };

    const top = breakdown[0];

    return (
      <div className="max-w-xl mx-auto lg:max-w-none grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-6 items-start fade-up">
        {/* Kolom kiri: header, ringkasan arus kas, toggle */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <section className="relative rounded-3xl bg-gradient-to-br from-sakuGreen to-sakuGreen-dark text-white px-5 pt-5 pb-16 shadow-soft">
            <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <span className="absolute -top-20 -right-16 w-52 h-52 rounded-full border-[32px] border-white/[0.06]"/>
              <span className="absolute -bottom-24 -left-10 w-40 h-40 rounded-full bg-sakuPink/10"/>
            </div>

            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-sakuGreen-border">Rekap Keuangan</p>
              <h2 className="text-xl font-extrabold tracking-tight">Wawasan Keuangan</h2>
            </div>

            <div className="relative mt-4 flex items-center justify-between">
              <button onClick={() => changePeriod(-1)} disabled={idx <= 0} aria-label="Periode sebelumnya" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <Chevron dir="left"/>
              </button>
              <div className="text-center">
                <p className="text-[11px] font-medium text-sakuGreen-border">Periode</p>
                <p className="text-sm font-bold">{period.label}</p>
              </div>
              <button onClick={() => changePeriod(1)} disabled={idx >= PERIODS.length - 1} aria-label="Periode berikutnya" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <Chevron />
              </button>
            </div>
          </section>

          {/* Ringkasan arus kas */}
          <div className="relative z-10 -mt-16 mx-3 bg-white rounded-[20px] shadow-soft border border-sakuGreen-light p-4">
            <div className="grid grid-cols-2 divide-x divide-sakuGreen-light text-center">
              <div className="px-2">
                <p className="flex items-center justify-center gap-1.5 text-xs text-sakuText-muted"><span className="w-2 h-2 rounded-[3px] bg-sakuGreen"/>Pemasukan</p>
                <p className="mt-1 text-[15px] font-extrabold text-sakuGreen tabular-nums">{rp(totalIn)}</p>
              </div>
              <div className="px-2">
                <p className="flex items-center justify-center gap-1.5 text-xs text-sakuText-muted"><span className="w-2 h-2 rounded-[3px] bg-sakuPink-dark"/>Pengeluaran</p>
                <p className="mt-1 text-[15px] font-extrabold text-sakuPink-dark tabular-nums">{rp(totalOut)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-sakuGreen-border/70 text-center">
              <p className="text-xs text-sakuText-muted">Selisih</p>
              <p className="text-2xl font-extrabold tracking-tight text-sakuText tabular-nums">{rp(diff)}</p>
              <p className={`mt-0.5 text-[11px] font-semibold ${diff < 0 ? 'text-sakuPink-dark' : 'text-sakuGreen'}`}>
                {diff < 0 ? 'Pengeluaran lebih besar dari pemasukan' : diff > 0 ? 'Masih ada sisa, yuk sisihkan buat tabungan' : 'Belum ada arus kas di periode ini'}
              </p>
            </div>
          </div>

          {/* Toggle pemasukan / pengeluaran */}
          <div role="tablist" aria-label="Jenis arus kas" className="grid grid-cols-2 p-1 bg-white border border-sakuGreen-light rounded-full">
            {['in', 'out'].map((f) => (
              <button key={f} role="tab" aria-selected={flow === f} onClick={() => { setFlow(f); setOpenCat(null); }} className={`py-2.5 rounded-full text-sm font-bold transition-colors ${flow === f ? 'bg-sakuGreen text-white shadow-soft' : 'text-sakuText-muted hover:text-sakuGreen'}`}>
                {f === 'in' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>
        </div>

        {/* Kolom kanan: rincian kategori + anggaran belanja*/}
        <div className="space-y-4">
          <section className="bg-white rounded-3xl border border-sakuGreen-light p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-extrabold text-sakuText">Rincian kategori</h3>
              {breakdown.length > 0 && <span className="text-[11px] font-semibold text-sakuText-light">{breakdown.length} kategori</span>}
            </div>

            {breakdown.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <span className="w-14 h-14 rounded-2xl bg-sakuGreen-light text-sakuGreen flex items-center justify-center mx-auto">
                <CatIcon id={flow === 'in' ? 'uang-masuk' : 'uang-keluar'} className="w-7 h-7"/>
              </span>
              <p className="text-sm font-bold text-sakuText">Belum ada {flowLabel} di periode ini</p>
              <p className="text-xs text-sakuText-muted max-w-xs mx-auto leading-relaxed">
                Catat {flow === 'in' ? 'gaji atau uang masuk' : 'belanjaan'} lewat Telegram, nanti rekapnya otomatis muncul di sini.
              </p>
              <button onClick={() => router.push('https://t.me/sakupuan_bot')} className="inline-flex items-center gap-2 bg-sakuPink hover:bg-sakuPink-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
                Catat via Telegram
              </button>
            </div>
          ) : (
            <>
              <div className="relative w-56 h-56 mx-auto my-6">
                <Doughnut data={chartData} options={chartOptions} aria-label={`Diagram ${flowLabel} per kategori`}/>
                {markers.filter((m) => m.show).map((m) => (
                  <span key={m.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-white pointer-events-none" style={{ left: `${m.left}%`, top: `${m.top}%` }}>
                    <CatIcon id={m.id} className="w-[18px] h-[18px]"/>
                  </span>
                ))}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-semibold text-sakuText-light">Total {flowLabel}</span>
                  <span className="text-[15px] font-extrabold text-sakuText tabular-nums">{rp(flowTotal)}</span>
                </div>
              </div>

              {top && CATEGORIES[top.id] && (
                <p className="rounded-2xl bg-sakuPink-light border border-sakuPink-border px-4 py-3 text-xs text-sakuText leading-relaxed">
                  Pos <b>{CATEGORIES[top.id].label}</b> paling besar bulan ini, yakni {pctLabel(top.pct)}% dari total {flowLabel} .
                </p>
              )}

              <ul className="mt-2">
                {breakdown.map((b) => {
                  const cat = CATEGORIES[b.id] || { label: b.id, color: '#8A9A90' };
                  const open = openCat === b.id;
                  return (
                    <li key={b.id} className="border-b border-sakuGreen-light last:border-0">
                      <button onClick={() => setOpenCat(open ? null : b.id)} aria-expanded={open} className="w-full flex items-center gap-3 py-4 text-left group">
                        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}>
                          <CatIcon id={b.id}/>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-sakuText-muted">{cat.label}</span>
                          <span className="block text-[15px] font-extrabold text-sakuText tabular-nums">{rp(b.amount)}</span>
                          <span className="block text-[11px] text-sakuText-light">Dari <b className="text-sakuText">{b.items.length}</b> transaksi</span>
                        </span>
                        <span className="text-sm font-bold text-sakuText tabular-nums">{pctLabel(b.pct)}%</span>
                        <Chevron className={`w-5 h-5 shrink-0 text-sakuText-light group-hover:text-sakuGreen transition-transform ${open ? 'rotate-90' : ''}`}/>
                      </button>
                      {open && (
                        <ul className="ml-13 pb-4 space-y-2 fade-up">
                          {b.items.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-3 bg-sakuIvory rounded-xl px-3 py-2.5">
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-sakuText truncate">{t.title}</span>
                                <span className="block text-[11px] text-sakuText-light">{t.date}</span>
                              </span>
                              <span className={`text-xs font-bold tabular-nums shrink-0 ${t.flow === 'in' ? 'text-sakuGreen' : 'text-sakuText'}`}>
                                {rp(t.flow === 'in' ? t.amount : -t.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
        <BudgetSection />
        </div>  
      </div>
    );
}