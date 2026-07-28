"use client";

import { useState } from "react";

interface ExecutionUnlockProps {
  onUnlocked: () => void;
}

export function ExecutionUnlock({ onUnlocked }: ExecutionUnlockProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/test-runner/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      setPassword(""); // Clear state immediately

      if (res.status === 204) {
        onUnlocked();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Authentication failed");
      }
    } catch {
      setPassword("");
      setError("Network error. Failed to reach server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-inner">
      <div className="flex items-center gap-3 mb-3">
        <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg text-lg">🔒</span>
        <div>
          <h3 className="font-semibold text-slate-200 text-sm">Execution Lock Active</h3>
          <p className="text-xs text-slate-400">
            Enter group execution password to enable test runner execution (15-minute session).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Execution password..."
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? "Unlocking..." : "Unlock Execution"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-rose-400 font-mono">{error}</p>}
    </div>
  );
}

export default ExecutionUnlock;
