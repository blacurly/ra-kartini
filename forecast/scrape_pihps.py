"""
Scraper harga pangan PIHPS Bank Indonesia (Pasar Tradisional, per daerah).
Sumber: https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah

Hasil: CSV format "panjang" yang langsung bisa dipakai forecast_batch.py
    tanggal,provinsi,daerah,kategori,komoditas,level,harga
    2026-11-13,Sulawesi Tengah,Kota Palu,Cabai Merah,Cabai Merah,1,78650
    2026-11-13,Sulawesi Tengah,Kota Palu,Cabai Merah,Cabai Merah Keriting,2,90000

level 1 = rata-rata kategori (mis. "Cabai Merah"), level 2 = jenis spesifik (mis. "Cabai Merah Keriting").

Pemakaian:
    pip install requests
    python scrape_pihps.py                         # 5 tahun terakhir -> data/harga_pangan.csv
    python scrape_pihps.py --years 1               # 1 tahun terakhir saja
    python scrape_pihps.py --start 2024-01-01 --end 2024-12-31 --out data/2024.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from datetime import date, datetime, timedelta

import requests

URL = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataDaerah"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Referer": "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

# (nama provinsi, province_id, regency_id, nama daerah) — ID diambil dari GetRefProvince/GetRefRegency PIHPS
REGIONS = [
    ("DKI Jakarta", 13, 34, "Kota Jakarta Pusat"),   # satu-satunya kota DKI di PIHPS pasar tradisional
    ("Jawa Tengah", 14, 35, "Kota Semarang"),
    ("Sulawesi Tengah", 28, 74, "Kota Palu"),
]

# Kategori PIHPS (comcat_id). Hapus baris yang tidak perlu.
CATEGORIES = {
    "cat_1": "Beras",
    "cat_2": "Daging Ayam",
    "cat_4": "Telur Ayam",
    "cat_5": "Bawang Merah",
    "cat_6": "Bawang Putih",
    "cat_7": "Cabai Merah",
    "cat_8": "Cabai Rawit",
    "cat_9": "Minyak Goreng",
}

FIELDS = ["tanggal", "provinsi", "daerah", "kategori", "komoditas", "level", "harga"]


def parse_harga(v) -> float | None:
    """PIHPS menulis harga dengan koma sebagai pemisah ribuan: "82,300" = 82300."""
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in {"", "-"}:
        return None
    try:
        x = float(s)
    except ValueError:
        return None
    if x <= 0:
        return None
    return int(x) if x.is_integer() else x


def year_chunks(start: date, end: date):
    """Pecah rentang panjang per ~1 tahun supaya tiap permintaan tidak terlalu berat."""
    cur = start
    while cur <= end:
        nxt = min(date(cur.year, 12, 31), end)
        yield cur, nxt
        cur = nxt + timedelta(days=1)


def fetch(session, prov_id, reg_id, start: date, end: date, retries=4):
    params = {
        "price_type_id": 1,                          # 1 = pasar tradisional
        "comcat_id": ",".join(CATEGORIES),
        "province_id": prov_id,
        "regency_id": reg_id,
        "market_id": "",
        "tipe_laporan": 1,                           # 1 = harian
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    for attempt in range(1, retries + 1):
        try:
            r = session.get(URL, params=params, headers=HEADERS, timeout=120)
            r.raise_for_status()
            return r.json().get("data", [])
        except Exception as exc:  # noqa: BLE001
            wait = 5 * attempt
            print(f"    gagal ({exc}); coba lagi dalam {wait} detik...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Gagal mengambil data {prov_id}/{reg_id} {start}..{end}")


def to_rows(data, provinsi, daerah):
    """Ubah tabel lebar (kolom = tanggal) menjadi baris panjang (satu baris per tanggal)."""
    kategori = None
    names = set(CATEGORIES.values())
    for item in data:
        name = str(item.get("name", "")).strip()
        level = int(item.get("level") or 0)
        if level == 1 or name in names:
            kategori = name
        for key, val in item.items():
            try:
                tgl = datetime.strptime(key, "%d/%m/%Y").date()
            except ValueError:
                continue                                 # bukan kolom tanggal (no, name, level)
            harga = parse_harga(val)
            if harga is None:
                continue
            yield {
                "tanggal": tgl.isoformat(), "provinsi": provinsi, "daerah": daerah,
                "kategori": kategori or name, "komoditas": name, "level": level, "harga": harga,
            }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, default=5, help="jumlah tahun ke belakang (default 5)")
    ap.add_argument("--start", help="YYYY-MM-DD (menimpa --years)")
    ap.add_argument("--end", help="YYYY-MM-DD (default hari ini)")
    ap.add_argument("--out", default="data/harga_pangan.csv")
    ap.add_argument("--delay", type=float, default=2.0, help="jeda antar permintaan (detik)")
    args = ap.parse_args()

    end = date.fromisoformat(args.end) if args.end else date.today()
    start = date.fromisoformat(args.start) if args.start else end.replace(year=end.year - args.years)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    session = requests.Session()
    rows = []
    for provinsi, prov_id, reg_id, daerah in REGIONS:
        for a, b in year_chunks(start, end):
            print(f"Mengambil {daerah}: {a} s/d {b} ...")
            data = fetch(session, prov_id, reg_id, a, b)
            got = list(to_rows(data, provinsi, daerah))
            print(f"    {len(got)} baris")
            rows.extend(got)
            time.sleep(args.delay)                   # sopan ke server BI

    # Urutkan & buang duplikat (kalau rentang bertumpuk)
    uniq = {(r["tanggal"], r["daerah"], r["komoditas"]): r for r in rows}
    rows = sorted(uniq.values(), key=lambda r: (r["daerah"], r["kategori"], r["level"], r["komoditas"], r["tanggal"]))

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"\nSelesai: {len(rows)} baris -> {args.out}")


if __name__ == "__main__":
    main()
