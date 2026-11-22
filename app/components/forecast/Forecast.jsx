'use client';

import { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, LineController } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useApp } from '@/app/components/providers/AppProvider';
import { rp } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import { COMMODITIES } from '@/lib/trendHarga';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, LineController);

const PRICE_HORIZONS = [
  { id: 1, label: '1 Bulan' },
  { id: 3, label: '3 Bulan' },
  { id: 6, label: '6 Bulan' },
];

const tooltipBase = { backgroundColor: '#1E2D24', padding: 10, cornerRadius: 12, titleFont: { weight: 'bold' }, boxPadding: 4 };
const axisTicks = { color: '#6E8276', font: { size: 10, family: 'Inter' } };

export default function Forecast() {
  const { city } = useApp();
  const card = 'bg-white rounded-3xl border border-sakuGreen-light p-5';

  return (
    <div className="max-w-4xl mx-auto space-y-4 fade-up">
      <header>
        <h2 className="text-xl font-extrabold tracking-tight text-sakuText">Trend Pangan</h2>
        <p className="text-xs text-sakuText-muted mt-1">Perkiraan harga bahan dapur di {city}, biar bisa siap-siap dari sekarang.</p>
      </header>

      {/* Kartu Trend Harga Pangan (Hanya bagian kanan yang dipertahankan) */}
      <TrendHargaCard city={city} card={card} />
    </div>
  );
}

// ---------- Kartu Trend Harga Pangan ----------
function TrendHargaCard({ city, card }) {
  const [commodityId, setCommodityId] = useState('cabai');
  const [priceHorizon, setPriceHorizon] = useState(6);
  const priceRes = useFetch(`/api/forecast/prices?commodity=${commodityId}&city=${encodeURIComponent(city)}`);
  const series = priceRes.data?.series;
  
  const isCurrent = !!series && series.commodity.id === commodityId && priceRes.data.city === city;
  const selected = COMMODITIES.find((c) => c.id === commodityId);

  // Jika data sedang dimuat atau error
  if (!priceRes.data) {
    return (
      <section className={card}>
        <p className="text-center text-sm text-sakuText-light py-10">
          {priceRes.error ? 'Gagal memuat trend harga pangan.' : 'Memuat data harga pangan...'}
        </p>
      </section>
    );
  }

  // Data untuk Chart.js Trend Harga Pangan
  const hist = series?.history ?? [];
  const forecast = (series?.forecast ?? []).slice(0, priceHorizon);
  
  const labels = [...hist.map(x => x.bulan), ...forecast.map(x => x.bulan)];
  const historyPrices = hist.map(x => x.harga);
  const forecastPrices = [
    ...(hist.length > 0 ? [hist[hist.length - 1].harga] : []),
    ...forecast.map(x => x.harga)
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Rata-rata bulanan',
        data: [...historyPrices, ...Array(forecast.length).fill(null)],
        borderColor: selected?.color || '#FF4B93',
        backgroundColor: 'transparent',
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 2,
      },
      {
        label: 'Proyeksi',
        data: [...Array(Math.max(0, historyPrices.length - 1)).fill(null), ...forecastPrices],
        borderColor: selected?.color || '#FF4B93',
        borderDash: [6, 5],
        backgroundColor: 'transparent',
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { tooltip: { ...tooltipBase, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${rp(ctx.parsed.y ?? 0)}` } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { ...axisTicks, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
      y: { grid: { color: '#EAF3EC' }, border: { display: false }, ticks: { ...axisTicks, maxTicksLimit: 5, callback: (v) => rp(Number(v)) } },
    },
  };

  const latestHist = hist[hist.length - 1] || {};
  const nextForecast = forecast[0] || {};
  const pctChange = latestHist.harga && nextForecast.harga 
    ? (((nextForecast.harga - latestHist.harga) / latestHist.harga) * 100).toFixed(1) 
    : '0';

  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-sakuText">Trend Harga Pangan</h3>
          <p className="text-[11px] text-sakuText-light">Proyeksi bulanan dari harga pasar tradisional (PIHPS Bank Indonesia), {city}</p>
        </div>
        <div role="tablist" aria-label="Rentang proyeksi harga" className="flex shrink-0 p-1 bg-sakuIvory rounded-full">
          {PRICE_HORIZONS.map((x) => (
            <button key={x.id} role="tab" aria-selected={priceHorizon === x.id} onClick={() => setPriceHorizon(x.id)} className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${priceHorizon === x.id ? 'bg-sakuGreen text-white' : 'text-sakuText-muted hover:text-sakuGreen'}`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {COMMODITIES.map((c) => (
          <button key={c.id} onClick={() => setCommodityId(c.id)} aria-pressed={commodityId === c.id} className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all ${commodityId === c.id ? 'bg-sakuText text-white border-sakuText shadow-sm' : 'bg-white text-sakuText border-sakuGreen-light hover:border-sakuGreen'}`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-sakuIvory px-3 py-2.5">
          <p className="text-[11px] text-sakuText-light">Rata-rata Terkini</p>
          <p className="text-[15px] font-extrabold text-sakuText tabular-nums">{rp(latestHist.harga ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-sakuGreen-light px-3 py-2.5">
          <p className="text-[11px] text-sakuGreen">Proyeksi</p>
          <p className="text-[15px] font-extrabold text-sakuGreen tabular-nums">{rp(nextForecast.harga ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-sakuIvory px-3 py-2.5">
          <p className="text-[11px] text-sakuText-light">Perubahan</p>
          <p className={`text-[15px] font-extrabold tabular-nums ${Number(pctChange) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`}
          </p>
        </div>
      </div>

      <div className="relative h-64 mt-4">
        <Line data={chartData} options={chartOptions} aria-label="Grafik trend harga pangan" />
      </div>

      <div className="mt-5 pt-4 border-t border-sakuGreen-light/60 flex items-start gap-2.5 text-xs text-sakuText-muted leading-relaxed">
      <span className="mt-1.5 w-2 h-2 rounded-full bg-sakuPink shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-sakuText">Catatan AI:</strong>{" "}
        Proyeksi harga di atas merupakan perkiraan statistik berdasarkan data historis harga pangan dari{" "}
        <span className="font-medium text-sakuText">PIHPS Bank Indonesia</span>. Hasil ini bersifat
        estimasi, tidak menjamin harga aktual di pasar, dan sebaiknya digunakan sebagai pertimbangan
        awal dalam menyusun anggaran belanja rumah tangga.
      </p>
      </div>
    </section>
  );
}