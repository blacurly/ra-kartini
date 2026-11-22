// Ubah hasil supabase.rpc('get_trend_harga') (model bulanan, proyeksi 6 bulan)
// menjadi bentuk `series` yang dipakai kartu "Trend Harga Pangan" di komponen Forecast.

// Nama di bawah sudah disesuaikan dengan data PIHPS Bank Indonesia (hasil scrape-pihps.mjs / scrape_pihps.py).
//   - datasetName: nama PERSIS kolom `komoditas` di data
//     (nama kategori seperti "Cabai Merah" = rata-rata semua jenis cabai merah)
//   - color/unit/monthlyQty: samakan dengan COMMODITIES di route lama kamu
export const COMMODITIES = [
  { id: 'beras', name: 'Beras Medium', datasetName: 'Beras Kualitas Medium I', color: '#1F5932', unit: 'kg', monthlyQty: 10 },
  { id: 'cabai', name: 'Cabai Merah', datasetName: 'Cabai Merah', color: '#FF4B93', unit: 'kg', monthlyQty: 2 },
  { id: 'minyak', name: 'Minyak Goreng', datasetName: 'Minyak Goreng', color: '#F59E0B', unit: 'kg', monthlyQty: 2 },
  // Tambahan yang juga tersedia dari scraper:
  { id: 'bawang-merah', name: 'Bawang Merah', datasetName: 'Bawang Merah', color: '#B91C1C', unit: 'kg', monthlyQty: 1 },
  { id: 'bawang-putih', name: 'Bawang Putih', datasetName: 'Bawang Putih', color: '#A8A29E', unit: 'kg', monthlyQty: 1 },
  { id: 'cabai-rawit', name: 'Cabai Rawit', datasetName: 'Cabai Rawit', color: '#DC2626', unit: 'kg', monthlyQty: 1 },
  { id: 'telur', name: 'Telur Ayam', datasetName: 'Telur Ayam', color: '#EAB308', unit: 'kg', monthlyQty: 4 },
  { id: 'ayam', name: 'Daging Ayam', datasetName: 'Daging Ayam', color: '#EA580C', unit: 'kg', monthlyQty: 3 },
];

// Nama kota di app -> nama daerah di data PIHPS.
export const CITY_TO_DAERAH = {
  'Jakarta': 'Kota Jakarta Pusat',
  'Semarang': 'Kota Semarang',
  'Palu': 'Kota Palu',
};

const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * trend  = { ringkasan, histori: [{bulan, harga}], proyeksi: [{bulan, h, harga, bawah, atas}] }
 * return = {
 *   commodity, asOf, base, latestDaily, latestDailyDate,
 *   history:  [{ bulan, harga }],                    // 12 bulan terakhir (rata-rata bulanan)
 *   forecast: [{ bulan, h, harga, bawah, atas }],    // 1..6 bulan ke depan
 *   trendPctYear, mape, reliable, source
 * }
 */
export function toSeries(trend, commodity) {
  const r = trend?.ringkasan;
  if (!r) return null;
  return {
    commodity,
    asOf: r.bulan_terakhir,                       // 'YYYY-MM-01' bulan lengkap terakhir
    base: num(r.harga_bulan_terakhir),            // rata-rata bulan itu = dasar perbandingan
    latestDaily: num(r.harga_harian_terakhir),
    latestDailyDate: r.tanggal_harian_terakhir,
    history: (trend.histori ?? []).map((x) => ({ bulan: x.bulan, harga: num(x.harga) })),
    forecast: (trend.proyeksi ?? []).map((x) => ({
      bulan: x.bulan, h: Number(x.h), harga: num(x.harga), bawah: num(x.bawah), atas: num(x.atas),
    })),
    trendPctYear: num(r.tren_persen_per_tahun),
    mape: num(r.mape_model),                      // rata-rata error % di backtest
    reliable: r.model_lebih_baik !== false,       // false = kalah dari tebakan sederhana
    source: 'supabase',
  };
}
