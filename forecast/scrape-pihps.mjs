// Scraper harga pangan PIHPS Bank Indonesia (Pasar Tradisional, per daerah) — versi Node.js
// Sumber: https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah
//
// Butuh Node.js 18+ (fetch bawaan). Tanpa npm install.
//
// Pemakaian:
//   node scrape-pihps.mjs                       -> 5 tahun terakhir ke data/harga_pangan.csv
//   node scrape-pihps.mjs --years 1             -> 1 tahun terakhir
//   node scrape-pihps.mjs --start 2024-01-01 --end 2024-12-31 --out data/2024.csv
//
// Output (sama persis dengan scrape_pihps.py):
//   tanggal,provinsi,daerah,kategori,komoditas,level,harga
//   level 1 = rata-rata kategori (mis. "Cabai Merah"), level 2 = jenis spesifik (mis. "Cabai Merah Keriting")

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const URL_GRID = 'https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetGridDataDaerah';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Referer: 'https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah',
  'X-Requested-With': 'XMLHttpRequest',
  Accept: 'application/json, text/javascript, */*; q=0.01',
};

// ID diambil dari GetRefProvince / GetRefRegency di situs PIHPS
export const REGIONS = [
  { provinsi: 'DKI Jakarta', provId: 13, regId: 34, daerah: 'Kota Jakarta Pusat' }, // satu-satunya kota DKI di PIHPS
  { provinsi: 'Jawa Tengah', provId: 14, regId: 35, daerah: 'Kota Semarang' },
  { provinsi: 'Sulawesi Tengah', provId: 28, regId: 74, daerah: 'Kota Palu' },
];

// Kategori PIHPS (comcat_id). Hapus baris yang tidak perlu.
export const CATEGORIES = {
  cat_1: 'Beras',
  cat_2: 'Daging Ayam',
  cat_4: 'Telur Ayam',
  cat_5: 'Bawang Merah',
  cat_6: 'Bawang Putih',
  cat_7: 'Cabai Merah',
  cat_8: 'Cabai Rawit',
  cat_9: 'Minyak Goreng',
};

const FIELDS = ['tanggal', 'provinsi', 'daerah', 'kategori', 'komoditas', 'level', 'harga'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- helper ----------
function parseArgs(argv) {
  const args = { years: 5, out: 'data/harga_pangan.csv', delay: 2 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (['years', 'start', 'end', 'out', 'delay'].includes(k)) args[k] = argv[++i];
  }
  args.years = Number(args.years);
  args.delay = Number(args.delay);
  return args;
}

// Date <-> 'YYYY-MM-DD' (pakai UTC supaya tidak geser karena timezone)
const toYmd = (d) => d.toISOString().slice(0, 10);
const fromYmd = (s) => new Date(`${s}T00:00:00Z`);

function todayYmd() {
  // tanggal hari ini versi WIB
  return toYmd(new Date(Date.now() + 7 * 3600 * 1000));
}

// Pecah rentang panjang per tahun kalender supaya tiap permintaan tidak terlalu berat
export function yearChunks(startYmd, endYmd) {
  const chunks = [];
  let cur = fromYmd(startYmd);
  const end = fromYmd(endYmd);
  while (cur <= end) {
    const yearEnd = fromYmd(`${cur.getUTCFullYear()}-12-31`);
    const next = yearEnd < end ? yearEnd : end;
    chunks.push([toYmd(cur), toYmd(next)]);
    cur = new Date(next.getTime() + 86400000);
  }
  return chunks;
}

// PIHPS menulis harga dengan koma sebagai pemisah ribuan: "82,300" = 82300
export function parseHarga(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replaceAll(',', '');
  if (s === '' || s === '-') return null;
  const x = Number(s);
  return Number.isFinite(x) && x > 0 ? x : null;
}

// Tabel lebar (kolom = tanggal "dd/mm/yyyy") -> baris panjang (satu baris per tanggal)
export function toRows(data, provinsi, daerah) {
  const rows = [];
  const catNames = new Set(Object.values(CATEGORIES));
  let kategori = null;
  for (const item of data) {
    const name = String(item.name ?? '').trim();
    const level = Number(item.level ?? 0);
    if (level === 1 || catNames.has(name)) kategori = name;
    for (const [key, val] of Object.entries(item)) {
      const m = key.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) continue; // bukan kolom tanggal (no, name, level)
      const harga = parseHarga(val);
      if (harga === null) continue;
      rows.push({
        tanggal: `${m[3]}-${m[2]}-${m[1]}`,
        provinsi,
        daerah,
        kategori: kategori ?? name,
        komoditas: name,
        level,
        harga,
      });
    }
  }
  return rows;
}

async function fetchGrid({ provId, regId }, start, end, retries = 4) {
  const params = new URLSearchParams({
    price_type_id: '1', // 1 = pasar tradisional
    comcat_id: Object.keys(CATEGORIES).join(','),
    province_id: String(provId),
    regency_id: String(regId),
    market_id: '',
    tipe_laporan: '1', // 1 = harian
    start_date: start,
    end_date: end,
  });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${URL_GRID}?${params}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data ?? [];
    } catch (err) {
      const wait = 5 * attempt;
      console.error(`    gagal (${err.message}); coba lagi dalam ${wait} detik...`);
      await sleep(wait * 1000);
    }
  }
  throw new Error(`Gagal mengambil data ${provId}/${regId} ${start}..${end}`);
}

const csvCell = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// ---------- main ----------
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const end = args.end ?? todayYmd();
  const start =
    args.start ?? `${Number(end.slice(0, 4)) - args.years}${end.slice(4)}`;

  let rows = [];
  for (const region of REGIONS) {
    for (const [a, b] of yearChunks(start, end)) {
      console.log(`Mengambil ${region.daerah}: ${a} s/d ${b} ...`);
      const data = await fetchGrid(region, a, b);
      const got = toRows(data, region.provinsi, region.daerah);
      console.log(`    ${got.length} baris`);
      rows.push(...got);
      await sleep(args.delay * 1000); // sopan ke server BI
    }
  }

  // Buang duplikat & urutkan
  const uniq = new Map(rows.map((r) => [`${r.tanggal}|${r.daerah}|${r.komoditas}`, r]));
  rows = [...uniq.values()].sort(
    (x, y) =>
      x.daerah.localeCompare(y.daerah) ||
      x.kategori.localeCompare(y.kategori) ||
      x.level - y.level ||
      x.komoditas.localeCompare(y.komoditas) ||
      x.tanggal.localeCompare(y.tanggal),
  );

  const csv = [FIELDS.join(','), ...rows.map((r) => FIELDS.map((f) => csvCell(r[f])).join(','))].join('\n') + '\n';
  await mkdir(dirname(args.out) || '.', { recursive: true });
  await writeFile(args.out, csv, 'utf8');
  console.log(`\nSelesai: ${rows.length} baris -> ${args.out}`);
}

// Jalankan main() hanya kalau file ini dieksekusi langsung (bukan di-import)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scrape-pihps.mjs')) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
