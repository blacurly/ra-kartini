"use client";

import { supabase } from "@/lib/supabase"; // Supabase ditambahkan di sini
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_CITY } from "@/lib/constants";

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

const cleanMoney = (n) => Math.max(0, Math.round(Number(n) || 0));

export default function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [telegramPromptSeen, setTelegramPromptSeen] = useState(false);

  // --- PERBAIKAN: Session Bootstrap menggunakan Supabase ---
  useEffect(() => {
    // 1. Cek sesi saat halaman pertama kali dimuat
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          ...session.user,
          name: session.user.user_metadata?.name || "Puan",
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // 2. Pasang pendengar otomatis untuk setiap perubahan status (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          ...session.user,
          name: session.user.user_metadata?.name || "Puan",
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // Bersihkan langganan (subscription) saat komponen dilepas
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- per-user data ---
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    let off = false;
    api.get("/api/tasks") 
      .then(([t, a]) => {
        if (off) return;
        setTasks(t.tasks);
        if (a.assessment) setAnswers(a.assessment.answers);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [user?.id]);

  const [city, setCity] = useState(DEFAULT_CITY);
    useEffect(() => {
      if (!user?.id) {
        setCity(DEFAULT_CITY);
        return;
      } let off = false;
      supabase
      .from("users")
      .select("kota_tinggal")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (off) return;
        if (error) console.error("Gagal membaca kota user:", error.message);
        if (data?.kota_tinggal) setCity(data.kota_tinggal);
      });
      return () => {
        off = true;
      };
    }, [user?.id]);
  const score = 0;

  // --- PERBAIKAN: auth / profile disesuaikan untuk Supabase ---
  const authenticate = useCallback(async (mode, form) => {
    // Karena login/register sudah dipindah ke AuthForm, fungsi ini bisa dikosongkan 
    // atau dipertahankan jika masih dipakai komponen lain.
    return user; 
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut(); // Menggunakan fungsi bawaan Supabase
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (v) => {
    // Update data ke Supabase (opsional, tergantung bagaimana Anda mengatur fungsi patch profile)
    const { data, error } = await supabase.auth.updateUser({
      data: { name: v.name, phone: v.phone }
    });
    if (!error && data.user) {
      setUser({
        ...data.user,
        name: data.user.user_metadata?.name || "Puan",
        email: data.user.email
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const formattedUser = {
        ...user,
        name: user.user_metadata?.name || "Puan",
        email: user.email
      };
      setUser(formattedUser);
      return formattedUser;
    }
    return null;
  }, []);

  // --- action plan ---
  const addTask = useCallback(async (t) => {
    const { task } = await api.post("/api/tasks", t);
    setTasks((ts) => (ts.some((x) => x.id === task.id) ? ts : [task, ...ts]));
    return task;
  }, []);
  const reloadTasks = useCallback(() => api.get("/api/tasks").then((r) => setTasks(r.tasks)), []);
  const toggleTask = async (id) => {
    const cur = tasks.find((t) => t.id === id);
    if (!cur) return;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !cur.done } : t)));
    try {
      await api.patch(`/api/tasks/${id}`, { done: !cur.done });
    } catch {
      reloadTasks();
    }
  };
  const removeTask = async (id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.del(`/api/tasks/${id}`);
    } catch {
      reloadTasks();
    }
  };
  const saveTask = async (t) => {
    if (t.id < 0) {
      await addTask({ title: t.title, cat: t.cat, note: t.note, amount: t.amount });
      return;
    }
    const { task } = await api.patch(`/api/tasks/${t.id}`, {
      title: t.title,
      cat: t.cat,
      note: t.note ?? null,
      amount: t.amount ?? null,
    });
    setTasks((ts) => ts.map((x) => (x.id === task.id ? task : x)));
  };

  const value = {
    user, authLoading, authenticate, logout, updateProfile, refreshUser,
    score, city,
    tasks, addTask, toggleTask, removeTask, saveTask,
    telegramPromptSeen, setTelegramPromptSeen,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}