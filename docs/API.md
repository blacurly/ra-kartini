# Dokumentasi API SAKUPUAN

## Cara memakai
- Alamat dasar: `https://[alamat-website-vercel]` (lokal: `http://localhost:3000`).
- Endpoint yang bertanda "Wajib login" membutuhkan header `Authorization: Bearer <token>` (token dari Supabase Auth).
- Format data: JSON. Kirim header `content-type: application/json` untuk permintaan yang memiliki body.

## Ringkasan
| Metode | Alamat | Login | Fungsi |
|---|---|---|---|
| GET | `/api/action-plans` | Publik atau diperiksa di tempat lain (cek manual) | Mengambil daftar action plan milik pengguna berdasarkan userId. |
| POST | `/api/action-plans` | Publik atau diperiksa di tempat lain (cek manual) | Menambahkan action plan baru untuk pengguna. |
| PUT | `/api/action-plans` | Publik atau diperiksa di tempat lain (cek manual) | Memperbarui status selesai atau belum pada action plan berdasarkan planId.s |
| POST | `/api/advisor/chat` | Wajib login | Mengirim pesan chat pengguna untuk mendapatkan balasan asisten finansial berbasis skor kesehatan keuangan dan AI dengan fallback aturan. |
| POST | `/api/auth/login` | Publik atau diperiksa di tempat lain (cek manual) | Memverifikasi email dan kata sandi pengguna lalu menetapkan session cookie login beserta status koneksi Telegram. |
| POST | `/api/auth/logout` | Publik atau diperiksa di tempat lain (cek manual) | Menghapus session cookie untuk mengakhiri sesi login pengguna. |
| GET | `/api/auth/me` | Opsional | Mengambil data profil pengguna yang sedang login dari sesi aktif atau mengembalikan null jika belum masuk. |
| POST | `/api/auth/register` | Publik atau diperiksa di tempat lain (cek manual) | Mendaftarkan akun pengguna baru dan langsung menetapkan session cookie login. |
| GET | `/api/budgets` | Wajib login | Mengambil daftar anggaran belanja milik pengguna yang sedang login. |
| POST | `/api/budgets` | Wajib login | Membuat dan menyimpan anggaran belanja baru beserta rentang periode aktifnya. |
| GET | `/api/forecast/prices` | Publik atau diperiksa di tempat lain (cek manual) | Mengambil data tren historis dan prediksi harga komoditas pangan berdasarkan pilihan komoditas dan kota. |
| GET | `/api/health` | Publik atau diperiksa di tempat lain (cek manual) | Memeriksa status ketersediaan (uptime) layanan API beserta waktu server terkini. |
| GET | `/api/profile` | Wajib login | Mengambil data profil pengguna yang sedang login. |
| PATCH | `/api/profile` | Wajib login | Memperbarui nama, email, dan nomor telepon profil pengguna yang sedang login. |
| POST | `/api/scoring` | Publik atau diperiksa di tempat lain (cek manual) | Menghitung skor kesehatan keuangan periode berdasarkan data input dan menyimpannya ke database jika userId tersedia. |
| POST | `/api/telegram/link` | Wajib login | Membuat token sementara dan tautan deeplink Telegram untuk menghubungkan akun pengguna dengan bot. |
| GET | `/api/telegram/status` | Wajib login | Memeriksa status koneksi akun Telegram beserta username pengguna yang sedang login. |
| GET | `/api/transactions` | Wajib login | Mengambil daftar transaksi aktif milik pengguna yang dapat difilter berdasarkan periode dan akun. |
| POST | `/api/transactions` | Publik atau diperiksa di tempat lain (cek manual) | Menambahkan catatan transaksi pemasukan atau pengeluaran baru secara manual melalui Telegram |

## Rincian

