"""
SakuPuan | Forecast harga pangan BULANAN, proyeksi 6 bulan ke depan.

Untuk setiap komoditas x daerah:
  1. Harga harian -> rata-rata per bulan (bulan berjalan dibuang karena belum lengkap)
  2. Model:  log(harga) = tren + pola per bulan kalender + efek Ramadan
             (Ridge regression, data terbaru diberi bobot lebih besar)
             + koreksi "sisa" bulan terakhir yang memudar pelan-pelan
  3. Backtest jujur: model dicoba memprediksi 1..6 bulan ke depan di banyak titik masa lalu,
     dibandingkan dengan 2 tebakan sederhana:
       - naive          : harga sama dengan bulan terakhir
       - seasonal naive : harga sama dengan bulan yang sama tahun lalu
  4. Rentang proyeksi (bawah-atas, ~80%) diambil dari error backtest per horizon,
     jadi makin jauh ke depan makin lebar.
  5. Alert hanya jika kenaikan/penurunan "meyakinkan": seluruh rentang di atas/bawah harga sekarang.

Tabel Supabase (berawalan pangan_ supaya tidak bentrok dengan tabel lain):
  pangan_runs, pangan_models, pangan_history, pangan_forecasts, pangan_alerts

Pemakaian:
    python forecast_batch.py --dry-run     # hasil ke ./output, tanpa Supabase
    python forecast_batch.py               # simpan ke Supabase

Environment variable (opsional kecuali kredensial Supabase):
    DATA_PATH / DATA_URL            sumber CSV (kolom wajib: tanggal, harga, komoditas, daerah)
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    HORIZON_MONTHS=6                panjang proyeksi
    HISTORY_MONTHS=24               histori bulanan yang disimpan untuk grafik
    MIN_MONTHS=24                   minimal bulan data supaya pola musiman bisa dipelajari
    ALERT_THRESHOLD_PCT=10          ambang alert (%)
    ALERT_COOLDOWN_DAYS=25          alert seri + arah yang sama tidak dibuat ulang dalam X hari
    ALERT_REQUIRE_CONFIDENT=true    alert hanya jika seluruh rentang di atas/bawah harga sekarang
    KOMODITAS_FILTER, DAERAH_FILTER daftar dipisah koma untuk membatasi yang diproses
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import requests
from sklearn.linear_model import Ridge

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
DATE_COL, PRICE_COL, COMMODITY_COL, REGION_COL = "tanggal", "harga", "komoditas", "daerah"


def env_num(name, default, cast=int):
    return cast(os.getenv(name) or default)


HORIZON = env_num("HORIZON_MONTHS", 6)
HISTORY_MONTHS = env_num("HISTORY_MONTHS", 24)
MIN_MONTHS = env_num("MIN_MONTHS", 24)
THRESHOLD = env_num("ALERT_THRESHOLD_PCT", 10, float)
COOLDOWN_DAYS = env_num("ALERT_COOLDOWN_DAYS", 25)
REQUIRE_CONFIDENT = (os.getenv("ALERT_REQUIRE_CONFIDENT") or "true").lower() == "true"

RIDGE_ALPHA = 1.0         # regularisasi: menjaga koefisien musiman tidak "liar" saat data sedikit
HALF_LIFE_MONTHS = 36     # bobot data: data 3 tahun lalu bernilai setengah data terbaru
MAX_STALE_MONTHS = 3      # seri yang bulan terakhirnya tertinggal > 3 bulan dilewati
MIN_BACKTEST_ERRORS = 8   # minimal jumlah error per horizon untuk menghitung rentang empiris
INTERVAL_Q = (0.10, 0.90) # rentang 80%

BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
            "Agustus", "September", "Oktober", "November", "Desember"]

# Perkiraan 1 Ramadan s/d hari puasa terakhir (versi Indonesia, bisa selisih 1 hari).
RAMADAN = {
    2018: ("2018-05-17", "2018-06-14"), 2019: ("2019-05-06", "2019-06-04"),
    2020: ("2020-04-24", "2020-05-23"), 2021: ("2021-04-13", "2021-05-12"),
    2022: ("2022-04-03", "2022-05-01"), 2023: ("2023-03-23", "2023-04-21"),
    2024: ("2024-03-12", "2024-04-09"), 2025: ("2025-03-01", "2025-03-30"),
    2026: ("2026-02-19", "2026-03-19"), 2027: ("2027-02-08", "2027-03-09"),
    2028: ("2028-01-28", "2028-02-25"), 2029: ("2029-01-16", "2029-02-13"),
    2030: ("2030-01-06", "2030-02-03"),
}


def split_env(name):
    return {x.strip().casefold() for x in (os.getenv(name) or "").split(",") if x.strip()}


def rupiah(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def persen(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def label_bulan(ts: pd.Timestamp) -> str:
    return f"{BULAN_ID[ts.month - 1]} {ts.year}"


# ---------------------------------------------------------------------------
# 1. Baca & bersihkan data
# ---------------------------------------------------------------------------
def read_source(src) -> pd.DataFrame:
    attempts = [
        {"encoding": "utf-8-sig", "sep": None, "engine": "python"},
        {"encoding": "utf-16", "sep": "\t"},
        {"encoding": "utf-8", "sep": ","},
    ]
    last_error = None
    for kwargs in attempts:
        try:
            buf = (lambda: io.BytesIO(src)) if isinstance(src, bytes) else (lambda: src)
            if pd.read_csv(buf(), nrows=5, **kwargs).shape[1] > 1:
                full = pd.read_csv(buf(), low_memory=False, **kwargs)
                full.columns = full.columns.astype(str).str.strip()
                return full
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise ValueError(f"Tidak bisa membaca CSV. Periksa encoding/delimiter. Detail: {last_error}")


def load_raw() -> pd.DataFrame:
    url = os.getenv("DATA_URL")
    if url:
        print("Mengunduh data dari DATA_URL ...")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        return read_source(resp.content)
    path = os.getenv("DATA_PATH") or "data/harga_pangan.csv"
    print(f"Membaca data dari {path}")
    return read_source(path)


def parse_price(value):
    if pd.isna(value):
        return np.nan
    if isinstance(value, (int, float, np.integer, np.floating)):
        return float(value)
    s = str(value).strip().replace("Rp", "").replace("rp", "").replace(" ", "")
    if s.lower() in {"", "-", "nan", "none", "null"}:
        return np.nan
    if "," in s and "." in s:            # 15.000,50 -> 15000.50
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:                       # 82,300 (format PIHPS) -> 82300 ; 15000,5 -> 15000.5
        left, _, right = s.rpartition(",")
        s = s.replace(",", "") if len(right) == 3 else left.replace(",", "") + "." + right
    elif s.count(".") == 1:              # 15.000 -> 15000
        left, right = s.split(".")
        if left.isdigit() and right.isdigit() and len(right) == 3:
            s = left + right
    elif s.count(".") > 1:               # 1.250.000 -> 1250000
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return np.nan


def parse_dates(col: pd.Series) -> pd.Series:
    """ISO (2026-11-04) dibaca apa adanya; format lain (04/11/2026) dibaca hari/bulan/tahun."""
    txt = col.astype(str).str.strip()
    iso = txt.str.match(r"^\d{4}-\d{2}-\d{2}")
    out = pd.Series(pd.NaT, index=col.index, dtype="datetime64[ns]")
    out[iso] = pd.to_datetime(txt[iso].str[:10], format="%Y-%m-%d", errors="coerce")
    out[~iso] = pd.to_datetime(txt[~iso], errors="coerce", dayfirst=True)
    return out.dt.normalize()


def clean(df_raw: pd.DataFrame) -> pd.DataFrame:
    lookup = {c.strip().casefold(): c for c in df_raw.columns}

    def col(name):
        actual = lookup.get(name.casefold())
        if actual is None:
            raise ValueError(f"Kolom {name!r} tidak ditemukan. Kolom tersedia: {list(df_raw.columns)}")
        return actual

    df = pd.DataFrame({
        "tanggal": parse_dates(df_raw[col(DATE_COL)]),
        "harga": df_raw[col(PRICE_COL)].map(parse_price),
        "komoditas": df_raw[col(COMMODITY_COL)].astype(str).str.strip(),
        "daerah": df_raw[col(REGION_COL)].astype(str).str.strip(),
    })
    before = len(df)
    df = df.dropna(subset=["tanggal", "harga"])
    df = df[(df["harga"] > 0) & (df["komoditas"] != "") & (df["daerah"] != "")]

    kf, dfl = split_env("KOMODITAS_FILTER"), split_env("DAERAH_FILTER")
    if kf:
        df = df[df["komoditas"].str.casefold().isin(kf)]
    if dfl:
        df = df[df["daerah"].str.casefold().isin(dfl)]
    print(f"Baris bersih: {len(df)} dari {before}")
    return df


def bulan_berjalan_wib() -> pd.Timestamp:
    now = datetime.now(timezone.utc) + timedelta(hours=7)
    return pd.Timestamp(year=now.year, month=now.month, day=1)


def to_monthly(df: pd.DataFrame) -> pd.DataFrame:
    df = df.assign(bulan=df["tanggal"].dt.to_period("M").dt.to_timestamp())
    cur = bulan_berjalan_wib()
    n_partial = int((df["bulan"] >= cur).sum())
    if n_partial:
        print(f"Membuang {n_partial} baris dari bulan berjalan ({cur:%Y-%m}) karena belum lengkap.")
        df = df[df["bulan"] < cur]
    return (df.groupby(["komoditas", "daerah", "bulan"], as_index=False)
              .agg(harga=("harga", "mean"), jumlah_hari=("tanggal", "nunique"))
              .sort_values(["komoditas", "daerah", "bulan"]))


def latest_daily(df: pd.DataFrame) -> pd.DataFrame:
    """Harga harian terakhir per seri (untuk info 'harga terkini' di app)."""
    d = (df.groupby(["komoditas", "daerah", "tanggal"], as_index=False)["harga"].mean()
           .sort_values("tanggal").groupby(["komoditas", "daerah"]).tail(1))
    return d.set_index(["komoditas", "daerah"])


# ---------------------------------------------------------------------------
# 2. Model
# ---------------------------------------------------------------------------
def ramadan_share(bulan: pd.Timestamp) -> float:
    """Porsi hari dalam bulan ini yang jatuh di bulan Ramadan (0..1)."""
    start_m = bulan
    end_m = bulan + pd.offsets.MonthEnd(0)
    days = (end_m - start_m).days + 1
    total = 0
    for y in (bulan.year - 1, bulan.year):
        if y not in RAMADAN:
            continue
        a, b = (pd.Timestamp(x) for x in RAMADAN[y])
        lo, hi = max(a, start_m), min(b, end_m)
        if hi >= lo:
            total += (hi - lo).days + 1
    return total / days


def month_index(bulan: pd.Timestamp, origin: pd.Timestamp) -> int:
    return (bulan.year - origin.year) * 12 + (bulan.month - origin.month)


def features(bulan_list, origin: pd.Timestamp) -> np.ndarray:
    rows = []
    for b in bulan_list:
        dummies = [1.0 if b.month == m else 0.0 for m in range(2, 13)]   # Januari = baseline
        rows.append([month_index(b, origin) / 12.0, *dummies, ramadan_share(b)])
    return np.array(rows, dtype=float)


class SeasonalModel:
    """log(harga) = tren + musiman bulanan + Ramadan, + sisa terakhir yang memudar (AR(1))."""

    def fit(self, bulan: list, y: np.ndarray):
        self.origin = bulan[0]
        self.last = bulan[-1]
        X = features(bulan, self.origin)
        ly = np.log(y)
        age = np.array([month_index(self.last, b) for b in bulan], dtype=float)
        w = 0.5 ** (age / HALF_LIFE_MONTHS)
        self.reg = Ridge(alpha=RIDGE_ALPHA).fit(X, ly, sample_weight=w)
        resid = ly - self.reg.predict(X)
        self.resid_last = float(resid[-1])
        self.resid_sd = float(np.std(resid)) if len(resid) > 1 else 0.0
        if len(resid) > 3 and np.std(resid[:-1]) > 0 and np.std(resid[1:]) > 0:
            self.phi = float(np.clip(np.corrcoef(resid[:-1], resid[1:])[0, 1], 0.0, 0.95))
        else:
            self.phi = 0.0
        return self

    def predict_log(self, h_list):
        bulan = [self.last + pd.DateOffset(months=h) for h in h_list]
        base = self.reg.predict(features(bulan, self.origin))
        return base + np.array([self.resid_last * self.phi ** h for h in h_list]), bulan

    @property
    def trend_pct_per_year(self) -> float:
        return float((np.exp(self.reg.coef_[0]) - 1) * 100)


def backtest(bulan: list, y: np.ndarray):
    """Rolling-origin: latih sampai bulan T, prediksi T+1..T+H, ulangi untuk banyak T."""
    pos = {b: i for i, b in enumerate(bulan)}
    err = {h: {"model": [], "snaive": [], "naive": [], "log": []} for h in range(1, HORIZON + 1)}
    for o in range(MIN_MONTHS, len(bulan)):
        tr_b, tr_y = bulan[:o], y[:o]
        if month_index(tr_b[-1], tr_b[0]) + 1 < MIN_MONTHS:
            continue
        m = SeasonalModel().fit(tr_b, tr_y)
        hs = list(range(1, HORIZON + 1))
        pred_log, targets = m.predict_log(hs)
        for h, pl, t in zip(hs, pred_log, targets):
            if t not in pos:
                continue
            actual = y[pos[t]]
            pred = float(np.exp(pl))
            err[h]["model"].append(abs(pred - actual) / actual)
            err[h]["log"].append(np.log(actual) - pl)
            err[h]["naive"].append(abs(tr_y[-1] - actual) / actual)
            lag = t - pd.DateOffset(months=12)
            if lag in pos and pos[lag] < o:
                err[h]["snaive"].append(abs(y[pos[lag]] - actual) / actual)
    return err


def mean_pct(xs):
    return float(np.mean(xs) * 100) if xs else None


def process_series(s: pd.DataFrame, komoditas: str, daerah: str, bulan_terbaru: pd.Timestamp,
                   harian: pd.DataFrame):
    s = s.sort_values("bulan").reset_index(drop=True)
    bulan = list(s["bulan"])
    y = s["harga"].to_numpy(dtype=float)
    last = bulan[-1]

    if month_index(bulan_terbaru, last) > MAX_STALE_MONTHS:
        return None, f"data terakhir {last:%Y-%m} (sudah basi)"
    span = month_index(last, bulan[0]) + 1
    if span < MIN_MONTHS or len(bulan) < MIN_MONTHS * 0.8:
        return None, f"hanya {len(bulan)} bulan data (butuh >= {MIN_MONTHS})"

    # --- backtest & rentang ---
    err = backtest(bulan, y)
    final = SeasonalModel().fit(bulan, y)
    hs = list(range(1, HORIZON + 1))
    pred_log, future = final.predict_log(hs)

    q_lo, q_hi = [], []
    for h in hs:
        le = err[h]["log"]
        if len(le) >= MIN_BACKTEST_ERRORS:
            q_lo.append(float(np.quantile(le, INTERVAL_Q[0])))
            q_hi.append(float(np.quantile(le, INTERVAL_Q[1])))
        else:  # fallback: sebaran residual, melebar seiring horizon
            sd = max(final.resid_sd, 0.02) * np.sqrt(h)
            q_lo.append(-1.2816 * sd)
            q_hi.append(1.2816 * sd)
    # rentang tidak boleh menyempit untuk horizon yang lebih jauh
    q_lo = list(np.minimum.accumulate(q_lo))
    q_hi = list(np.maximum.accumulate(q_hi))

    mape_model = mean_pct([e for h in hs for e in err[h]["model"]])
    mape_snaive = mean_pct([e for h in hs for e in err[h]["snaive"]])
    mape_naive = mean_pct([e for h in hs for e in err[h]["naive"]])
    baselines = [m for m in (mape_snaive, mape_naive) if m is not None]
    beats = bool(mape_model is not None and baselines and mape_model < min(baselines))
    n_backtest = len(err[1]["model"])

    base = float(y[-1])  # rata-rata bulan terakhir yang lengkap
    preds = np.exp(pred_log)
    now = datetime.now(timezone.utc).isoformat()
    key = (komoditas, daerah)
    harian_harga = float(harian.loc[key, "harga"]) if key in harian.index else None
    harian_tgl = harian.loc[key, "tanggal"].date().isoformat() if key in harian.index else None

    forecasts = []
    for h, b, p, pl, lo, hi in zip(hs, future, preds, pred_log, q_lo, q_hi):
        forecasts.append({
            "komoditas": komoditas, "daerah": daerah, "bulan": b.date().isoformat(), "h": h,
            "prediksi": round(float(p), 2),
            "bawah": round(float(np.exp(pl + lo)), 2),
            "atas": round(float(np.exp(pl + hi)), 2),
        })

    def pred_at(h):
        return forecasts[h - 1]["prediksi"] if h <= len(forecasts) else None

    model_row = {
        "komoditas": komoditas, "daerah": daerah,
        "bulan_terakhir": last.date().isoformat(),
        "harga_bulan_terakhir": round(base, 2),
        "harga_harian_terakhir": round(harian_harga, 2) if harian_harga else None,
        "tanggal_harian_terakhir": harian_tgl,
        "horizon_bulan": HORIZON,
        "proyeksi_1_bulan": pred_at(1),
        "proyeksi_3_bulan": pred_at(3),
        "proyeksi_6_bulan": pred_at(6),
        "tren_persen_per_tahun": round(final.trend_pct_per_year, 2),
        "mape_model": round(mape_model, 2) if mape_model is not None else None,
        "mape_seasonal_naive": round(mape_snaive, 2) if mape_snaive is not None else None,
        "mape_naive": round(mape_naive, 2) if mape_naive is not None else None,
        "model_lebih_baik": beats,
        "jumlah_bulan": len(bulan),
        "jumlah_backtest": n_backtest,
        "metode": "tren+musiman+ramadan (ridge, log)",
        "updated_at": now,
    }

    hist = s[s["bulan"] > last - pd.DateOffset(months=HISTORY_MONTHS)]
    history = [{"komoditas": komoditas, "daerah": daerah, "bulan": b.date().isoformat(),
                "harga": round(float(v), 2), "jumlah_hari": int(n)}
               for b, v, n in zip(hist["bulan"], hist["harga"], hist["jumlah_hari"])]

    # --- alert: bulan dengan perubahan terbesar ---
    alerts = []
    best = max(forecasts, key=lambda f: abs(f["prediksi"] - base))
    pct = (best["prediksi"] - base) / base * 100
    naik = pct > 0
    confident = (best["bawah"] > base) if naik else (best["atas"] < base)
    if abs(pct) >= THRESHOLD and (confident or not REQUIRE_CONFIDENT):
        tgt = pd.Timestamp(best["bulan"])
        alerts.append({
            "komoditas": komoditas, "daerah": daerah,
            "bulan_dasar": last.date().isoformat(),
            "bulan_target": best["bulan"], "h": best["h"],
            "status": "NAIK" if naik else "TURUN",
            "perubahan_persen": round(pct, 2),
            "harga_dasar": round(base, 2),
            "harga_proyeksi": best["prediksi"],
            "rentang_bawah": best["bawah"], "rentang_atas": best["atas"],
            "model_lebih_baik": beats,
            "pesan": (f"Harga {komoditas} di {daerah} diperkirakan {'naik' if naik else 'turun'} "
                      f"sekitar {persen(abs(pct))}% pada {label_bulan(tgt)}, dari rata-rata "
                      f"Rp {rupiah(base)} ({label_bulan(last)}) menjadi sekitar Rp {rupiah(best['prediksi'])} "
                      f"(perkiraan Rp {rupiah(best['bawah'])} - Rp {rupiah(best['atas'])})."),
        })
    return {"model": model_row, "history": history, "forecasts": forecasts, "alerts": alerts}, None


# ---------------------------------------------------------------------------
# 3. Supabase (PostgREST)
# ---------------------------------------------------------------------------
class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    @staticmethod
    def _check(r):
        if r.status_code >= 300:
            raise RuntimeError(f"Supabase error {r.status_code}: {r.text[:500]}")

    def upsert(self, table, rows, on_conflict=None, chunk=1000):
        params = {"on_conflict": on_conflict} if on_conflict else {}
        prefer = "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal"
        for i in range(0, len(rows), chunk):
            r = requests.post(f"{self.base}/{table}", params=params, headers={**self.h, "Prefer": prefer},
                              data=json.dumps(rows[i:i + chunk]), timeout=120)
            self._check(r)

    def select(self, table, params):
        r = requests.get(f"{self.base}/{table}", params=params, headers=self.h, timeout=60)
        self._check(r)
        return r.json()

    def delete(self, table, params):
        r = requests.delete(f"{self.base}/{table}", params=params,
                            headers={**self.h, "Prefer": "return=minimal"}, timeout=120)
        self._check(r)


def apply_cooldown(alerts, recent):
    seen = {(a["komoditas"], a["daerah"], a["status"]) for a in recent}
    return [a for a in alerts if (a["komoditas"], a["daerah"], a["status"]) not in seen]


def save_supabase(run, models, history, forecasts, alerts):
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set. Pakai --dry-run untuk tes lokal.")
    sb = Supabase(url, key)
    rid = run["id"]

    sb.upsert("pangan_runs", [run])
    sb.upsert("pangan_models", models, on_conflict="komoditas,daerah")
    sb.upsert("pangan_history", history, on_conflict="komoditas,daerah,bulan")
    sb.upsert("pangan_forecasts", [{**f, "run_id": rid} for f in forecasts],
              on_conflict="komoditas,daerah,bulan")

    # Bersih-bersih: proyeksi dari run lama & histori di luar jendela grafik.
    sb.delete("pangan_forecasts", {"run_id": f"neq.{rid}"})
    batas = (pd.Timestamp(run["data_sampai"]) - pd.DateOffset(months=HISTORY_MONTHS)).date().isoformat()
    sb.delete("pangan_history", {"bulan": f"lte.{batas}"})

    since = (datetime.now(timezone.utc) - timedelta(days=COOLDOWN_DAYS)).isoformat()
    recent = sb.select("pangan_alerts", {"select": "komoditas,daerah,status", "created_at": f"gte.{since}"})
    fresh = apply_cooldown(alerts, recent)
    if fresh:
        sb.upsert("pangan_alerts", [{**a, "run_id": rid} for a in fresh])
    print(f"Alert baru: {len(fresh)} (ditahan cooldown: {len(alerts) - len(fresh)})")

    sb.upsert("pangan_runs", [{**run, "jumlah_alert": len(fresh), "status": "success"}], on_conflict="id")
    print(f"Tersimpan ke Supabase. run_id={rid}")


def save_local(run, models, history, forecasts, alerts, skipped, out_dir="output"):
    os.makedirs(out_dir, exist_ok=True)
    for name, rows in [("pangan_models", models), ("pangan_history", history),
                       ("pangan_forecasts", forecasts), ("pangan_alerts", alerts)]:
        pd.DataFrame(rows).to_csv(f"{out_dir}/{name}.csv", index=False)
    with open(f"{out_dir}/run.json", "w", encoding="utf-8") as f:
        json.dump({**run, "skipped": skipped}, f, ensure_ascii=False, indent=2)
    print(f"[dry-run] Hasil ditulis ke folder {out_dir}/")


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="tulis hasil ke ./output, tanpa Supabase")
    args = ap.parse_args()

    daily = clean(load_raw())
    if daily.empty:
        sys.exit("Tidak ada data setelah dibersihkan/difilter.")
    harian = latest_daily(daily)
    monthly = to_monthly(daily)
    if monthly.empty:
        sys.exit("Tidak ada bulan lengkap di data.")
    bulan_terbaru = monthly["bulan"].max()

    models, history, forecasts, alerts, skipped = [], [], [], [], []
    for (kom, dae), s in monthly.groupby(["komoditas", "daerah"]):
        res, reason = process_series(s, kom, dae, bulan_terbaru, harian)
        if res is None:
            skipped.append({"komoditas": kom, "daerah": dae, "alasan": reason})
            continue
        models.append(res["model"])
        history.extend(res["history"])
        forecasts.extend(res["forecasts"])
        alerts.extend(res["alerts"])

    run = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data_sampai": bulan_terbaru.date().isoformat(),
        "jumlah_seri": len(models),
        "jumlah_seri_dilewati": len(skipped),
        "jumlah_alert": len(alerts),
        "threshold_persen": THRESHOLD,
        "status": "running",
    }
    print(f"Bulan lengkap terakhir {bulan_terbaru:%Y-%m} | seri diproses: {len(models)} | "
          f"dilewati: {len(skipped)} | kandidat alert: {len(alerts)}")
    for sk in skipped[:10]:
        print(f"  - dilewati: {sk['komoditas']} / {sk['daerah']} ({sk['alasan']})")
    if models:
        better = sum(1 for m in models if m["model_lebih_baik"])
        print(f"Model mengalahkan tebakan sederhana pada {better} dari {len(models)} seri.")
    else:
        sys.exit("Tidak ada seri yang cukup datanya untuk dimodelkan.")

    if args.dry_run:
        save_local({**run, "status": "dry-run"}, models, history, forecasts, alerts, skipped)
    else:
        save_supabase(run, models, history, forecasts, alerts)


if __name__ == "__main__":
    main()
