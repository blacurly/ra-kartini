// index.ts: fungsi bot Telegram SakuPuan (Supabase Edge Function).
//
// Alur: Telegram -> fungsi ini -> database Supabase -> website membaca database yang sama.
// Rahasia yang dibutuhkan (diatur lewat `supabase secrets set`, JANGAN ditulis di kode):
//   TELEGRAM_BOT_TOKEN       token dari @BotFather
//   TELEGRAM_WEBHOOK_SECRET  kata sandi buatan sendiri (huruf, angka, _ dan - saja)
// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY biasanya sudah tersedia otomatis di Edge Function.
//
// Asumsi yang perlu dicek:
//   1. transactions.user_id dan budgets.user_id berisi id dari auth.users (sama dengan bot_users.auth_user_id).
//   2. type = 'expense' atau 'income', status = 'confirmed' (samakan juga di kode website).

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type Jenis, daftarKategori, geserHari, hariIniJakarta, kategoriAwal, labelTanggal, olahPesan, rupiah, selisihHari,
  KATEGORI_PENGELUARAN,
} from "./parser.ts";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// ---------- Telegram ----------
type Tombol = { text: string; callback_data: string };

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("Telegram menolak:", method, res.status); // token tidak pernah dicatat
  return res;
}
const kirim = (chatId: string, text: string, papan?: Tombol[][]) =>
  tg("sendMessage", { chat_id: chatId, text, ...(papan ? { reply_markup: { inline_keyboard: papan } } : {}) });
const ubah = (chatId: string, messageId: number, text: string, papan: Tombol[][] = []) =>
  tg("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: papan } });

const BANTUAN = `Cara memakai SAKUPUAN Bot:

Catat pengeluaran, cukup kirim pesan biasa:
  sayur 35000
  telur 28rb
  pulsa 50k

Catat pemasukan (awali dengan tanda +):
  +500rb
  uang belanja 2jt

Perintah:
/sisa - cek sisa uang belanja
/hari - total pengeluaran hari ini dan 7 hari terakhir
/kategori - lihat daftar kategori
/batal - batalkan catatan terakhir dari Telegram
/bantuan - tampilkan pesan ini

Obrolan di Telegram tidak seaman chat rahasia, jadi jangan kirim data pribadi.`;

// ---------- Pintu masuk ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!WEBHOOK_SECRET || req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  try {
    if (!(await tandaiUpdate(update.update_id))) return new Response("ok"); // sudah pernah diproses
    if (update.message) await tanganiPesan(update.message);
    else if (update.callback_query) await tanganiTombol(update.callback_query, update.update_id);
  } catch (e) {
    console.error("Gagal memproses update:", e instanceof Error ? e.message : String(e));
  }
  return new Response("ok"); // selalu 200 agar Telegram tidak mengirim ulang terus
});

// Telegram bisa mengirim pesan yang sama dua kali; kita catat nomornya agar tidak diproses ganda.
async function tandaiUpdate(updateId: number): Promise<boolean> {
  const { error } = await supabase.from("telegram_processed_updates").insert({ update_id: updateId });
  if (error?.code === "23505") return false;
  if (error) console.error("Gagal mencatat update_id:", error.message);
  return true;
}

async function cariPengguna(chatId: string): Promise<string | null> {
  const { data } = await supabase.from("bot_users").select("auth_user_id").eq("telegram_chat_id", chatId).maybeSingle();
  return data?.auth_user_id ?? null;
}

