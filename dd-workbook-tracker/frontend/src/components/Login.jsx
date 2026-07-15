import { useState } from "react";
import { auth } from "../lib/api";

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(password);
      onSuccess();
    } catch (err) {
      setError(err.status === 401 ? "Incorrect password." : err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[22px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight mb-1">
          DD Workbook Tracker
        </h1>
        <p className="text-center text-[13px] text-[#6e6e73] dark:text-white/60 mb-8">
          Enter the team password to continue.
        </p>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-lg ring-1 ring-black/10 dark:ring-white/15 p-6 space-y-4"
        >
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-[#f5f5f7] dark:bg-white/5 px-3.5 py-2.5 text-[14px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          />
          {error && <p className="text-[12.5px] text-[#e0393e]">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
