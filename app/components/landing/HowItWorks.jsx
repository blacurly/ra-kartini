'use client';

import { Container, SectionHead } from './primitives';

export default function HowItWorks({  }) {
  return (
    <section id="cara-kerja" className="scroll-mt-20 py-14 sm:py-16 lg:py-24">
      <Container>
        <SectionHead eyebrow="Alur Penggunaan" title="Mulai dari Catatan, Sampai Menjadi Insight." desc="Empat langkah sederhana untuk pencatatan keuangan yang lebih bijak dan berkonteks."/>
        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
        [
            "Catat Transaksi",
            "Masukkan pemasukan dan pengeluaran melalui alur pencatatan SAKUPUAN.",
        ],
        [
            "Pantau Pengeluaran",
            "Lihat ringkasan dan perubahan pengeluaran belanja dari waktu ke waktu.",
        ],
        [
            "Bandingkan Tren Harga Pangan",
            "SAKUPUAN membandingkan data pengeluaran yang relevan dengan data harga pangan berdasarkan wilayah dan periode.",
        ],
        [
            "Pahami Insight",
            "Gunakan insight sebagai bahan pertimbangan untuk merencanakan anggaran belanja.",
        ],
    ].map(([t, d], i) => {
        const last = false;
        return (<div key={t} className={`bg-white p-6 rounded-2xl border shadow-card flex flex-col justify-between ${last ? "border-sakuPink-border" : "border-sakuGreen-light"}`}>
                <div>
                  <div className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center mb-4 ${last ? "bg-sakuPink" : "bg-sakuGreen"}`}>
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-base mb-2">{t}</h3>
                  <p className="text-sm sm:text-xs text-sakuText-muted leading-relaxed">
                    {d}
                  </p>
                </div>
              </div> 
              );
          })}
        </div>
      </Container>
    </section>
  );
}
