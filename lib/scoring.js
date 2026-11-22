// lib/scoring.js
// Logika skor murni dengan pemisahan ketat: Tabungan, Cicilan, dan Pinjaman (Gali Lubang Tutup Lubang).

export const WEIGHTS = { spend: 0.3, save: 0.25, borrow: 0.25, plan: 0.2 };

export const BANDS = { healthy: 80, ok: 60, watch: 40 };

export const RATIO_RULES = {
  spend: { best: 0.7, worst: 1.2 },   // pengeluaran (di luar tabungan) / pemasukan murni
  save: { best: 0.2, worst: 0 },      // tabungan / pemasukan murni
  borrow: { best: 0.1, worst: 0.4 },  // cicilan / pemasukan murni
  plan: { best: 3, worst: 0 },        // dana darurat dalam bulan pengeluaran
};

/** Kategori khusus untuk pemilahan */
export const SAVING_CATS = ["tabungan"];
export const DEBT_CATS = ["cicilan", "tagihan"];
export const LOAN_INCOME_CATS = ["pinjaman", "utang_cair", "pencairan-pinjaman"]; // Pemasukan yang berasal dari utang

export const MIN_DIMENSIONS = 3;
export const MIN_LOGGED_DAYS = 5;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sumOf = (rows) => rows.reduce((s, t) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);

export function linearScore(value, best, worst) {
  if (!Number.isFinite(value)) return null;
  const t = (value - worst) / (best - worst);
  return Math.round(clamp(t, 0, 1) * 100);
}

export const pillarStatus = (v) =>
  v === null || v === undefined
    ? "Belum diketahui"
    : v >= 85 ? "Bebas pusing" : v >= 70 ? "Aman jaya" : v >= 50 ? "Udah ada bayangan" : "Perlu disiram dikit";

function bandOf(total) {
  if (total >= BANDS.healthy)
    return { category: "Hijau", status: "Sehat", label: "Masak Sultan, Hati Tenang", tagline: "Pengaturan belanja dan kas aman terkendali." };
  if (total >= BANDS.ok)
    return { category: "Kuning", status: "Cukup aman", label: "Dapur Aman, Napas Lega", tagline: "Tinggal dikit lagi menuju zona nyaman." };
  if (total >= BANDS.watch)
    return { category: "Oranye", status: "Waspada", label: "Dapur Perlu Dijaga", tagline: "Ada beberapa pos yang bisa dirapikan pelan-pelan." };
  return { category: "Merah", status: "Perlu perhatian", label: "Mode Siaga Dapur", tagline: "Yuk pelan-pelan kita rapiin!" };
}

const PILLAR_TEXT = {
  spend: { name: "Belanja", code: "SPEND", praise: "arus belanjamu masih terkendali", tip: "biar pengeluaran nggak melebihi pemasukan, yuk cek pos yang bisa disesuaikan lewat catatan harian!" },
  save: { name: "Tabungan", code: "SAVE", praise: "tabunganmu udah rajin diisi", tip: "biar makin tenang kalau ada keperluan mendadak, yuk sisihkan sedikit demi sedikit tiap periode!" },
  borrow: { name: "Utang", code: "BORROW", praise: "cicilanmu masih ringan", tip: "biar cicilan tetap ringan, yuk catat jatuh temponya biar nggak kelewat!" },
  plan: { name: "Rencana", code: "PLAN", praise: "dana daruratmu udah ada bayangan", tip: "biar keluarga makin terlindungi, yuk mulai bangun dana darurat bertahap!" },
};

