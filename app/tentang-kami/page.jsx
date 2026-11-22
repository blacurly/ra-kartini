// app/(landing)/tentang-kami/page.jsx

import TentangKamiContent from "@/app/components/tentang-kami/TentangKamiContent"; 

export const metadata = {
  title: "Tentang Kami | SAKUPUAN",
  description:
    "SAKUPUAN membantu ibu rumah tangga mengetahui lebih awal apakah uang belanja pangan cukup sampai pemasukan berikutnya.",
};

export default function TentangKamiPage() {
  return <TentangKamiContent />;
}