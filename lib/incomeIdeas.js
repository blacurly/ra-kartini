// lib/incomeIdeas.js
// Katalog ide pemasukan tambahan dari rumah. Disusun dan diperiksa TIM, bukan dikarang AI.
//
// Aturan pakai:
//  - AI hanya boleh MEMILIH id dari katalog ini. Isi ide (modal, langkah, risiko) selalu dari sini.
//  - Sebuah ide baru tampil ke pengguna setelah tim memeriksanya dan mengubah `diperiksa: false` menjadi `true`.
//  - Jangan menulis janji penghasilan, angka untung, atau kata seperti "pasti" dan "dijamin".
//    Fungsi periksaKatalog() di bawah akan memberi peringatan bila ada yang terlanjur tertulis.

export const LABEL_MODAL = {
  nol: "Tanpa modal tambahan",
  "sangat-kecil": "Modal sangat kecil",
  kecil: "Modal kecil",
};
// [Tim: tentukan kisaran rupiahnya setelah survei harga di daerah sasaran, lalu tulis di sini]
export const URUTAN_MODAL = ["nol", "sangat-kecil", "kecil"];

export const KETERAMPILAN = {
  memasak: "Memasak",
  menjahit: "Menjahit",
  mengajar: "Mengajar",
  komputer: "Pakai komputer atau HP untuk menulis dan administrasi",
};

export const PERINGATAN_UMUM = [
  "Ide ini adalah inspirasi, bukan jaminan penghasilan.",
  "Hati-hati dengan tawaran yang meminta setoran, biaya pendaftaran, atau mengajak merekrut anggota.",
  "Jangan meminjam uang untuk modal. Mulailah dari yang kecil dan sudah kamu kuasai.",
  "Cek aturan atau izin yang berlaku di daerahmu sebelum mulai.",
];