### GET /api/action-plans
- **Berkas kode:** `app/api/action-plans/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ success: false, message: "Unauthorized" }, { status: 401 }`
- **Contoh respons sebenarnya:** {
    "success": true,
    "data": {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "action_text": "Evaluasi dan Kelola Pengeluaran Rutin",
        "is_completed": false,
        "completed_at": null,
        "created_at": "2026-11-21T03:59:03.313+00:00",
        "updated_at": "2026-11-21T03:59:03.313+00:00"
    }
}
- **Kemungkinan error:** 500 kesalahan server

### POST /api/action-plans
- **Berkas kode:** `app/api/action-plans/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ success: false, message: "Data tidak lengkap" }, { status: 400 }`
- **Contoh respons sebenarnya:** {
    "success": true,
    "data": [
        {
            "id": "txn_contoh_001",
            "user_id": "usr_contoh_001",
            "action_text": "Evaluasi dan Kelola Pengeluaran Rutin",
            "is_completed": false,
            "completed_at": null,
            "created_at": "2026-11-21T03:14:52.886+00:00",
            "updated_at": "2026-11-21T03:14:52.888+00:00"
        },
    ]
}
- **Kemungkinan error:** 500 kesalahan server

### PUT /api/action-plans
- **Berkas kode:** `app/api/action-plans/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ success: false, message: "ID plan tidak ditemukan" }, { status: 400 }`
- **Contoh respons sebenarnya:** {
    "success": true,
    "data": {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "action_text": "Evaluasi dan Kelola Pengeluaran Rutin",
        "is_completed": true,
        "completed_at": "2026-11-21T04:04:20.674+00:00",
        "created_at": "2026-11-21T03:59:03.313+00:00",
        "updated_at": "2026-11-21T04:04:21.606259+00:00"
    }
}
- **Kemungkinan error:** 500 kesalahan server

### POST /api/advisor/chat
- **Berkas kode:** `app/api/advisor/chat/route.js`
- **Login:** Wajib login
- **Batas pemakaian:** 20 permintaan per 60 detik
- **Data yang dikirim (body):**

| Kolom | Tipe | Wajib | Batas |
|---|---|---|---|
| message | string | ya | min 1, maks 500 |
| city | string | tidak | maks 60 |

- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ reply: dataAi.reply, suggestion: dataAi.suggestion || undefined, incomeIdea: selectedIdea, source: "ai", }`
- **Contoh respons sebenarnya:** {
    "reply": "Halo 'nama_user' di 'city'. Dengan skor keuangan 'angka', kondisi keuanganmu sudah cukup baik, tetapi masih perlu dijaga agar tetap stabil. Untuk menjawab pertanyaanmu, batas aman total cicilan utang setiap bulan adalah maksimal 30 persen dari total pendapatan bulananmu. Hal ini penting agar kamu tetap memiliki cukup dana untuk kebutuhan sehari-hari dan dana darurat.",
    "suggestion": {
        "title": "Batasi Total Cicilan Maksimal 30 Persen Pendapatan",
        "desc": "Pastikan seluruh cicilan utangmu tidak melebihi 30 persen dari pemasukan bulanan agar keuangan tetap sehat dan terhindar dari risiko gagal bayar.",
        "cat": "Cicilan & utang"
    },
    "incomeIdea": null,
    "source": "ai"
}
- **Kemungkinan error:** 401 belum login, 400 data tidak valid, 429 terlalu banyak permintaan, 500 kesalahan server

### POST /api/auth/login
- **Berkas kode:** `app/api/auth/login/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Catatan dari kode:** POST /api/auth/login  {email, password} -> {user} + session cookie
- **Data yang dikirim (body):**

| Kolom | Tipe | Wajib | Batas |
|---|---|---|---|
| email | string | ya | - |
| password | string | ya | - |

- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ user: publicUser(user), telegramConnected: telegram.connected }, { headers: { "Set-Cookie": sessionCookie(user.id) } }`
- **Contoh respons sebenarnya:** {
  "user": {
    "id": "usr_contoh_001",
    "email": "uji@example.com",
    "name": "Puan Uji"
  },
  "telegramConnected": true
}
- **Kemungkinan error:** 400 data tidak valid, 429 terlalu banyak permintaan, 500 kesalahan server

### POST /api/auth/logout
- **Berkas kode:** `app/api/auth/logout/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Catatan dari kode:** POST /api/auth/logout -> clears the session cookie
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } }`
- **Contoh respons sebenarnya:** {
  "ok": true
}
- **Kemungkinan error:** 500 kesalahan server

### GET /api/auth/me
- **Berkas kode:** `app/api/auth/me/route.js`
- **Login:** Opsional
- **Catatan dari kode:** GET /api/auth/me -> {user} or {user:null}. Never 401: the client uses it to bootstrap.
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ user: user ? publicUser(user) : null }`
- **Contoh respons sebenarnya:** saat sudah login:
{
  "user": {
    "id": "usr_contoh_001",
    "email": "uji@example.com",
    "name": "Puan Uji"
  }
}

saat belum login:

- **Kemungkinan error:** 500 kesalahan server
{
  "user": null
}

### POST /api/auth/register
- **Berkas kode:** `app/api/auth/register/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Catatan dari kode:** POST /api/auth/register  {name, email, password} -> 201 {user} + session cookie
- **Data yang dikirim (body):**

| Kolom | Tipe | Wajib | Batas |
|---|---|---|---|
| name | string | ya | maks 80 |
| email | string | ya | maks 160 |
| password | string | ya | maks 200 |

- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ user: publicUser(user) }, { status: 201, headers: { "Set-Cookie": sessionCookie(user.id) } }`
- **Contoh respons sebenarnya:** {
  "user": {
    "id": "usr_contoh_002",
    "email": "pendaftar.uji@example.com",
    "name": "Puan Pendaftar"
  }
}
- **Kemungkinan error:** 400 data tidak valid, 429 terlalu banyak permintaan, 500 kesalahan server

### GET /api/budgets
- **Berkas kode:** `app/api/budgets/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** GET /api/budgets -> ambil daftar anggaran milik user yang login
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ budgets: data || [] }`
- **Contoh respons sebenarnya:** [
    {
        "id": "bdg_contoh_001",
        "name": "Anggaran Belanja",
        "amount": 3500000,
        "period_start": "2026-11-21",
        "period_end": "2026-11-27",
        "status": "active",
        "created_at": "2026-11-14T14:23:32.643232+00:00"
    }
]
- **Kemungkinan error:** 401 belum login, 500 kesalahan server

### POST /api/budgets
- **Berkas kode:** `app/api/budgets/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** POST /api/budgets -> simpan anggaran baru beserta rentang tanggalnya
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ budget: data }, { status: 201 }`
- **Contoh respons sebenarnya:** {
  "budget": {
    "id": "bdg_contoh_001",
    "user_id": "usr_contoh_001",
    "name": "Anggaran Belanja",
    "amount": 3500000,  14:23:32.643232+00:00
    "period_start": "2026-11-21",
    "period_end": "2026-11-27",
    "status": "active",
    "created_at": "2026-11-14T14:23:35.643232+00:00"
  }
}
- **Kemungkinan error:** 401 belum login, 400 data tidak valid, 500 kesalahan server

### GET /api/forecast/prices
- **Berkas kode:** `app/api/forecast/prices/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Catatan dari kode:** GET /api/forecast/prices?commodity=cabai&city=Semarang
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ error: 'Gagal mengambil data harga' }, { status: 500 }`
- **Contoh respons sebenarnya:** {
  "commodities": [
    {
      "id": "cabai",
      "name": "Cabai Rawit",
      "datasetName": "Cabai Rawit Merah"
    }
  ],
  "series": {
    "commodity": "cabai",
    "unit": "Rp/kg",
    "points": [
      {
        "date": "2026-10",
        "price": 42000,
        "type": "actual"
      },
      {
        "date": "2026-11",
        "price": 45500,
        "type": "forecast"
      }
    ]
  },
  "city": "Semarang"
}
- **Kemungkinan error:** 500 kesalahan server