export function calculatePeriodScore(input) {
  const {
    transactions = [],
    budgetAmount = null,
    loggedDays = 0,
    declaredNoDebt = null,
    emergencyMonths = null,
    periodClosed = false,
  } = input || {};

  // 1. Pisahkan pemasukan murni (gaji/usaha) dengan pemasukan dari utang/pinjaman
  const allInflows = transactions.filter((t) => t.flow === "in");
  const loanInflows = allInflows.filter((t) => LOAN_INCOME_CATS.includes(t.cat));
  const pureInflows = allInflows.filter((t) => !LOAN_INCOME_CATS.includes(t.cat));

  const incomeRecorded = sumOf(pureInflows);
  const borrowedCash = sumOf(loanInflows); // Uang cair dari pinjaman

  const outAll = transactions.filter((t) => t.flow === "out");
  const savings = sumOf(outAll.filter((t) => SAVING_CATS.includes(t.cat)));
  const debt = sumOf(outAll.filter((t) => DEBT_CATS.includes(t.cat)));
  const outflow = sumOf(outAll) - savings; // Pengeluaran murni di luar tabungan

  let income = incomeRecorded;
  let incomeSource = "catatan";
  if (!(income > 0) && Number(budgetAmount) > 0) { income = Number(budgetAmount); incomeSource = "anggaran"; }
  if (!(income > 0)) incomeSource = "tidak ada";

  const known = income > 0;
  
  // 2. Hitung dimensi skor
  const dims = {
    spend: known ? linearScore(outflow / income, RATIO_RULES.spend.best, RATIO_RULES.spend.worst) : null,
    save: known ? linearScore(savings / income, RATIO_RULES.save.best, RATIO_RULES.save.worst) : null,
    borrow: !known ? null
      : debt > 0 ? linearScore(debt / income, RATIO_RULES.borrow.best, RATIO_RULES.borrow.worst)
      : declaredNoDebt === true ? 100 : null,
    plan: Number.isFinite(emergencyMonths) ? linearScore(emergencyMonths, RATIO_RULES.plan.best, RATIO_RULES.plan.worst) : null,
  };

  const keys = Object.keys(WEIGHTS);
  const filled = keys.filter((k) => dims[k] !== null);
  const weightSum = filled.reduce((s, k) => s + WEIGHTS[k], 0);
  let total = filled.length ? Math.round(filled.reduce((s, k) => s + WEIGHTS[k] * dims[k], 0) / weightSum) : null;

  // 3. Deteksi Warnings (Termasuk jebakan gali lubang tutup lubang)
  const warnings = [];
  
  if (borrowedCash > 0) {
    warnings.push({
      code: "GALI_LUBANG",
      text: `⚠️ Terdeteksi pencairan pinjaman sebesar Rp ${borrowedCash.toLocaleString("id-ID")}. Hati-hati, pemasukan dari utang tidak menyehatkan skor keuangan secara permanen.`
    });
    // Penalti skor pilar borrow atau turunkan sedikit jika mengandalkan utang
    if (dims.borrow !== null) {
      dims.borrow = Math.max(0, dims.borrow - 30); // Penalti pilar utang
    }
  }

  if (dims.spend !== null && dims.spend < BANDS.watch) {
    warnings.push({ code: "ARUS_KAS", text: "Pengeluaran periode ini sudah mendekati atau melebihi pemasukan. Yuk cek pos yang bisa disesuaikan." });
  }
  if (incomeSource === "anggaran") {
    warnings.push({ code: "PEMASUKAN_DARI_ANGGARAN", text: "Belum ada pemasukan tercatat, jadi skor memakai jumlah uang belanja periode ini." });
  }

  const provisional = filled.length < MIN_DIMENSIONS || (loggedDays > 0 && loggedDays < MIN_LOGGED_DAYS);
  const stage = provisional ? "sementara" : periodClosed ? "final" : "berjalan";

  const pillars = keys.map((k) => ({
    key: k, ...PILLAR_TEXT[k], value: dims[k], status: pillarStatus(dims[k]),
  }));
  const withValue = pillars.filter((p) => p.value !== null);
  const best = withValue.length ? withValue.reduce((m, x) => (x.value > m.value ? x : m)) : null;
  const weakest = withValue.length ? withValue.reduce((m, x) => (x.value < m.value ? x : m)) : null;

  if (total === null) {
    return {
      totalScore: null, spend: null, save: null, borrow: null, plan: null,
      category: "Belum diketahui", status: "Belum cukup data", label: "Belum Cukup Data",
      tagline: "Catat pemasukan dan pengeluaran dulu ya, nanti skornya muncul.",
      insight: "Skor muncul setelah ada pemasukan atau uang belanja periode ini.",
      stage: "sementara", provisional: true, incomeSource, warnings, pillars, best: null, weakest: null,
      basis: { income, outflow, savings, debt, borrowedCash, loggedDays, filled: 0 },
    };
  }

  // Jika ada penalti pinjaman, hitung ulang total skor tipis
  const band = bandOf(total);
  const opener = total >= BANDS.ok ? "Keren!" : "Semangat!";
  const missing = pillars.filter((p) => p.value === null).map((p) => p.name);
  const insight =
    `${opener} Dari catatan periode ini, ${best.praise}. ` +
    (weakest.key === best.key ? "Yuk pertahankan dengan rutin mencatat." : `Nah, ${weakest.tip}`) +
    (missing.length ? ` (Belum ada data untuk: ${missing.join(", ")}.)` : "");

  return {
    totalScore: total, spend: dims.spend, save: dims.save, borrow: dims.borrow, plan: dims.plan,
    ...band, stage, provisional, incomeSource, warnings, insight, pillars, best, weakest,
    basis: { income, outflow, savings, debt, borrowedCash, loggedDays, filled: filled.length },
  };
}

