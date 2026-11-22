"use client";

import { useState } from "react";
import { validateRegistration } from "@/lib/validations/registration";
import { useRouter } from "next/navigation";
import { registerNewUser } from "@/lib/services/authService";

// Daftar 8 kota besar sesuai permintaan
const CITIES = [
  "Jakarta", "Semarang", "Palu",
];

export default function RegistrationPopup({ onClose }) {
  // 1. PINDAHKAN useRouter KE SINI (Di dalam fungsi komponen)
  const router = useRouter(); 

  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "",
    domisili: "",
    anggaran: "",
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Hapus error saat user mulai mengetik lagi
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Panggil Validation Layer yang sudah kita buat
    const validation = validateRegistration(formData);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // 2. Panggil Service Layer
    const result = await registerNewUser(validation.cleanData);

    if (result.success) {
      // Jika berhasil, tutup pop-up dan arahkan ke halaman Telegram
      onClose();
      router.push("/telegram"); 
    } else {
      // Tangani error dari server (misal email sudah terdaftar)
      setErrors({ ...errors, server: result.error });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden fade-up">
        
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-sakuText">Daftar Akun Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sakuText">
          
          {/* Input Nama */}
          <div>
            <label className="block text-sm font-semibold mb-1">Nama Panggilan</label>
            <input type="text" name="nama" value={formData.nama} onChange={handleChange} 
              className={`w-full px-4 py-2 rounded-xl border ${errors.nama ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-sakuGreen-light`}
              placeholder="Cth: Puan"
            />
            {errors.nama && <p className="text-xs text-red-500 mt-1">{errors.nama}</p>}
          </div>

          {/* Input Email */}
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} 
              className={`w-full px-4 py-2 rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-sakuGreen-light`}
              placeholder="puan@email.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Input Password dengan Toggle Mata */}
          <div>
            <label className="block text-sm font-semibold mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                className={`w-full px-4 py-2 pr-10 rounded-xl border ${errors.password ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-sakuGreen-light`}
                placeholder="Minimal 6 karakter"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  // Ikon Mata Dicoret (Hide)
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  // Ikon Mata Terbuka (Show)
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* Dropdown Domisili (8 Kota) */}
          <div>
            <label className="block text-sm font-semibold mb-1">Domisili</label>
            <select name="domisili" value={formData.domisili} onChange={handleChange}
              className={`w-full px-4 py-2 rounded-xl border bg-white ${errors.domisili ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-sakuGreen-light`}
            >
              <option value="" disabled>Pilih Kota Anda</option>
              {CITIES.map(kota => (
                <option key={kota} value={kota}>{kota}</option>
              ))}
            </select>
            {errors.domisili && <p className="text-xs text-red-500 mt-1">{errors.domisili}</p>}
          </div>

          {/* Input Anggaran */}
          <div>
            <label className="block text-sm font-semibold mb-1">Anggaran Belanja</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
              <input type="number" name="anggaran" value={formData.anggaran} onChange={handleChange} 
                className={`w-full pl-10 pr-4 py-2 rounded-xl border ${errors.anggaran ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-sakuGreen-light`}
                placeholder="0"
              />
            </div>
            {errors.anggaran && <p className="text-xs text-red-500 mt-1">{errors.anggaran}</p>}
          </div>

          {/* Penampil Error dari Server */}
          {errors.server && (
            <div className="p-3 bg-red-50 text-red-500 text-sm rounded-xl border border-red-200">
              {errors.server}
            </div>
          )}

          {/* 2. HAPUS TOMBOL YANG GANDA. Cukup satu tombol Submit di sini */}
          <div className="pt-4">
            <button type="submit" className="w-full bg-sakuPink text-white font-bold py-3 rounded-xl hover:bg-pink-500 transition-colors shadow-sm">
              Mulai Gunakan SAKUPUAN
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}