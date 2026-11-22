# Dokumentasi Fitur AI — SAKUPUAN

Dokumen ini disusun sebagai dokumentasi resmi implementasi kecerdasan buatan (AI) dan analitik prediktif pada platform **SAKUPUAN** (*Kelompok RA Kartini*).

---

## 1. Use Case AI & Alasan Pemilihan Solusi

### Problem Statement
Banyak rumah tangga, khususnya ibu rumah tangga pengelola keuangan harian, menghadapi dua tantangan utama:
1. **Kesulitan menerjemahkan catatan pengeluaran menjadi langkah perbaikan nyata**, terutama ketika kondisi arus kas sedang ketat atau skor kesehatan finansial menurun.
2. **Fluktuasi harga bahan pangan pokok** yang sering membuat anggaran belanja dapur meleset karena pengeluaran pangan direncanakan tanpa mempertimbangkan tren harga ke depan.

### Use Case AI yang Dipilih
SAKUPUAN menerapkan dua *use case* utama berbasis AI dan pemodelan data:
1. **Asisten Edukasi Finansial Berbasis Generative AI (`Puan AI` / Chatbot):** Memberikan analisis kondisi keuangan yang empatik, strategi penganggaran taktis, serta rekomendasi langkah praktis (*Action Plan*) yang relevan dengan kondisi pengguna.
2. **Prediksi / Proyeksi Harga Pangan (`/forecast`):** Menyajikan estimasi pergerakan harga komoditas pangan pokok berdasarkan data historis pasar tradisional agar pengguna dapat mengantisipasi kenaikan harga bahan dapur.

### Alasan AI Dibutuhkan
* Pendekatan aturan statis (*if-else* biasa) tidak cukup fleksibel untuk merangkum kondisi keuangan yang bervariasi sekaligus menyusun saran taktis yang kontekstual, empatik, dan mudah dipahami oleh pengguna non-teknis.
* Pemodelan tren dari data historis harga pangan membantu mengubah data deret waktu (*time-series*) yang mentah menjadi informasi proyeksi yang praktis untuk pengambilan keputusan belanja rumah tangga.

---

## 2. Model yang Digunakan & Alasan Pemilihan

### A. Generative AI Advisor: Google Gemini (`gemini-3.5-flash-lite`)
* **Model:** `gemini-3.5-flash-lite` (diakses melalui Google Gemini API dengan `GEMINI_API_KEY`).
* **Alasan Pemilihan:**
  * **Respons cepat & latensi rendah:** Cocok untuk interaksi *chatbot* *real-time* di aplikasi web agar pengguna tidak menunggu lama.
  * **Efisien & hemat biaya operasional:** Varian *flash-lite* ringan untuk dijalankan pada skala prototipe maupun produksi awal tanpa membebani kuota secara berlebihan.
  * **Mampu mengikuti instruksi terstruktur (Structured Output):** Dapat dikendalikan melalui *system prompt* dan *guardrails* ketat untuk menghasilkan keluaran JSON murni (`reply` dan `suggestion`) yang langsung terhubung ke fitur *Action Plan*.

### B. Proyeksi Harga Pangan: Log-Linear Seasonal Ridge Regression + AR(1)
* **Model & Algoritma:** `SeasonalModel` — Regresi Ridge terboboti waktu (*exponential time-decay sample weights*) pada skala logaritma harga ($\log(\text{harga})$) yang dikombinasikan dengan koreksi *autoregressive* orde-1 (**AR(1)**) pada *residual* terakhir.
* **Fitur (*Feature Engineering*):**
  * Tren waktu linear tahunan.
  * Musiman bulanan (*dummy variables* Februari–Desember dengan Januari sebagai *baseline*).
  * **Indikator Musiman Ramadan (`ramadan_share`):** Proporsi hari dalam satu bulan yang beririsan dengan bulan Ramadan (`0..1`) untuk menangkap pola kenaikan harga musiman khas Indonesia.
* **Alasan Pemilihan:**
  * Jauh lebih stabil dan tahan *overfitting* pada data deret waktu bulanan dengan panjang terbatas dibandingkan *deep learning* yang berat.
  * Mampu memisahkan tren jangka panjang, pola musiman kalender, dan efek khusus bulan Ramadan secara eksplisit sekaligus menghasilkan interval kepercayaan (`bawah` dan `atas`).

---

## 3. Sumber dan Jenis Data yang Dipakai

1. **Data Skor & Konteks Finansial Pengguna (Internal Aplikasi)**
   * **Jenis Data:** Data terstruktur (*numeric* dan *categorical*) berupa skor kesehatan finansial pengguna (`health_score`, rentang `0–100`), ringkasan kondisi arus kas/anggaran, serta pertanyaan/pesan teks dari pengguna.
   * **Sumber:** Input pengguna dan hasil kalkulasi sistem pada database **SAKUPUAN** (Supabase), terisolasi per akun pengguna (`user_id`).
2. **Data Harga Komoditas Pangan (Eksternal Publik)**
   * **Jenis Data:** Data deret waktu (*time-series*) harga rata-rata komoditas pangan pokok (seperti beras medium, cabai merah, cabai rawit, minyak goreng, bawang merah, bawang putih, telur ayam) beserta hasil proyeksi bulanannya.
   * **Sumber:** Data historis harga pasar tradisional dari **PIHPS (Pusat Informasi Harga Pangan Strategis) Bank Indonesia** (wilayah Semarang).