export const dashboardLabel = (score) =>
  score === null || score === undefined ? "Belum Cukup Data"
    : score >= BANDS.healthy ? "Masak Sultan, Hati Tenang"
    : score >= BANDS.ok ? "Dapur Aman"
    : score >= BANDS.watch ? "Dapur Perlu Dijaga"
    : "Perlu Perhatian";

export const CATEGORY_STYLES = {
  Hijau: "text-[#1F5932] bg-[#EAF3EC] border-[#B8D8C0]",
  Kuning: "text-[#92400E] bg-[#FEF3C7] border-[#FDE68A]",
  Oranye: "text-[#9A3412] bg-[#FFEDD5] border-[#FDBA74]",
  Merah: "text-[#C71C63] bg-[#FFF0F6] border-[#FFC2DC]",
  "Belum diketahui": "text-[#475569] bg-[#F1F5F9] border-[#CBD5E1]",
};

export function calculateScore(answers) {
  const spend = (answers.B1_month_end_money + answers.B2_bills_on_time) / 2;
  const save = (answers.B3_emergency_fund + answers.B4_longterm_confidence) / 2;
  const borrow =
    answers.B5_debt_status === 100 ? 100 : (answers.B5_debt_status + answers.B6_credit_history) / 2;
  const plan = (answers.B7_insurance_confidence + answers.B8_future_plan) / 2;
  const totalScore = Math.round((spend + save + borrow + plan) / 4);

  let category = "Hijau";
  let label = "Masak Sultan, Hati Tenang";
  let tagline = "Pengaturan belanja dan kas aman terkendali.";
  if (totalScore < 40) { category = "Merah"; label = "Mode Siaga Dapur"; tagline = "Yuk! pelan-pelan kita rapiin."; }
  else if (totalScore < 80) { category = "Kuning"; label = "Dapur Aman, Napas Lega"; tagline = "Tinggal dikit lagi menuju zona nyaman."; }

  const pillars = ["spend", "save", "borrow", "plan"].map((key) => ({
    key, ...PILLAR_TEXT[key], value: { spend, save, borrow, plan }[key],
  }));
  const best = pillars.reduce((m, x) => (x.value > m.value ? x : m));
  const weakest = pillars.reduce((m, x) => (x.value < m.value ? x : m));
  const insight = `Keren! ${best.praise.charAt(0).toUpperCase() + best.praise.slice(1)} (${best.value}/100). Nah, ${
    best.key === weakest.key ? "yuk pertahankan dengan rutin catat belanja harian via Telegram!" : weakest.tip
  }`;
  return { totalScore, spend, save, borrow, plan, category, label, tagline, insight, pillars, best };
}