### GET /api/health
- **Berkas kode:** `app/api/health/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Catatan dari kode:** GET /api/health - uptime check
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ ok: true, time: new Date().toISOString() }`
- **Contoh respons sebenarnya:** {
  "ok": true,
  "time": "2026-11-21T06:01:00.000Z"
}
- **Kemungkinan error:** 500 kesalahan server

### GET /api/profile
- **Berkas kode:** `app/api/profile/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** GET /api/profile -> {user}
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ user: publicUser(await requireUser(request)) }`
- **Contoh respons sebenarnya:** {
  "user": {
    "id": "usr_contoh_001",
    "name": "Puan Uji",
    "email": "uji@example.com",
    "phone": "081200000000"
  }
}
- **Kemungkinan error:** 401 belum login, 500 kesalahan server

### PATCH /api/profile
- **Berkas kode:** `app/api/profile/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** PATCH /api/profile {name, email, phone} -> {user}
- **Data yang dikirim (body):**

| Kolom | Tipe | Wajib | Batas |
|---|---|---|---|
| name | string | ya | maks 80 |
| email | string | ya | - |

- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ user: publicUser(updated) }`
- **Contoh respons sebenarnya:** {
  "user": {
    "id": "usr_contoh_001",
    "name": "Puan Uji",
    "email": "uji@example.com",
    "phone": "081200000000"
  }
}
- **Kemungkinan error:** 401 belum login, 400 data tidak valid, 500 kesalahan server

### POST /api/scoring
- **Berkas kode:** `app/api/scoring/route.js`
- **Login:** Publik atau diperiksa di tempat lain (cek manual)
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ success: true, data: hasilSkor }, { status: 200 }`
- **Contoh respons sebenarnya:** {
  "success": true,
  "data": {
    "totalScore": 78,
    "spend": 80,
    "save": 75,
    "borrow": 80,
    "plan": 77
  }
}
- **Kemungkinan error:** 500 kesalahan server

### POST /api/telegram/link
- **Berkas kode:** `app/api/telegram/link/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** POST /api/telegram/link -> {deeplink, token, expiresInMinutes}
- **Data yang dikirim:** [isi]
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ token, deeplink: 'https://t.me/${env.telegramBotUsername}?start=${token}', expiresInMinutes: 15, }`
- **Contoh respons sebenarnya:** {
  "token": "tkn_contoh_123456",
  "deeplink": "https://t.me/NamaBotContoh?start=tkn_contoh_123456",
  "expiresInMinutes": 15
}
- **Kemungkinan error:** 401 belum login, 500 kesalahan server

### GET /api/telegram/status
- **Berkas kode:** `app/api/telegram/status/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** GET /api/telegram/status -> {connected, username}   (the connect page polls this)
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `await db.getTelegramStatus(user.id)`
- **Contoh respons sebenarnya:** Saat sudah terhubung:
{
  "connected": true,
  "username": "puan_contoh"
}

Saat belum terhubung:
{
  "connected": false,
  "username": null
}
- **Kemungkinan error:** 401 belum login, 500 kesalahan server

