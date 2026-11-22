"use client";

import { useState } from "react";
import { loginUser } from "@/lib/services/authService";

export default function AuthForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const input =
    "w-full text-base sm:text-sm px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-sakuGreen focus:ring-1 focus:ring-sakuGreen";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginUser(email, password);

      if (!result.success) {
        throw new Error(result.error);
      }

      onSuccess(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header Login di tengah */}
      <div className="flex justify-center border-b border-gray-200 mb-6">
        <div className="pb-3 px-6 text-base font-bold text-sakuGreen border-b-2 border-sakuGreen text-center">
          Login
        </div>
      </div>

      {/* Form Login */}
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="block text-xs font-semibold mb-1">Alamat Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
            required
            className={input}
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold mb-1">Kata Sandi</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className={input}
          />
        </label>

        {error && (
          <p role="alert" className="text-xs font-semibold text-sakuPink-dark">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sakuGreen hover:bg-sakuGreen-hover disabled:opacity-60 text-white font-semibold py-3 rounded-lg shadow-sm text-sm"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </>
  );
}