// ---------- Pesan masuk ----------
async function tanganiPesan(msg: any) {
  if (msg.chat?.type !== "private") return; // hanya obrolan pribadi
  const chatId = String(msg.chat.id);
  const teks: string = (msg.text ?? "").trim();
  if (!teks) { await kirim(chatId, "Maaf, aku hanya bisa membaca pesan teks."); return; }
  if (teks.length > 300) { await kirim(chatId, "Pesannya terlalu panjang. Coba singkat, contoh: sayur 35000"); return; }

  const cmd = /^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(teks);
  const perintah = cmd?.[1]?.toLowerCase();
  const isi = (cmd?.[2] ?? "").trim();

  if (perintah === "start") return tanganiStart(msg, chatId, isi);
  if (perintah === "bantuan" || perintah === "help") { await kirim(chatId, BANTUAN); return; }
  if (perintah === "kategori") {
    await kirim(chatId, "Kategori pengeluaran:\n- " + daftarKategori("expense").join("\n- ") +
      "\n\nKategori pemasukan:\n- " + daftarKategori("income").join("\n- "));
    return;
  }

  const userId = await cariPengguna(chatId);
  if (!userId) {
    await kirim(chatId, "Akunmu belum terhubung. Buka website SAKUPUAN, lalu pilih Sambungkan Telegram.");
    return;
  }

  if (perintah === "sisa") return tanganiSisa(chatId, userId);
  if (perintah === "hari" || perintah === "hariini") return tanganiHari(chatId, userId);
  if (perintah === "batal") return tanganiBatal(chatId, userId);
  if (perintah === "catat") return buatDraf(chatId, userId, isi, "expense");
  if (perintah === "pemasukan") return buatDraf(chatId, userId, isi, "income");
  if (perintah) { await kirim(chatId, BANTUAN); return; }
  return buatDraf(chatId, userId, teks); // pesan biasa: jenis ditebak otomatis
}

async function tanganiStart(msg: any, chatId: string, kode: string) {
  if (!kode) {
    const sudah = await cariPengguna(chatId);
    await kirim(chatId, sudah
      ? "Akunmu sudah terhubung. Kirim pengeluaran seperti: sayur 35000"
      : "Halo! Aku bot SAKUPUAN. Untuk menghubungkan akun, buka website SAKUPUAN lalu pilih Sambungkan Telegram.");
    return;
  }
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(kode)) { await kirim(chatId, "Kode tidak valid. Buat kode baru dari website."); return; }

  // Kode hanya bisa dipakai sekali: pemakaian dan pengecekan dilakukan dalam satu perintah.
  const { data: klaim } = await supabase.from("telegram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", kode).is("used_at", null).gt("expires_at", new Date().toISOString())
    .select("auth_user_id").maybeSingle();
  if (!klaim) { await kirim(chatId, "Kode tidak valid atau sudah kedaluwarsa. Buat kode baru dari website."); return; }

  const { error } = await supabase.from("bot_users").upsert({
    auth_user_id: klaim.auth_user_id,
    telegram_id: String(msg.from?.id ?? chatId),
    telegram_chat_id: chatId,
    telegram_username: msg.from?.username ?? null,
    linked_at: new Date().toISOString(),
  }, { onConflict: "auth_user_id" });
  if (error) {
    await kirim(chatId, error.code === "23505"
      ? "Akun Telegram ini sudah terhubung ke akun SAKUPUAN lain. Putuskan dulu dari website, lalu buat kode baru."
      : "Maaf, penyambungan gagal. Coba buat kode baru dari website.");
    console.error("Gagal menyambungkan:", error.message);
    return;
  }
  await kirim(chatId, "Terhubung! Sekarang kirim pengeluaran, contoh: sayur 35000\nKetik /bantuan untuk melihat semua perintah.");
}

