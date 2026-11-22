# SakuPuan – Forecast Harga Pangan 6 Bulan

Memprediksi harga rata-rata bulanan bahan pangan **1 sampai 6 bulan ke depan** untuk kartu
"Trend Harga Pangan" di app SakuPuan.

```
scrape-pihps.mjs (kamu jalankan manual)  ──►  data/harga_pangan.csv  ──►  push ke GitHub
                                                                           │
                                              GitHub Actions otomatis jalan (forecast_batch.py)
                                                                           ▼
                                   Supabase: pangan_models, pangan_history, pangan_forecasts, pangan_alerts
                                                                           ▼
                                   Next.js: /api/forecast/prices → supabase.rpc('get_trend_harga')
```

## Isi folder

| File | Fungsi |
|---|---|
| `scrape-pihps.mjs` / `scrape_pihps.py` | Ambil harga harian dari PIHPS Bank Indonesia (versi Node / Python, hasilnya sama) |
| `forecast_batch.py` | Harian → bulanan → model → backtest → proyeksi 6 bulan + rentang → simpan ke Supabase |
| `supabase/schema.sql` | Tabel `pangan_*`, RLS (app hanya baca), fungsi `get_trend_harga` |
| `.github/workflows/forecast-bulanan.yml` | Jalan otomatis saat CSV di `data/` berubah, tiap tanggal 2, atau manual |

## Cara kerja model (bahasa sederhana)

1. **Harga harian dirata-rata per bulan.** Bulan yang sedang berjalan dibuang karena belum lengkap.
2. **Model belajar 3 hal** dari data 5 tahun:
   - **Tren:** naik/turun berapa persen per tahun.
   - **Pola musiman:** misalnya "Desember biasanya +6%", "April beras turun karena panen".
   - **Efek Ramadan:** tanggal Ramadan maju ±11 hari tiap tahun, jadi dihitung terpisah dari pola bulan.

   Ditambah koreksi kecil: kalau bulan lalu harga "di atas normal", efeknya dianggap masih terasa sebentar.
3. **Diuji jujur (backtest):** model dicoba memprediksi 1–6 bulan ke depan di ±30 titik masa lalu,
   lalu dibandingkan dengan 2 tebakan sederhana: "sama dengan bulan lalu" dan "sama dengan bulan yang sama tahun lalu".
   Hasilnya disimpan di `mape_model`, `mape_naive`, `mape_seasonal_naive`, dan `model_lebih_baik`.
4. **Rentang (bawah–atas)** diambil dari seberapa jauh model meleset di backtest. Kira-kira 8 dari 10 kali,
   harga asli jatuh di dalam rentang ini. Makin jauh ke depan, rentangnya makin lebar.

Teknisnya: Ridge regression pada log(harga) dengan fitur tren + dummy bulan + porsi hari Ramadan,
bobot data meluruh (half-life 36 bulan), dan residual AR(1).

> **Jujur soal batasannya:** beras, minyak, dan telur biasanya cukup bisa ditebak. Cabai dan bawang bisa naik dua kali lipat
> dalam beberapa minggu karena cuaca, jadi rentangnya lebar dan model sering tidak lebih baik dari tebakan sederhana.
> App menampilkan peringatan otomatis untuk kasus ini (`model_lebih_baik = false`).

## Setup