export const IDE = [
  {
    id: "pesanan-makanan",
    nama: "Makanan atau kue sistem pesanan",
    ringkas: "Menerima pesanan makanan rumahan dari tetangga, teman, atau grup WhatsApp, dengan sistem pesan dulu.",
    modal: "sangat-kecil", jam: 3, keterampilan: ["memasak"],
    langkah: [
      "Pilih satu atau dua menu andalan yang sudah biasa kamu masak.",
      "Tawarkan lewat grup WhatsApp atau tetangga dengan sistem pesan dulu, supaya bahan tidak terbuang.",
      "Catat harga bahan dan harga jual supaya tahu selisihnya.",
    ],
    perhatikan: ["Cek aturan izin usaha makanan rumahan di daerahmu.", "Mulai dari porsi kecil."],
    sumber: "", diperiksa: false,
  },
  {
    id: "bumbu-siap-pakai",
    nama: "Bumbu dasar atau sambal siap pakai",
    ringkas: "Membuat bumbu dasar, sambal, atau sayur potong dalam kemasan kecil untuk tetangga yang sibuk.",
    modal: "sangat-kecil", jam: 2, keterampilan: ["memasak"],
    langkah: [
      "Mulai dari satu produk yang paling sering kamu buat sendiri.",
      "Coba dulu ke tetangga dekat dan minta pendapat mereka.",
      "Catat bahan yang terpakai agar harga jualnya masuk akal.",
    ],
    perhatikan: ["Perhatikan kebersihan dan daya tahan produk.", "Cek aturan izin produk makanan di daerahmu."],
    sumber: "", diperiksa: false,
  },
  {
    id: "katering-bekal",
    nama: "Bekal harian untuk tetangga atau pekerja sekitar",
    ringkas: "Memasak bekal untuk beberapa orang yang tinggal atau bekerja di sekitar rumah.",
    modal: "kecil", jam: 3, keterampilan: ["memasak"],
    langkah: [
      "Mulai dengan beberapa porsi untuk pelanggan tetap yang sudah kamu kenal.",
      "Tentukan menu mingguan agar belanja bahan lebih teratur.",
      "Minta pembayaran mingguan atau pesan dulu supaya arus uangnya jelas.",
    ],
    perhatikan: ["Butuh waktu yang cukup tiap hari.", "Cek aturan izin usaha makanan di daerahmu."],
    sumber: "", diperiksa: false,
  },
  {
    id: "jasa-titip-belanja",
    nama: "Jasa titip belanja untuk tetangga",
    ringkas: "Membantu tetangga yang sibuk atau sulit keluar rumah berbelanja ke pasar atau swalayan saat kamu memang berbelanja.",
    modal: "nol", jam: 1, keterampilan: [],
    langkah: [
      "Tawarkan ke satu atau dua tetangga yang sudah kamu kenal.",
      "Sepakati daftar belanja dan upah jasa sebelum berangkat.",
      "Catat pesanan dan struk agar tidak tertukar.",
    ],
    perhatikan: ["Jangan menalangi uang dalam jumlah besar. Minta pembayaran di muka atau segera setelah belanja."],
    sumber: "", diperiksa: false,
  },
  {
    id: "reseller-kebutuhan-rumah",
    nama: "Menjual kebutuhan rumah tangga lewat WhatsApp",
    ringkas: "Menawarkan produk kebutuhan rumah tangga yang sudah ada pemasoknya, lewat WhatsApp atau media sosial.",
    modal: "sangat-kecil", jam: 2, keterampilan: [],
    langkah: [
      "Pilih pemasok yang jelas dan bisa dihubungi.",
      "Mulai dari beberapa produk yang memang sering dicari tetangga.",
      "Catat stok, harga beli, dan harga jual.",
    ],
    perhatikan: ["Jauhi skema yang mewajibkan setoran, membayar paket awal, atau merekrut anggota.", "Pastikan ada kebijakan retur dari pemasok."],
    sumber: "", diperiksa: false,
  },
  {
    id: "jasa-jahit-permak",
    nama: "Jasa jahit dan permak pakaian",
    ringkas: "Menerima permak, kancing, atau jahitan sederhana dari tetangga.",
    modal: "kecil", jam: 2, keterampilan: ["menjahit"],
    langkah: [
      "Mulai dari pekerjaan sederhana yang sudah kamu kuasai.",
      "Pasang harga yang jelas untuk tiap jenis pekerjaan.",
      "Beri tanda terima agar tidak ada pakaian yang tertukar.",
    ],
    perhatikan: ["Perlu mesin atau alat jahit yang layak."],
    sumber: "", diperiksa: false,
  },
  {
    id: "les-privat",
    nama: "Les privat untuk anak sekitar rumah",
    ringkas: "Mengajar pelajaran yang kamu kuasai kepada anak-anak tetangga, di rumah atau secara daring.",
    modal: "nol", jam: 2, keterampilan: ["mengajar"],
    langkah: [
      "Pilih pelajaran atau jenjang yang paling kamu kuasai.",
      "Mulai dari satu atau dua murid untuk mencoba jadwal.",
      "Sepakati jadwal dan biaya bersama orang tua murid.",
    ],
    perhatikan: ["Atur jadwal agar tidak bentrok dengan urusan keluarga."],
    sumber: "", diperiksa: false,
  },
  {
    id: "kerja-daring",
    nama: "Pekerjaan lepas daring (menulis, penerjemahan, atau administrasi)",
    ringkas: "Mengerjakan tugas tulis-menulis, penerjemahan, atau entri data dari rumah sesuai waktu luangmu.",
    modal: "nol", jam: 2, keterampilan: ["komputer"],
    langkah: [
      "Siapkan contoh hasil kerja sederhana untuk ditunjukkan.",
      "Cari pekerjaan lewat platform yang resmi dan punya sistem pembayaran jelas.",
      "Mulai dari tugas kecil untuk melihat apakah waktu dan caranya cocok.",
    ],
    perhatikan: ["Waspada tawaran yang meminta bayar di muka atau meminta data rekening dan kartu identitas ke pihak yang tidak dikenal."],
    sumber: "", diperiksa: false,
  },
  {
    id: "jual-barang-bekas",
    nama: "Menjual barang bekas yang masih layak",
    ringkas: "Merapikan barang yang sudah tidak terpakai di rumah, lalu menjualnya.",
    modal: "nol", jam: 1, keterampilan: [],
    langkah: [
      "Pilah barang yang masih layak pakai dan tidak lagi kamu butuhkan.",
      "Foto dengan jelas dan tulis kondisi barang apa adanya.",
      "Tawarkan ke tetangga, grup komunitas, atau lokapasar.",
    ],
    perhatikan: ["Ini bukan penghasilan rutin, hanya tambahan sesekali.", "Jangan menjual barang yang bukan milikmu sendiri."],
    sumber: "", diperiksa: false,
  },
  {
    id: "tanam-bumbu-dapur",
    nama: "Menanam bumbu dapur untuk dijual",
    ringkas: "Menanam cabai, serai, atau daun bumbu di pekarangan atau pot, lalu menjualnya ke tetangga.",
    modal: "sangat-kecil", jam: 1, keterampilan: [],
    langkah: [
      "Mulai dari beberapa tanaman bumbu yang sering dipakai tetangga.",
      "Rawat sedikit tiap hari, lalu jual saat sudah siap panen.",
      "Hemat juga untuk dapurmu sendiri dari hasil tanaman.",
    ],
    perhatikan: ["Hasilnya butuh waktu dan bergantung pada cuaca serta lahan."],
    sumber: "", diperiksa: false,
  },
];