// ---------- Draf dan konfirmasi ----------
async function buatDraf(chatId: string, userId: string, teks: string, jenisPaksa?: Jenis) {
  if (!teks) { await kirim(chatId, "Kirim pengeluaranmu, contoh: sayur 35000 atau pulsa 50rb"); return; }
  const h = olahPesan(teks, jenisPaksa);
  if (h.nominal === null) {
    await kirim(chatId, "Aku belum menemukan nominalnya. Coba tulis seperti: sayur 35000, telur 28rb, atau uang belanja 2jt.");
    return;
  }
  await supabase.from("telegram_pending_entries").delete().lt("expires_at", new Date().toISOString());
  const { data, error } = await supabase.from("telegram_pending_entries").insert({
    telegram_chat_id: chatId, auth_user_id: userId, type: h.jenis, title: h.judul, amount: h.nominal, category: h.kategori,
  }).select("*").single();
  if (error || !data) { console.error("Gagal membuat draf:", error?.message); await kirim(chatId, "Maaf, ada gangguan. Coba lagi sebentar."); return; }
  if (!h.jenisPasti) {
    // Bot belum yakin: tanya dulu sebelum menebak kategori.
    await kirim(chatId, `Aku belum yakin ini pemasukan atau pengeluaran.\n\n${rupiah(h.nominal)} - ${h.judul}\n\nIni termasuk apa?`, [
      [{ text: "Pengeluaran", callback_data: `jns:${data.id}:expense` }, { text: "Pemasukan", callback_data: `jns:${data.id}:income` }],
      [{ text: "Batal", callback_data: `no:${data.id}` }],
    ]);
    return;
  }
  await tampilkanDraf(chatId, null, data);
}

function teksDraf(d: any): string {
  const jenis = d.type === "income" ? "Pemasukan" : "Pengeluaran";
  return `Catat ${jenis.toLowerCase()} ini?\n\n${jenis}: ${rupiah(Number(d.amount))}\nCatatan: ${d.title}\nKategori: ${d.category ?? "-"}`;
}

function papanKategori(d: any): Tombol[][] {
  const daftar = daftarKategori(d.type as Jenis);
  const baris: Tombol[][] = [];
  for (let i = 0; i < daftar.length; i += 2) {
    baris.push(daftar.slice(i, i + 2).map((nama, j) => ({ text: nama, callback_data: `cat:${d.id}:${i + j}` })));
  }
  baris.push([{ text: "Batal", callback_data: `no:${d.id}` }]);
  return baris;
}

async function tampilkanDraf(chatId: string, messageId: number | null, d: any) {
  const tanyaKategori = !d.category;
  const teks = tanyaKategori ? `${teksDraf(d)}\n\nMasuk kategori apa?` : teksDraf(d);
  const papan = tanyaKategori ? papanKategori(d) : [
    [{ text: "Ya, simpan", callback_data: `ok:${d.id}` }, { text: "Ubah kategori", callback_data: `chg:${d.id}` }],
    [{ text: d.type === "income" ? "Ganti jadi pengeluaran" : "Ganti jadi pemasukan", callback_data: `swp:${d.id}` }, { text: "Batal", callback_data: `no:${d.id}` }],
  ];
  if (messageId) await ubah(chatId, messageId, teks, papan); else await kirim(chatId, teks, papan);
}

// ---------- Tombol ----------
async function tanganiTombol(cb: any, updateId: number) {
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const chatId = String(cb.message?.chat?.id ?? "");
  const messageId: number = cb.message?.message_id;
  if (!chatId || !messageId) return;
  const [aksi, id, urutan] = String(cb.data ?? "").split(":");

  const { data: d } = await supabase.from("telegram_pending_entries").select("*").eq("id", id).eq("telegram_chat_id", chatId).maybeSingle();
  if (!d || new Date(d.expires_at) < new Date()) {
    await ubah(chatId, messageId, "Catatan ini sudah kedaluwarsa atau sudah diproses. Kirim ulang catatanmu ya.");
    return;
  }

  if (aksi === "no") {
    await supabase.from("telegram_pending_entries").delete().eq("id", id);
    await ubah(chatId, messageId, "Dibatalkan. Tidak ada yang disimpan.");
  } else if (aksi === "chg") {
    await ubah(chatId, messageId, `${teksDraf(d)}\n\nPilih kategori:`, papanKategori(d));
  } else if (aksi === "cat") {
    const nama = daftarKategori(d.type as Jenis)[Number(urutan)];
    if (!nama) return;
    const { data: baru } = await supabase.from("telegram_pending_entries").update({ category: nama }).eq("id", id).select("*").single();
    if (baru) await tampilkanDraf(chatId, messageId, baru);
  } else if (aksi === "jns") {
    const jenisPilihan: Jenis = urutan === "income" ? "income" : "expense";
    const { data: baru } = await supabase.from("telegram_pending_entries")
      .update({ type: jenisPilihan, category: kategoriAwal(jenisPilihan, d.title) }).eq("id", id).select("*").single();
    if (baru) await tampilkanDraf(chatId, messageId, baru);
  } else if (aksi === "swp") {
    const jenisBaru: Jenis = d.type === "income" ? "expense" : "income";
    const { data: baru } = await supabase.from("telegram_pending_entries")
      .update({ type: jenisBaru, category: kategoriAwal(jenisBaru, d.title) }).eq("id", id).select("*").single();
    if (baru) await tampilkanDraf(chatId, messageId, baru);
  } else if (aksi === "ok") {
    await simpan(chatId, messageId, d, updateId);
  }
}

