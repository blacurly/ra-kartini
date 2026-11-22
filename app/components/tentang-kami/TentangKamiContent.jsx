'use client';

import { useState } from "react";
import LandingHeader from "@/app/components/landing/LandingHeader";
import LandingFooter from "@/app/components/landing/LandingFooter";

const CARA_KERJA = [
  { judul: "Catat", teks: "Catat belanja lewat website atau chat Telegram, cukup satu pesan singkat seperti \"sayur 35000\"." },
  { judul: "Pantau", teks: "Lihat sisa uang belanja dan perkiraan apakah uangnya cukup sampai pemasukan berikutnya." },
  { judul: "Bersiap", teks: "Pantau pergerakan harga pangan sebagai perkiraan, supaya bisa menyesuaikan belanja lebih awal." },
  { judul: "Cari pilihan", teks: "Kalau pengeluaran pangan sudah sulit ditekan, lihat ide pemasukan tambahan dari rumah sebagai inspirasi." },
];

const PRINSIP = [
  { judul: "Sederhana", teks: "Mencatat secepat mengirim pesan, tanpa istilah keuangan yang rumit." },
  { judul: "Jujur", teks: "Prediksi adalah perkiraan, bukan kepastian. Saran adalah inspirasi, bukan jaminan hasil." },
  { judul: "Menghargai privasi", teks: "Data keuanganmu adalah milikmu. Tidak dijual dan tidak dipakai untuk iklan yang menarget pengguna." },
  { judul: "Berpihak pada pengguna", teks: "Fitur inti tetap gratis. Rekomendasi belanja tidak boleh mengalahkan pilihan yang paling hemat bagi penggunanya." },
];

const PERLU_DIKETAHUI = [
  "SAKUPUAN bukan layanan nasihat keuangan, perencana keuangan, atau lembaga keuangan.",
  "Perkiraan harga dan proyeksi keuangan bisa meleset. Anggap sebagai simulasi untuk membantu perencanaan.",
  "Saran pemasukan tambahan bersifat inspirasi dan tidak menjamin penghasilan.",
  "Versi awal mendukung pengguna dengan jadwal pemasukan yang tetap, bulanan atau mingguan.",
  "Data harga pangan bersumber dari PIHPS dan SP2KP.",
];

// Isi satu objek per anggota tim. Tampilkan nama dan foto hanya dengan persetujuan masing-masing.
const TIM = [
  { nama: "Nurviani Rizka Andina, S.T.", lokasi: "Kudus - Jawa Tengah", foto: "IMG-20261116-WA0052.jpg" },
  { nama: "Siti Nur'aisa Mansur, S.Pd.,Gr", lokasi: "Donggala - Sulawesi Tengah", foto: "IMG-20261114-WA0038.jpg" },
];

const inisial = (nama) =>
  nama
    .replace(/[\[\]]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0].toUpperCase())
    .join("");

function Judul({ kecil, besar }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF4B93]">{kecil}</p>
      <h2 className="mt-2 text-2xl font-bold text-[#1F5932] sm:text-3xl">{besar}</h2>
    </div>
  );
}