### GET /api/transactions
- **Berkas kode:** `app/api/transactions/route.js`
- **Login:** Wajib login
- **Data yang dikirim:** tidak ada (cek parameter alamat atau query bila ada)
- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ periods: buildPeriods(all.map((t) => t.period)), accounts: DEFAULT_ACCOUNTS, transactions, }`
- **Contoh respons sebenarnya:** [
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Belanja Pangan",
        "type": "expense",
        "amount": 6000,
        "title": "Jagung",
        "created_at": "2026-11-12T15:07:58.569822+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Jagung",
        "source": "telegram",
        "transaction_date": "2026-11-12",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Jajan & Makan di Luar",
        "type": "expense",
        "amount": 5000,
        "title": "Roti",
        "created_at": "2026-11-12T15:08:17.924514+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Roti",
        "source": "telegram",
        "transaction_date": "2026-11-12",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Pemasukan Utama",
        "type": "income",
        "amount": 8000000,
        "title": "Gaji",
        "created_at": "2026-11-13T07:12:37.106662+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Gaji",
        "source": "telegram",
        "transaction_date": "2026-11-13",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Tagihan & Rutin",
        "type": "expense",
        "amount": 1000000,
        "title": "Cicilan",
        "created_at": "2026-11-13T07:20:16.13422+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Cicilan",
        "source": "telegram",
        "transaction_date": "2026-11-13",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "pinjaman",
        "type": "income",
        "amount": 2000000,
        "title": "pinjam",
        "created_at": "2026-11-13T10:44:28.519795+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "pinjam",
        "source": "telegram",
        "transaction_date": "2026-11-13",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Belanja Pangan",
        "type": "expense",
        "amount": 10000,
        "title": "Beras 1kg",
        "created_at": "2026-11-13T10:44:38.080374+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Beras 1kg",
        "source": "telegram",
        "transaction_date": "2026-11-13",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Tabungan",
        "type": "expense",
        "amount": 200000,
        "title": "Nabung",
        "created_at": "2026-11-13T10:45:40.026425+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Nabung",
        "source": "telegram",
        "transaction_date": "2026-11-13",
        "telegram_update_id": 987654321
    },
    {
        "id": "txn_contoh_001",
        "user_id": "usr_contoh_001",
        "category": "Pemasukan Lain",
        "type": "income",
        "amount": 1500000,
        "title": "Jual AC",
        "created_at": "2026-11-18T04:04:40.280287+00:00",
        "budget_id": null,
        "status": "confirmed",
        "is_deleted": false,
        "deleted_at": null,
        "item": "Jual AC",
        "source": "telegram",
        "transaction_date": "2026-11-18",
        "telegram_update_id": 987654321
    }
]
- **Kemungkinan error:** 401 belum login, 500 kesalahan server

### POST /api/transactions
- **Berkas kode:** `app/api/transactions/route.js`
- **Login:** Wajib login
- **Catatan dari kode:** POST /api/transactions {flow, cat, title, amount, account?} -> 201 {transaction}
- **Data yang dikirim (body):**

| Kolom | Tipe | Wajib | Batas |
|---|---|---|---|
| flow | salah satu: ["in", "out"] | ya | - |
| cat | string | ya | - |
| title | string | ya | min 1, maks 120 |
| amount | number | ya | - |

- **Bentuk respons (diambil dari kode, perlu dirapikan):** `{ transaction: mapRowToTransaction(data) }, { status: 201 }`
- **Contoh respons sebenarnya:** {
  "transaction": {
    "id": "txn_contoh_001",
    "userId": "usr_contoh_001",
    "flow": "out",
    "type": "expense",
    "cat": "belanja",
    "category": "belanja",
    "title": "Tes dokumentasi",
    "item": "Tes dokumentasi",
    "amount": 15000,
    "account": "tabungan",
    "period": "2026-11",
    "date": "21 Nov 2026",
    "transaction_date": "2026-11-21T04:50:00.000Z",
    "created_at": "2026-11-21T04:50:00.000Z",
    "source": "manual",
    "status": "confirmed"
  }
}
- **Kemungkinan error:** 401 belum login, 400 data tidak valid, 500 kesalahan server

## Webhook bot Telegram
Fungsi Supabase `telegram-bot` menerima POST dari Telegram dan menolak permintaan tanpa header `x-telegram-bot-api-secret-token` yang cocok. Perintah yang didukung mencakup /start <token> untuk menautkan akun chat ke akun aplikasi, pencatatan pemasukan/pengeluaran, serta pengecekan ringkasan keuangan atau status akun.
