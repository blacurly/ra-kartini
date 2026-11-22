// parser.ts: aturan membaca pesan Telegram (tanpa AI, tanpa koneksi ke mana pun).
// Semua isi file ini murni perhitungan teks, jadi mudah diuji dan hasilnya selalu sama.

export type Jenis = "expense" | "income";

export const KATEGORI_PENGELUARAN: { nama: string; kata: string[] }[] = [
  { nama: "Belanja Pangan", kata: [
    "sayur", "sayuran", "bayam", "kangkung", "wortel", "kentang", "tomat", "cabai", "cabe", "bawang",
    "bawang merah", "bawang putih", "bumbu", "rempah", "beras", "telur", "tempe", "tahu", "ayam", "daging",
    "sapi", "ikan", "udang", "minyak goreng", "minyak", "gula", "garam", "tepung", "mie", "mi instan",
    "indomie", "roti", "susu", "buah", "santan", "kecap", "saus", "sembako", "pasar", "belanja dapur"] },
  { nama: "Jajan & Makan di Luar", kata: [
    "jajan", "kopi", "bakso", "mie ayam", "soto", "nasi goreng", "nasi padang", "warteg", "restoran", "resto",
    "cafe", "kafe", "boba", "es teh", "makan di luar", "makan siang", "makan malam", "sarapan", "gofood",
    "grabfood", "shopeefood", "pesan antar", "snack", "camilan", "cemilan", "martabak", "gorengan", "kue",
    "es krim", "minuman", "seblak", "pizza", "burger"] },
  { nama: "Kebutuhan Rumah", kata: [
    "sabun", "sabun cuci", "deterjen", "sampo", "shampoo", "pasta gigi", "odol", "tisu", "pel", "pembersih",
    "pewangi", "pelembut", "gas", "gas elpiji", "elpiji", "lpg", "galon", "air galon", "lampu", "baterai",
    "perabot", "panci", "alat dapur"] },
  { nama: "Tagihan & Rutin", kata: [
    "listrik", "token listrik", "pln", "pdam", "air pdam", "wifi", "internet", "indihome", "pulsa", "paket data",
    "kuota", "iuran", "arisan", "cicilan", "kontrakan", "sewa", "kos", "pajak", "bpjs", "asuransi", "langganan",
    "netflix", "spotify"] },
  { nama: "Anak & Sekolah", kata: [
    "spp", "uang sekolah", "sekolah", "les", "buku", "seragam", "alat tulis", "atk", "popok", "susu anak",
    "susu formula", "mainan", "daycare"] },
  { nama: "Transportasi", kata: [
    "bensin", "pertamax", "pertalite", "solar", "bbm", "ojek", "grab", "gojek", "ojol", "parkir", "tol",
    "angkot", "bus", "kereta", "tiket", "etoll", "e toll"] },
  { nama: "Kesehatan", kata: [
    "obat", "dokter", "vitamin", "apotek", "klinik", "rumah sakit", "puskesmas", "periksa", "imunisasi",
    "vaksin", "bidan", "masker"] },
  { nama: "Tak Terduga", kata: [
    "servis", "service", "servis hp", "servis motor", "bengkel", "perbaikan", "reparasi", "ganti ban",
    "darurat", "denda", "kehilangan"] },
  { nama: "Tabungan", kata: [
    "nabung", "menabung", "tabungan", "investasi", "celengan", "deposito"] },  
  { nama: "Lainnya", kata: [] },
];

export const KATEGORI_PEMASUKAN = ["Pemasukan Utama", "Pemasukan Lain"];

export function daftarKategori(jenis: Jenis): string[] {
  return jenis === "income" ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN.map((k) => k.nama);
}

// Huruf kecil, buang tanda baca, rapikan spasi.
export function normalisasi(teks: string): string {
  return " " + teks.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() + " ";
}

