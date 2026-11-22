'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error && !error.message?.toLowerCase().includes('auth session missing')) {
        console.error('Gagal signOut:', error.message);
      }
    } catch (err) {
      const msg = err?.message?.toLowerCase() || '';
      if (!msg.includes('auth session missing')) {
        console.error('Error saat logout:', err);
      }
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {}

      window.location.href = '/';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors flex items-center gap-2 rounded-md"
    >
      <span>{loading ? 'Keluar...' : 'Log Out'}</span>
    </button>
  );
}