export const IDE_IDS = new Set(IDE.map((i) => i.id));
export const ideById = (id) => IDE.find((i) => i.id === id) ?? null;

/**
 * Pilih ide yang sesuai jawaban pengguna. Aturan biasa, bukan AI.
 * @param {{modalMaks?: "nol"|"sangat-kecil"|"kecil", jamTersedia?: number, keterampilan?: string[]}} pilihan
 * @param {{termasukBelumDiperiksa?: boolean}} opsi  hanya untuk pengujian
 */
export function filterIdeas(pilihan = {}, opsi = {}) {
  const maks = URUTAN_MODAL.indexOf(pilihan.modalMaks ?? "nol");
  const jam = Number.isFinite(pilihan.jamTersedia) ? pilihan.jamTersedia : 2;
  const punya = Array.isArray(pilihan.keterampilan) ? pilihan.keterampilan : [];
  return IDE.filter((i) => {
    if (!opsi.termasukBelumDiperiksa && !i.diperiksa) return false;
    if (URUTAN_MODAL.indexOf(i.modal) > (maks < 0 ? 0 : maks)) return false;
    if (i.jam > jam) return false;
    return i.keterampilan.length === 0 || i.keterampilan.some((k) => punya.includes(k));
  });
}

/** Bentuk ide yang aman dikirim ke browser. */
export const tampilanIde = (i) => ({
  id: i.id, nama: i.nama, ringkas: i.ringkas, modal: LABEL_MODAL[i.modal], jam: i.jam,
  keterampilan: i.keterampilan.map((k) => KETERAMPILAN[k] ?? k), langkah: i.langkah, perhatikan: i.perhatikan,
});

// Pemeriksa isi katalog: mengembalikan daftar masalah (kosong = bersih).
const KATA_TERLARANG = /\b(pasti|dijamin)\b|tanpa risiko|untung (besar|pasti)|cepat kaya|investasi|bunga|pinjam|jutaan|\bRp\s?\d|\d+\s?%/i;
export function periksaKatalog() {
  const masalah = [];
  const ids = new Set();
  for (const i of IDE) {
    if (ids.has(i.id)) masalah.push(`${i.id}: id ganda`);
    ids.add(i.id);
    if (!URUTAN_MODAL.includes(i.modal)) masalah.push(`${i.id}: modal "${i.modal}" tidak dikenal`);
    if (!(i.jam >= 1 && i.jam <= 4)) masalah.push(`${i.id}: jam harus 1 sampai 4`);
    for (const k of i.keterampilan) if (!KETERAMPILAN[k]) masalah.push(`${i.id}: keterampilan "${k}" tidak dikenal`);
    if (i.langkah.length < 2) masalah.push(`${i.id}: minimal 2 langkah`);
    if (!i.perhatikan.length) masalah.push(`${i.id}: isi minimal satu hal yang perlu diperhatikan`);
    const teks = [i.nama, i.ringkas, ...i.langkah, ...i.perhatikan].join(" | ");
    const m = teks.match(KATA_TERLARANG);
    if (m) masalah.push(`${i.id}: ada kata yang berisiko ("${m[0]}"). Ubah kalimatnya`);
  }
  return masalah;
}