// Tebak kategori pengeluaran. Kata yang lebih panjang dihitung lebih kuat,
// jadi "susu anak" mengalahkan "susu". Kalau tidak ada yang cocok, hasilnya null (bot akan bertanya).
export function tebakKategori(teks: string): string | null {
  const t = normalisasi(teks);
  let terbaik: string | null = null;
  let skorTerbaik = 0;
  for (const k of KATEGORI_PENGELUARAN) {
    let skor = 0;
    for (const kata of k.kata) {
      if (t.includes(" " + normalisasi(kata).trim() + " ")) skor += kata.length;
    }
    if (skor > skorTerbaik) { skorTerbaik = skor; terbaik = k.nama; }
  }
  return terbaik;
}

// Pemasukan yang jelas bila kalimat DIAWALI frasa ini (kata "gaji" ditangani terpisah karena bisa berarti gaji asisten).
const AWAL_PEMASUKAN = ["uang belanja", "pemasukan", "bonus", "hasil jualan", "dapat uang", "terima uang", "diterima", "transfer masuk", "uang masuk"];
// Petunjuk pemasukan yang boleh ada di mana saja dalam kalimat.
const PETUNJUK_PEMASUKAN = ["jualan", "jual", "untung", "dikasih", "kiriman", "terima", "komisi", "thr", "bonus", "gaji"];
// Petunjuk pengeluaran selain kata kunci kategori.
const PETUNJUK_PENGELUARAN = ["beli", "bayar", "belanja", "ongkos", "biaya", "traktir", "topup", "top up", "cicil", "isi ulang"];


function adaKata(teksNormal: string, daftar: string[]): boolean {
  return daftar.some((k) => teksNormal.includes(" " + normalisasi(k).trim() + " "));
}

// Menebak jenis catatan dan apakah tebakan itu cukup pasti.
// pasti = false berarti bot sebaiknya BERTANYA, bukan menebak.
export function petunjukJenis(teksAsli: string, judul: string): { jenis: Jenis; pasti: boolean } {
  const mentah = teksAsli.trim();
  if (mentah.startsWith("+")) return { jenis: "income", pasti: true };
  if (mentah.startsWith("-")) return { jenis: "expense", pasti: true };

  const j = normalisasi(judul).trim();
  if (j === "gaji") return { jenis: "income", pasti: true };
  if (AWAL_PEMASUKAN.some((a) => j.startsWith(a))) return { jenis: "income", pasti: true };

  const t = normalisasi(teksAsli);
  const petunjukMasuk = adaKata(t, PETUNJUK_PEMASUKAN);
  const petunjukKeluar = tebakKategori(teksAsli) !== null || adaKata(t, PETUNJUK_PENGELUARAN);

  if (petunjukMasuk && petunjukKeluar) return { jenis: "expense", pasti: false }; // bertentangan: tanya
  if (petunjukMasuk) return { jenis: "income", pasti: !adaKata(t, ["gaji"]) };    // "gaji asisten" tetap ditanyakan
  if (petunjukKeluar) return { jenis: "expense", pasti: true };
  return { jenis: "expense", pasti: false };                                      // tidak ada petunjuk: tanya
}

export function kategoriPemasukan(teks: string): string {
  const t = normalisasi(teks);
  return t.includes(" uang belanja ") || t.includes(" gaji ") ? "Pemasukan Utama" : "Pemasukan Lain";
}

// Kategori awal untuk sebuah jenis; null artinya bot perlu bertanya.
export function kategoriAwal(jenis: Jenis, teks: string): string | null {
  return jenis === "income" ? kategoriPemasukan(teks) : tebakKategori(teks);
}

// Kata satuan jumlah: angka di depannya adalah jumlah barang, bukan harga.
const SATUAN_JUMLAH = new Set([
  "kg", "kilo", "gram", "gr", "ons", "liter", "lt", "l", "buah", "pcs", "biji", "bungkus", "bks", "ekor",
  "ikat", "butir", "lembar", "botol", "kaleng", "porsi", "pak", "sachet", "renteng", "dus", "karung",
  "potong", "hari", "bulan", "minggu", "orang",
]);

const BATAS_MIN = 100;
const BATAS_MAKS = 500_000_000;