1. **Supabase**: jalankan `supabase/schema.sql` di SQL Editor. Proyek yang sudah ada juga boleh, karena semua tabel berawalan `pangan_`.
2. **Data**: `node scrape-pihps.mjs` (atau `python scrape_pihps.py`) → menghasilkan `data/harga_pangan.csv` (5 tahun).
3. **GitHub**: upload isi folder ini ke repo private. Tambahkan secrets `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
4. Upload/commit `data/harga_pangan.csv`, maka workflow **otomatis jalan**. Cek tab Actions (harus centang hijau),
   lalu tabel `pangan_models` di Supabase.

**Update data** cukup ulangi langkah 2 dan 4, misalnya sebulan sekali di awal bulan. Model hanya memakai bulan yang sudah lengkap,
jadi update lebih sering dari sebulan sekali tidak mengubah proyeksi.

Tes lokal: `pip install -r requirements.txt && python forecast_batch.py --dry-run` (hasil ke `./output`).

## Data minimal

- Satu seri (komoditas × daerah) butuh **minimal 24 bulan** data supaya pola musimannya bisa dipelajari. Kurang dari itu, seri dilewati.
- Seri yang data terakhirnya tertinggal lebih dari 3 bulan dari data terbaru juga dilewati.
- Kolom wajib CSV: `tanggal`, `harga`, `komoditas`, `daerah`.

## Bentuk data untuk app

`supabase.rpc('get_trend_harga', { p_komoditas, p_daerah, p_bulan_histori: 12 })` mengembalikan:

```json
{
  "ringkasan": { "bulan_terakhir": "2026-10-01", "harga_bulan_terakhir": 43725, "proyeksi_6_bulan": 44820,
                 "mape_model": 19.3, "model_lebih_baik": false, "...": "..." },
  "histori":  [ { "bulan": "2025-11-01", "harga": 48210 }, "... 12 bulan" ],
  "proyeksi": [ { "bulan": "2026-11-01", "h": 1, "harga": 42691, "bawah": 33008, "atas": 55245 }, "... 6 bulan" ]
}
```

File Next.js (`route.js`, `lib/trendHarga.js`, komponen `Forecast.jsx`) dikirim terpisah.

## Notifikasi

Satu alert per seri dibuat jika proyeksi di salah satu bulan berbeda ≥ `ALERT_THRESHOLD_PCT` (default 10%) dari rata-rata bulan terakhir,
**dan** seluruh rentangnya ada di sisi yang sama (`ALERT_REQUIRE_CONFIDENT=true`). Jadi tidak ada peringatan "naik"
kalau sebenarnya bisa juga turun. Alert yang sama tidak dibuat ulang selama 25 hari.

Kirim notifikasinya dari backend app (service role key): `select * from pangan_alerts where notified_at is null` → kirim → set `notified_at = now()`.

## Pengaturan (env di workflow)

| Variabel | Default | Arti |
|---|---|---|
| `HORIZON_MONTHS` | 6 | Panjang proyeksi |
| `HISTORY_MONTHS` | 24 | Histori bulanan yang disimpan (kartu mengambil 12) |
| `MIN_MONTHS` | 24 | Minimal panjang data per seri |
| `ALERT_THRESHOLD_PCT` | 10 | Ambang alert |
| `ALERT_REQUIRE_CONFIDENT` | true | Alert hanya jika seluruh rentang di atas/bawah harga sekarang |
| `ALERT_COOLDOWN_DAYS` | 25 | Jeda alert yang sama |
| `KOMODITAS_FILTER` / `DAERAH_FILTER` | kosong | Batasi yang diproses (dipisah koma) |

Tanggal Ramadan 2018–2030 ada di `RAMADAN` dalam `forecast_batch.py` (perkiraan, bisa selisih 1 hari, dan itu tidak masalah untuk data bulanan).

## Sumber data: PIHPS Bank Indonesia

`scrape-pihps.mjs` / `scrape_pihps.py` mengambil harga harian pasar tradisional dari https://www.bi.go.id/hargapangan
untuk Kota Jakarta Pusat, Kota Semarang, dan Kota Palu, dengan kategori beras, daging ayam, telur ayam, bawang merah,
bawang putih, cabai merah, cabai rawit, dan minyak goreng.

- Kolom `level`: 1 = rata-rata kategori (mis. "Cabai Merah"), 2 = jenis spesifik (mis. "Cabai Merah Keriting").
- Untuk DKI Jakarta, PIHPS (pasar tradisional) hanya punya data Kota Jakarta Pusat.
- Ada jeda 2 detik antar permintaan supaya tidak membebani server BI.