export default function TentangKamiContent() {
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(null);
  
  const openAuth = (type) => {
    window.location.href = `/#${type}`;
  };

  return (
    <div className="min-h-screen bg-[#FBF7F3] text-[#1E2B24] flex flex-col">
      <LandingHeader menu={menu} setMenu={setMenu} openAuth={openAuth} />
    
      <main className="flex-1">
      {/* Pembuka */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FF4B93]">Tentang SAKUPUAN</p>
          <h1 className="mt-3 text-3xl font-bold text-[#1F5932] sm:text-5xl">Dapur Tenang, Dompet Senang.</h1>
          <p className="mt-6 text-base leading-relaxed text-[#4A5A51] sm:text-lg">
            SAKUPUAN membantu ibu rumah tangga mengetahui lebih awal apakah uang belanja pangan cukup sampai pemasukan
            berikutnya, dengan pencatatan yang ringan dan tidak memberatkan.
          </p>
        </section>

        {/* Kenapa ada */}
        <section className="bg-white px-6 py-14">
          <div className="mx-auto max-w-3xl">
            <Judul kecil="Cerita kami" besar="Kenapa SAKUPUAN ada" />
            <div className="space-y-4 text-base leading-relaxed text-[#3B4A41]">
              <p>
                Bagi banyak ibu rumah tangga, uang belanja pangan adalah pos yang paling sulit dijaga sampai gajian
                berikutnya. Harga bahan pokok naik-turun, mencatat setiap belanja terasa melelahkan, dan kekurangan baru
                terasa ketika uang sudah menipis.
              </p>
              <p>
                Dalam wawancara kami dengan ibu rumah tangga, pengeluaran pangan memang sering menjadi pos yang melampaui
                anggaran. Karena itu SAKUPUAN dibuat untuk satu hal sederhana: membantu melihat lebih awal, supaya ada waktu
                untuk menyesuaikan.
              </p>
            </div>
          </div>
        </section>

        {/* Cara kerja */}
        <section className="px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <Judul kecil="Cara kerja" besar="Dari catatan sampai pilihan" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CARA_KERJA.map((k, i) => (
                <div key={k.judul} className="rounded-2xl border border-[#E8E0D6] bg-white p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F5932] text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <h3 className="mt-4 font-semibold text-[#1F5932]">{k.judul}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4A5A51]">{k.teks}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prinsip */}
        <section className="bg-white px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <Judul kecil="Prinsip kami" besar="Yang kami pegang" />
            <div className="grid gap-4 sm:grid-cols-2">
              {PRINSIP.map((p) => (
                <div key={p.judul} className="rounded-2xl border border-[#E8E0D6] bg-[#FBF7F3] p-5">
                  <h3 className="font-semibold text-[#1F5932]">{p.judul}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4A5A51]">{p.teks}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Untuk siapa dan tentang proyek */}
        <section className="px-6 py-14">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#1F5932] p-7 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FFB8D6]">Dibuat untuk siapa</p>
              <h3 className="mt-2 text-xl font-bold">Pemegang uang belanja keluarga</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#E3EFE6]">
                Versi awal ini dirancang untuk ibu rumah tangga yang memegang uang belanja dengan jadwal pemasukan tetap,
                bulanan atau mingguan, di wilayah perkotaan. Kelompok lain menjadi pengembangan berikutnya.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E8E0D6] bg-white p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF4B93]">Tentang proyek</p>
              <h3 className="mt-2 text-xl font-bold text-[#1F5932]">Versi awal yang terus belajar</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4A5A51]">
                SAKUPUAN dikembangkan sebagai proyek akhir di BOOTCAMP PEREMPUAN INOVASI 2026, dengan tema
                Ketahanan Ekonomi dan Mata Pencaharian Perempuan. Saat ini produk masih berupa versi awal yang kami uji
                bersama pengguna, sehingga kami terbuka pada masukan.
              </p>
            </div>
          </div>
        </section>

        {/* Perlu diketahui */}
        <section className="bg-white px-6 py-14">
          <div className="mx-auto max-w-3xl">
            <Judul kecil="Transparansi" besar="Yang perlu kamu ketahui" />
            <ul className="space-y-3">
              {PERLU_DIKETAHUI.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-[#3B4A41]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF4B93]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tim */}
        <section className="px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF4B93]">TIM</p>
              <h2 className="mt-2 text-2xl font-bold text-[#1F5932] sm:text-3xl">Orang-orang dibalik SAKUPUAN</h2>
              <p className="mt-2 text-sm text-[#4A5A51]">Kelompok RA KARTINI</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 justify-center max-w-3xl mx-auto">
              {TIM.map((a) => (
               <div key={a.nama} className="rounded-2xl border border-[#E8E0D6] bg-white p-6 sm:p-7 text-center">
                <div className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-full bg-[#EAF3EC] text-3xl font-bold text-[#1F5932]">
                  {a.foto ? (
                    <img src={a.foto} alt={a.nama} className="h-full w-full object-cover object-top" />
                  ) : (
                    <span>{inisial(a.nama)}</span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-[#1F5932]">{a.nama}</h3>
                <p className="mt-1 text-xs font-semibold text-[#C71C63]">{a.lokasi}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Kontak */}
        <section className="bg-[#1F5932] px-6 py-14 text-center text-white">
          <h2 className="text-2xl font-bold">Punya masukan atau pertanyaan?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#E3EFE6]">
            Cerita dan saranmu membantu kami memperbaiki SAKUPUAN. Hubungi kami di rakartini.rasa@gmail.com.
          </p>
          <a
            href="mailto:rakartini.rasa@gmail.com"
            className="mt-6 inline-block rounded-xl bg-[#FF4B93] px-6 py-3 text-sm font-semibold text-white"
          >
            Kirim pesan
          </a>
        </section>
      </main>

      {/* Footer */}
      <LandingFooter setInfo={setInfo} />

      {/* Modal Informasi */}
      {info && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-[#1F5932]">
              {info.title}
            </h3>

            <p className="mt-4 text-sm leading-relaxed text-[#4A5A51]">
              {info.body}
            </p>

            <button
              onClick={() => setInfo(null)}
              className="mt-6 w-full rounded-xl bg-[#1F5932] px-5 py-3 text-sm font-semibold text-white hover:bg-[#174527]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