async function cariAnggaranAktif(userId: string) {
  const hariIni = hariIniJakarta();
  const { data } = await supabase.from("budgets").select("id, amount, period_start, period_end")
    .eq("user_id", userId).lte("period_start", hariIni).gte("period_end", hariIni)
    .order("period_start", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

async function simpan(chatId: string, messageId: number, d: any, updateId: number) {
  const anggaran = d.type === "expense" ? await cariAnggaranAktif(d.auth_user_id) : null;
  const { error } = await supabase.from("transactions").insert({
    user_id: d.auth_user_id, title: d.title, item: d.title, amount: d.amount, category: d.category, type: d.type,
    budget_id: anggaran?.id ?? null, status: "confirmed", source: "telegram", telegram_update_id: updateId,
  });
  if (error && error.code !== "23505") {
    console.error("Gagal menyimpan transaksi:", error.message);
    await ubah(chatId, messageId, "Maaf, catatan gagal disimpan. Coba kirim ulang.");
    return;
  }
  await supabase.from("telegram_pending_entries").delete().eq("id", d.id);

  let tambahan = "";
  if (d.type === "expense") {
    const r = await hitungRingkasan(d.auth_user_id);
    const hari = await ringkasanHari(d.auth_user_id);
    tambahan = `\n\nTotal pengeluaran hari ini: ${rupiah(hari.totalHariIni)}` +
      (r ? `\nSisa uang belanja periode ini: ${rupiah(r.sisa)}` : "\n(Belum ada anggaran belanja periode ini di website.)");
  }
  await ubah(chatId, messageId, `Tersimpan.\n\n${d.type === "income" ? "Pemasukan" : "Pengeluaran"}: ${rupiah(Number(d.amount))}\nCatatan: ${d.title}\nKategori: ${d.category}${tambahan}`);
}

// ---------- /sisa dan /batal ----------
async function hitungRingkasan(userId: string) {
  const a = await cariAnggaranAktif(userId);
  if (!a) return null;
  const { data } = await supabase.from("transactions").select("amount, category")
    .eq("user_id", userId).eq("type", "expense").or("is_deleted.is.null,is_deleted.eq.false")
    .gte("transaction_date", a.period_start).lte("transaction_date", a.period_end);
  const baris = data ?? [];
  const terpakai = baris.reduce((s, b) => s + Number(b.amount), 0);
  
  // Ambil khusus pengeluaran yang masuk kategori pangan
  const pangan = baris.filter((b) => b.category === KATEGORI_PENGELUARAN[0].nama).reduce((s, b) => s + Number(b.amount), 0);
  
  const anggaran = Number(a.amount);
  const hariIni = hariIniJakarta();
  const sisaHari = Math.max(1, selisihHari(hariIni, a.period_end) + 1);
  
  return { 
    anggaran, 
    terpakai, 
    pangan, 
    sisa: anggaran - pangan,
    sisaHari, 
    mulai: a.period_start, 
    akhir: a.period_end 
  };
}

async function tanganiSisa(chatId: string, userId: string) {
  const r = await hitungRingkasan(userId);
  if (!r) { await kirim(chatId, "Belum ada anggaran belanja untuk periode ini. Atur uang belanja di website SAKUPUAN dulu ya."); return; }
  const persenPangan = r.terpakai > 0 ? Math.round((r.pangan / r.terpakai) * 100) : 0;
  const catatan = r.sisa < 0 ? "\n\nPengeluaran pangan sudah melewati anggaran belanja periode ini." : "";
  const pesan = `Periode: ${r.mulai} s.d. ${r.akhir}\n\n` +
    `Belanja Pangan:\n` +
    `• Anggaran: ${rupiah(r.anggaran)}\n` +
    `• Terpakai (Pangan): ${rupiah(r.pangan)}\n` +
    `• Sisa Pangan: ${rupiah(r.sisa)}` +
    `${catatan}\n\n` +
    `Informasi Pengeluaran Keseluruhan:\n` +
    `• Total semua pengeluaran: ${rupiah(r.terpakai)} (Porsi pangan ${persenPangan}% dari total)\n\n` +
    `Ini hitungan sederhana dari catatanmu, belum memuat perkiraan harga.`;
  
  await kirim(chatId, pesan);
} 

// Total pengeluaran hari ini (zona waktu Jakarta) dan 7 hari terakhir. Hanya pengeluaran yang belum dibatalkan.
async function ringkasanHari(userId: string) {
  const hariIni = hariIniJakarta();
  const awal = geserHari(hariIni, -6);
  const { data } = await supabase.from("transactions").select("amount, category, transaction_date")
    .eq("user_id", userId).eq("type", "expense").or("is_deleted.is.null,is_deleted.eq.false")
    .gte("transaction_date", awal).lte("transaction_date", hariIni);
  const perHari = new Map<string, number>();
  for (let i = 0; i < 7; i++) perHari.set(geserHari(awal, i), 0);
  const kategoriHariIni = new Map<string, number>();
  let jumlahHariIni = 0;
  for (const b of data ?? []) {
    const tgl = String(b.transaction_date);
    perHari.set(tgl, (perHari.get(tgl) ?? 0) + Number(b.amount));
    if (tgl === hariIni) {
      jumlahHariIni++;
      const k = b.category ?? "Lainnya";
      kategoriHariIni.set(k, (kategoriHariIni.get(k) ?? 0) + Number(b.amount));
    }
  }
  return { hariIni, totalHariIni: perHari.get(hariIni) ?? 0, jumlahHariIni, kategoriHariIni, perHari };
}

async function tanganiHari(chatId: string, userId: string) {
  const r = await ringkasanHari(userId);
  const baris: string[] = [`Pengeluaran hari ini (${labelTanggal(r.hariIni)})`, ""];
  if (r.jumlahHariIni === 0) {
    baris.push("Belum ada pengeluaran tercatat hari ini.");
  } else {
    baris.push(`Total: ${rupiah(r.totalHariIni)} (${r.jumlahHariIni} catatan)`);
    for (const [k, v] of [...r.kategoriHariIni.entries()].sort((a, b) => b[1] - a[1])) baris.push(`- ${k}: ${rupiah(v)}`);
  }
  baris.push("", "7 hari terakhir:");
  for (const [tgl, total] of r.perHari) baris.push(`${labelTanggal(tgl)}: ${rupiah(total)}`);
  baris.push("", "Hari yang tertulis Rp0 bisa berarti memang tidak belanja, atau belum dicatat.");
  await kirim(chatId, baris.join("\n"));
}

async function tanganiBatal(chatId: string, userId: string) {
  const { data } = await supabase.from("transactions").select("id, title, amount, category")
    .eq("user_id", userId).eq("source", "telegram").or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false }).limit(1);
  const t = data?.[0];
  if (!t) { await kirim(chatId, "Tidak ada catatan dari Telegram yang bisa dibatalkan."); return; }
  const { error } = await supabase.from("transactions").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", t.id);
  if (error) { console.error("Gagal membatalkan:", error.message); await kirim(chatId, "Maaf, pembatalan gagal. Coba lagi."); return; }
  await kirim(chatId, `Dibatalkan: ${t.title} (${rupiah(Number(t.amount))}, ${t.category}).`);
}