function hitungNilai(angka: string, satuan?: string): number {
  if (satuan) {
    const s = satuan.toLowerCase();
    const kali = s === "jt" || s === "juta" ? 1_000_000 : 1000;
    const nilai = /^\d+[.,]\d{1,2}$/.test(angka)
      ? parseFloat(angka.replace(",", "."))
      : parseFloat(angka.replace(/[.,]/g, ""));
    return Math.round(nilai * kali);
  }
  return parseInt(angka.replace(/[.,]/g, ""), 10);
}

// Cari nominal di dalam kalimat. Jika ada beberapa angka, diambil yang terbesar
// (setelah angka jumlah seperti "2 kg" dibuang).
export function cariNominal(teks: string): { nominal: number | null; sisa: string } {
  const re = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)(?:\s*(ribu|rb|juta|jt|k)(?![a-z]))?/gi;
  let terbaik: { nilai: number; mulai: number; akhir: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(teks)) !== null) {
    const nilai = hitungNilai(m[1], m[2]);
    const mulai = m.index;
    const akhir = m.index + m[0].length;
    if (!m[2]) {
      const kata = /^\s*([a-z]+)/i.exec(teks.slice(akhir));
      if (kata && SATUAN_JUMLAH.has(kata[1].toLowerCase())) continue;
    }
    if (!Number.isFinite(nilai) || nilai < BATAS_MIN || nilai > BATAS_MAKS) continue;
    if (!terbaik || nilai > terbaik.nilai) terbaik = { nilai, mulai, akhir };
  }
  if (!terbaik) return { nominal: null, sisa: teks.trim() };
  const sisa = (teks.slice(0, terbaik.mulai) + " " + teks.slice(terbaik.akhir)).replace(/\s+/g, " ").trim();
  return { nominal: terbaik.nilai, sisa };
}

export const PETUNJUK_PINJAMAN = ["pinjam", "utang", "cair", "pinjol", "kredit"];

export type HasilOlah = { jenis: Jenis; jenisPasti: boolean; judul: string; nominal: number | null; kategori: string | null };

// Gabungan: dari satu kalimat jadi jenis, judul, nominal, dan kategori.
export function olahPesan(teks: string, jenisPaksa?: Jenis): HasilOlah {
  const bersih = teks.trim().replace(/^[+-]\s*/, "");
  const { nominal, sisa } = cariNominal(bersih);
  let judul = sisa.replace(/\s+/g, " ").trim();
  if (judul.length > 80) judul = judul.slice(0, 80).trim();

  // Deteksi khusus untuk pinjaman/utang agar langsung masuk kategori "pinjaman"
  const t = normalisasi(teks);
  if (adaKata(t, PETUNJUK_PINJAMAN)) {
    return { 
      jenis: "income", 
      jenisPasti: true, 
      judul: judul || "Pencairan Pinjaman", 
      nominal, 
      kategori: "pinjaman" 
    };
  }

  const tebak = jenisPaksa ? { jenis: jenisPaksa, pasti: true } : petunjukJenis(teks, judul);
  const kategori = kategoriAwal(tebak.jenis, bersih);
  if (!judul) judul = kategori ?? (tebak.jenis === "income" ? "Pemasukan" : "Pengeluaran");
  judul = judul.charAt(0).toUpperCase() + judul.slice(1);
  return { jenis: tebak.jenis, jenisPasti: tebak.pasti, judul, nominal, kategori };
}

export function rupiah(n: number): string {
  const s = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(n));
  return (n < 0 ? "-Rp" : "Rp") + s;
}

// Tanggal hari ini di zona waktu Jakarta, format YYYY-MM-DD.
export function hariIniJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function selisihHari(dari: string, sampai: string): number {
  return Math.round((Date.parse(sampai + "T00:00:00Z") - Date.parse(dari + "T00:00:00Z")) / 86_400_000);
}

// Geser tanggal (format YYYY-MM-DD) sebanyak n hari; n boleh negatif.
export function geserHari(tanggal: string, n: number): string {
  const d = new Date(tanggal + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Label singkat untuk tampilan, contoh: "Sab 07/11".
export function labelTanggal(tanggal: string): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })
    .format(new Date(tanggal + "T00:00:00Z")).replace(",", "");
}