---

## 4. Input dan Output Fitur AI

### A. Fitur Chatbot / Asisten Edukasi Finansial (`Puan AI`)
* **Input:**
  * Pesan atau pertanyaan teks dari pengguna.
  * Konteks finansial pengguna (skor finansial saat ini) serta *System Prompt* berisi peran asisten dan aturan ketat (*guardrails*).
* **Output (JSON Murni):**
  * `reply` *(string)*: Jawaban edukatif lengkap berisi ringkasan kondisi keuangan, strategi penganggaran taktis, saran alternatif pemasukan tambahan (*side hustle* rumahan bermodal minimal) **khusus jika skor finansial `< 40`**, serta *disclaimer* wajib.
  * `suggestion` *(object)*: Rekomendasi aksi terstruktur yang dapat disimpan ke **Action Plan**, terdiri dari:
    * `title` *(string, maks. 160 karakter)*: Judul aksi praktis.
    * `desc` *(string, maks. 300 karakter)*: Langkah memulai aksi dengan modal minimal.
    * `cat` *(string)*: Salah satu dari 4 kategori valid (`"Makanan & minuman"`, `"Investasi & Tabungan"`, `"Cicilan & utang"`, `"Kebutuhan rumah tangga"`).

### B. Fitur Prediksi Harga Pangan (`/forecast`)
* **Input:**
  * Pilihan komoditas pangan (misalnya Cabai Merah, Beras Medium, Minyak Goreng) dan rentang waktu proyeksi (`1 Bulan`, `3 Bulan`, atau `6 Bulan`).
* **Output:**
  * Nilai **Rata-rata Terkini**, angka **Proyeksi**, persentase **Perubahan** (`+/- %`), serta grafik garis data historis dan proyeksi bulanan yang dilengkapi catatan kebijakan penggunaan AI.

---

## 5. Hasil Evaluasi, Batasan, dan Risiko

### Hasil Evaluasi Implementasi
* **Kepatuhan Format Output:** Dengan penerapan *system prompt* dan aturan *guardrail* ketat, model `gemini-3.5-flash-lite` mampu menghasilkan respons JSON terstruktur (`reply` dan `suggestion`) yang konsisten sehingga dapat langsung diproses oleh antarmuka aplikasi.
* **Kontekstualisasi Saran:** Pengujian pada skenario skor rendah (`< 40`) berhasil memicu saran pemasukan tambahan yang realistis untuk dikerjakan dari rumah tanpa menyebutkan merek produk finansial tertentu.
* **Keterbacaan Proyeksi Pangan:** Visualisasi tren harga dan persentase perubahan mempermudah pengguna melihat arah kenaikan/penurunan harga komoditas sebelum menyusun anggaran belanja.
* **Validasi Model Proyeksi Pangan (*Rolling-Origin Backtesting*):** Model dievaluasi menggunakan skema *rolling-origin backtest* dengan metrik **MAPE** (*Mean Absolute Percentage Error*) dan dibandingkan langsung terhadap model *baseline* **Naive** (harga bulan terakhir) dan **Seasonal Naive** (harga 12 bulan sebelumnya), serta dilengkapi rentang estimasi batas bawah dan batas atas berdasarkan kuantil *error* historis.

### Batasan Sistem (Limitations)
1. **Bukan Nasihat Keuangan Profesional:** Saran AI bersifat edukatif dan informatif berdasarkan data yang dimasukkan pengguna, bukan pengganti konsultan keuangan bersertifikat.
2. **Sifat Prakiraan Harga:** Proyeksi harga pangan dihitung secara statistik dari data historis PIHPS Bank Indonesia, sehingga tidak dapat memprediksi guncangan pasar mendadak (seperti cuaca ekstrem, gangguan distribusi, atau kebijakan mendadak).
3. **Ketergantungan pada Kelengkapan Input Pengguna:** Akurasi konteks saran sangat bergantung pada kedisiplinan pengguna dalam mencatat transaksi dan kondisi keuangannya.

### Risiko yang Diidentifikasi & Mitigasi
| Risiko | Dampak | Mitigasi yang Diterapkan |
| :--- | :--- | :--- |
| **Halusinasi angka oleh LLM** | AI menyebut nominal/angka yang tidak sesuai dengan data pengguna | Aturan ketat pada *system prompt* untuk **hanya** menggunakan angka yang secara eksplisit diberikan dalam *prompt*. |
| **Rekomendasi produk finansial spesifik** | Bias atau risiko menyarankan produk bank/investasi tertentu | Larangan eksplisit pada *prompt* untuk menyebut/membandingkan nama bank, aplikasi, saham, reksa dana, asuransi, atau kripto. |
| **Ketergantungan berlebih pada hasil AI** | Pengguna menganggap prediksi harga atau saran AI sebagai kepastian mutlak | Pencantuman *disclaimer* kebijakan AI secara jelas di bawah grafik prediksi pangan, di panel *chatbot*, dan di akhir jawaban asisten. |
| **Kegagalan format JSON / gangguan API** | Error saat *parsing* respons di *frontend* | Penegasan format JSON murni di *prompt* serta penanganan *error*/*fallback* di lapisan *service* backend. |