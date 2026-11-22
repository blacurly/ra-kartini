import { supabase } from "@/lib/supabase"; // Menggunakan file supabase.js yang ada di folder lib Anda

export async function registerNewUser(cleanData) {
  try {
    // 1. Daftarkan akun ke sistem Auth Supabase (Email & Password)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanData.email,
      password: cleanData.password,
      options: {
        data: {
          name: cleanData.nama,
        }
      }
    });

    if (authError) throw authError;

    // AMBIL ID USER DARI AUTH DI SINI AGAR TIDAK UNDEFINED
    const userId = authData.user.id;

    // 2. Masukkan data tambahan langsung ke tabel 'users'
    const { error: profileError } = await supabase
      .from('users')
      .upsert([
        { 
          id: authData.user.id,
          email: cleanData.email,
          nama: cleanData.nama,
          kota_tinggal: cleanData.domisili,
          anggaran_belanja: cleanData.anggaran
        }
      ], { onConflict: 'id' });

    if (profileError) throw profileError;

    // 3. OTOMATISASI PERIODE & MASUKKAN KE TABEL 'budgets'
    if (cleanData.anggaran && Number(cleanData.anggaran) > 0) {
      const dateObj = new Date();
      const tahun = dateObj.getFullYear();
      const bulan = String(dateObj.getMonth() + 1).padStart(2, '0');
      
      // Tentukan periode otomatis: dari tanggal 1 sampai hari terakhir bulan ini
      const period_start = `${tahun}-${bulan}-01`;
      const lastDay = new Date(tahun, dateObj.getMonth() + 1, 0).getDate();
      const period_end = `${tahun}-${bulan}-${lastDay}`;

      const { error: budgetError } = await supabase
        .from('budgets')
        .insert([
          {
            user_id: userId,
            name: "Anggaran Belanja Pangan", // Menambahkan kolom 'name' untuk mengatasi not-null constraint
            amount: cleanData.anggaran,
            period_start: period_start,
            period_end: period_end,
          }
        ]);

      if (budgetError) {
        console.error("Gagal menyinkronkan anggaran ke tabel budgets:", JSON.stringify(budgetError, null, 2));
        // Tidak perlu melempar error agar proses registrasi utama tetap sukses
      }
    }

    return { success: true, user: authData.user };
  } catch (error) {
    console.error("Gagal mendaftarkan akun ke Supabase:", error);
    return { success: false, error: error.message };
  }
}

export async function loginUser(email, password) {
  try {
    // Meminta Supabase untuk mencocokkan email dan password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      throw error;
    }

    return { 
      success: true, 
      user: data.user,
      telegramConnected: data.telegramConnected,
     };
  } catch (error) {
    console.error("Gagal login ke Supabase:", error.message);
    // Menerjemahkan pesan error bahasa Inggris bawaan Supabase agar lebih ramah
    let pesanError = error.message;
    if (pesanError.includes("Invalid login credentials")) {
      pesanError = "Email atau password yang Anda masukkan salah.";
    }
    return { success: false, error: pesanError };
  }
}