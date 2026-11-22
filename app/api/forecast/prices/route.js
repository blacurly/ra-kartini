import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COMMODITIES, CITY_TO_DAERAH, toSeries } from '@/lib/trendHarga';

export const dynamic = 'force-dynamic';

// Jalan di server. Cukup anon key (tabel pangan_* read-only lewat RLS). JANGAN pakai service_role di sini.
const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// GET /api/forecast/prices?commodity=cabai&city=Semarang
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const commodity = COMMODITIES.find((c) => c.id === searchParams.get('commodity')) ?? COMMODITIES[0];
  const city = searchParams.get('city') ?? '';
  const daerah = CITY_TO_DAERAH[city] ?? city;

  const { data, error } = await supabase.rpc('get_trend_harga', {
    p_komoditas: commodity.datasetName,
    p_daerah: daerah,
    p_bulan_histori: 12,
  });

  if (error) {
    console.error('get_trend_harga error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data harga' }, { status: 500 });
  }

  const series = toSeries(data, commodity);
  if (!series) {
    return NextResponse.json({ error: `Belum ada data ${commodity.name} untuk ${city}` }, { status: 404 });
  }

  return NextResponse.json({ commodities: COMMODITIES, series, city });
}
