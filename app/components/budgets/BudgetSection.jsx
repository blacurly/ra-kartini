'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { rp } from '@/lib/format';

// Helper untuk mendapatkan tanggal awal & akhir bulan ini (YYYY-MM-DD)
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const pad = (n) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

  return { start, end };
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${Number(d)} ${bulan[Number(m) - 1] || m} ${y}`;
}

export default function BudgetSection() {
  const defaultRange = getCurrentMonthRange();

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // State input form
  const [name, setName] = useState('Anggaran Belanja');
  const [amount, setAmount] = useState('');
  const [periodStart, setPeriodStart] = useState(defaultRange.start);
  const [periodEnd, setPeriodEnd] = useState(defaultRange.end);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function loadBudgets() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('budgets')
        .select('id, name, amount, period_start, period_end, status, created_at')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Gagal mengambil anggaran:', error.message);
        return;
      }

      setBudgets(data || []);
    } catch (err) {
      console.error('Error loadBudgets:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleSetOneMonth = () => {
    const range = getCurrentMonthRange();
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanAmount = Number(String(amount).replace(/\D/g, ''));
    if (!name.trim()) {
      setErrorMsg('Nama anggaran wajib diisi.');
      return;
    }
    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('Nominal anggaran harus lebih dari Rp 0.');
      return;
    }
    if (!periodStart || !periodEnd) {
      setErrorMsg('Tanggal mulai dan tanggal selesai wajib diisi.');
      return;
    }
    if (periodEnd < periodStart) {
      setErrorMsg('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg('Sesi login tidak ditemukan. Silakan login ulang.');
        return;
      }

      const { error } = await supabase.from('budgets').insert({
        user_id: user.id,
        name: 'Anggaran Belanja',
        amount: cleanAmount,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'active',
      });

      if (error) {
        console.error('Gagal simpan anggaran:', error.message);
        setErrorMsg(`Gagal menyimpan: ${error.message}`);
        return;
      }

      setSuccessMsg('Anggaran berhasil disimpan dan langsung aktif di bot Telegram!');
      setAmount('');
      setShowForm(false);
      await loadBudgets();
    } catch (err) {
      setErrorMsg('Terjadi kesalahan saat menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };

  // Cek apakah anggaran aktif hari ini
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <section className="bg-white rounded-3xl border border-sakuGreen-light p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-sakuText">Anggaran Belanja</h3>
          <p className="text-xs text-sakuText-muted">
            Otomatis terhubung dengan perintah <code className="font-bold text-sakuGreen">/sisa</code> di Telegram
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((prev) => !prev);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sakuGreen text-white hover:bg-sakuGreen-dark transition-colors shrink-0"
        >
          {showForm ? 'Tutup Form' : '+ Tambah Anggaran'}
        </button>
      </div>

      {successMsg && (
        <p className="rounded-2xl bg-sakuGreen-light/60 border border-sakuGreen-border px-4 py-2.5 text-xs font-semibold text-sakuGreen-dark">
          {successMsg}
        </p>
      )}

      {/* Form Input Anggaran & Periode Tanggal */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-sakuIvory border border-sakuGreen-light p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-sakuText mb-1">Nominal Anggaran (Rp)</label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 2000000"
              className="w-full rounded-xl border border-sakuGreen-border bg-white px-3 py-2 text-sm text-sakuText focus:outline-none focus:border-sakuGreen"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-sakuText">Periode Berlaku</label>
              <button
                type="button"
                onClick={handleSetOneMonth}
                className="text-[11px] font-bold text-sakuPink-dark hover:underline"
              >
                Setel 1 Bulan Penuh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] text-sakuText-muted mb-1">Dari Tanggal</span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-xl border border-sakuGreen-border bg-white px-3 py-2 text-sm text-sakuText focus:outline-none focus:border-sakuGreen"
                />
              </div>
              <div>
                <span className="block text-[11px] text-sakuText-muted mb-1">Sampai Tanggal</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-xl border border-sakuGreen-border bg-white px-3 py-2 text-sm text-sakuText focus:outline-none focus:border-sakuGreen"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-semibold text-sakuPink-dark">{errorMsg}</p>
          )}

          <div className="pt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-sakuText-muted hover:text-sakuText"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sakuPink hover:bg-sakuPink-hover text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan Anggaran'}
            </button>
          </div>
        </form>
      )}

      {/* Daftar Anggaran yang Sudah Diinput */}
      {loading ? (
        <p className="text-xs text-sakuText-muted py-4 text-center">Memuat data anggaran...</p>
      ) : budgets.length === 0 ? (
        <div className="rounded-2xl bg-sakuIvory border border-dashed border-sakuGreen-border p-4 text-center space-y-1">
          <p className="text-xs font-bold text-sakuText">Belum ada anggaran belanja yang diatur</p>
          <p className="text-[11px] text-sakuText-muted">
            Klik tombol <b>+ Tambah Anggaran</b> di atas untuk menetapkan batas belanja dan periode tanggalnya.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {budgets.map((b) => {
            const isAktif =
              b.period_start &&
              b.period_end &&
              b.period_start <= todayStr &&
              b.period_end >= todayStr;

            return (
              <li
                key={b.id}
                className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 ${
                  isAktif
                    ? 'bg-sakuGreen-light/40 border-sakuGreen-border'
                    : 'bg-sakuIvory border-sakuGreen-light'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-extrabold text-sakuText truncate">{b.name}</p>
                    {isAktif && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sakuGreen text-white shrink-0">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-sakuText-muted">
                    Periode: {formatTanggalIndo(b.period_start)} – {formatTanggalIndo(b.period_end)}
                  </p>
                </div>

                <p className="text-sm font-extrabold text-sakuGreen-dark tabular-nums shrink-0">
                  {rp(Number(b.amount || 0))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}