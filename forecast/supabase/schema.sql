-- SakuPuan | Skema forecast harga pangan bulanan (proyeksi 6 bulan)
-- Jalankan di Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Aman dijalankan ulang. Semua tabel berawalan "pangan_" supaya tidak bentrok dengan tabel app lain.

-- Log setiap kali forecast dijalankan
create table if not exists pangan_runs (
  id                    uuid primary key,
  created_at            timestamptz not null default now(),
  data_sampai           date,          -- bulan lengkap terakhir di data
  jumlah_seri           int,
  jumlah_seri_dilewati  int,
  jumlah_alert          int,
  threshold_persen      numeric,
  status                text not null default 'running'   -- running | success
);

-- Ringkasan per komoditas x daerah
create table if not exists pangan_models (
  komoditas                text not null,
  daerah                   text not null,
  bulan_terakhir           date not null,     -- bulan lengkap terakhir (tanggal 1)
  harga_bulan_terakhir     numeric not null,  -- rata-rata harga bulan itu (dasar perbandingan)
  harga_harian_terakhir    numeric,
  tanggal_harian_terakhir  date,
  horizon_bulan            int,
  proyeksi_1_bulan         numeric,
  proyeksi_3_bulan         numeric,
  proyeksi_6_bulan         numeric,
  tren_persen_per_tahun    numeric,
  mape_model               numeric,           -- rata-rata error % model di backtest (1-6 bulan)
  mape_seasonal_naive      numeric,           -- error % tebakan "sama dengan tahun lalu"
  mape_naive               numeric,           -- error % tebakan "sama dengan bulan terakhir"
  model_lebih_baik         boolean,           -- model mengalahkan kedua tebakan sederhana?
  jumlah_bulan             int,
  jumlah_backtest          int,
  metode                   text,
  updated_at               timestamptz not null default now(),
  primary key (komoditas, daerah)
);

-- Harga rata-rata bulanan (garis solid di grafik)
create table if not exists pangan_history (
  komoditas    text not null,
  daerah       text not null,
  bulan        date not null,
  harga        numeric not null,
  jumlah_hari  int,
  primary key (komoditas, daerah, bulan)
);

-- Proyeksi 1..6 bulan ke depan + rentang ~80% (hanya hasil run terakhir)
create table if not exists pangan_forecasts (
  komoditas  text not null,
  daerah     text not null,
  bulan      date not null,
  h          int not null,      -- 1 = bulan depan, ..., 6 = enam bulan lagi
  prediksi   numeric not null,
  bawah      numeric not null,
  atas       numeric not null,
  run_id     uuid references pangan_runs(id),
  primary key (komoditas, daerah, bulan)
);

-- Notifikasi
create table if not exists pangan_alerts (
  id                bigint generated always as identity primary key,
  run_id            uuid not null references pangan_runs(id),
  komoditas         text not null,
  daerah            text not null,
  bulan_dasar       date not null,
  bulan_target      date not null,
  h                 int not null,
  status            text not null,      -- NAIK | TURUN
  perubahan_persen  numeric not null,
  harga_dasar       numeric not null,
  harga_proyeksi    numeric not null,
  rentang_bawah     numeric,
  rentang_atas      numeric,
  model_lebih_baik  boolean,
  pesan             text not null,
  created_at        timestamptz not null default now(),
  notified_at       timestamptz           -- diisi backend setelah notifikasi terkirim
);
create index if not exists pangan_alerts_created_idx on pangan_alerts (created_at);
create index if not exists pangan_alerts_pending_idx on pangan_alerts (notified_at) where notified_at is null;

-- Satu panggilan untuk satu kartu: ringkasan + histori bulanan + proyeksi.
-- Dari app: supabase.rpc('get_trend_harga', { p_komoditas, p_daerah, p_bulan_histori: 12 })
drop function if exists get_trend_harga(text, text, int);
create or replace function get_trend_harga(
  p_komoditas text,
  p_daerah text,
  p_bulan_histori int default 12
) returns json
language sql stable security invoker
as $$
  select json_build_object(
    'ringkasan', (
      select row_to_json(m) from pangan_models m
      where m.komoditas = p_komoditas and m.daerah = p_daerah
    ),
    'histori', coalesce((
      select json_agg(json_build_object('bulan', h.bulan, 'harga', h.harga) order by h.bulan)
      from pangan_history h
      join pangan_models m on m.komoditas = h.komoditas and m.daerah = h.daerah
      where h.komoditas = p_komoditas and h.daerah = p_daerah
        and h.bulan > (m.bulan_terakhir - make_interval(months => p_bulan_histori))::date
    ), '[]'::json),
    'proyeksi', coalesce((
      select json_agg(json_build_object('bulan', f.bulan, 'h', f.h, 'harga', f.prediksi,
                                        'bawah', f.bawah, 'atas', f.atas) order by f.h)
      from pangan_forecasts f
      where f.komoditas = p_komoditas and f.daerah = p_daerah
    ), '[]'::json)
  );
$$;

-- RLS: app (anon/authenticated) hanya boleh baca; script forecast pakai service role.
alter table pangan_runs      enable row level security;
alter table pangan_models    enable row level security;
alter table pangan_history   enable row level security;
alter table pangan_forecasts enable row level security;
alter table pangan_alerts    enable row level security;

drop policy if exists "public read" on pangan_runs;
drop policy if exists "public read" on pangan_models;
drop policy if exists "public read" on pangan_history;
drop policy if exists "public read" on pangan_forecasts;
drop policy if exists "public read" on pangan_alerts;
create policy "public read" on pangan_runs      for select using (true);
create policy "public read" on pangan_models    for select using (true);
create policy "public read" on pangan_history   for select using (true);
create policy "public read" on pangan_forecasts for select using (true);
create policy "public read" on pangan_alerts    for select using (true);
