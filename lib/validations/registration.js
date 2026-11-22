export function validateRegistration(data) {
  const errors = {};

  // 1. Validasi Nama
  if (!data.nama || data.nama.trim() === "") {
    errors.nama = "Nama tidak boleh kosong.";
  }

  // 2. Validasi Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = "Format email tidak valid.";
  }

  // 3. Validasi Password
  if (!data.password || data.password.length < 6) {
    errors.password = "Password minimal 6 karakter.";
  }

  // 4. Validasi Domisili
  if (!data.domisili || data.domisili.trim() === "") {
    errors.domisili = "Domisili harus diisi.";
  }

  // 5. Validasi Anggaran Belanja (Memastikan input berupa angka valid)
  const anggaran = Number(data.anggaran);
  if (!data.anggaran || isNaN(anggaran) || anggaran <= 0) {
    errors.anggaran = "Anggaran belanja harus berupa angka lebih dari 0.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    // Mengembalikan data yang sudah dibersihkan dari spasi berlebih
    cleanData: {
      nama: data.nama?.trim(),
      email: data.email?.trim(),
      password: data.password,
      domisili: data.domisili?.trim(),
      anggaran: anggaran
    }
  };
}