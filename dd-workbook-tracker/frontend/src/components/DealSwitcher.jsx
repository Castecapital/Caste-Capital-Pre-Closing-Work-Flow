import { useEffect, useRef, useState } from "react";
import { api, getCurrentDealId, setCurrentDealId } from "../lib/api";

export default function DealSwitcher() {
  const [deals, setDeals] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    api.getDeals().then(setDeals).catch(() => setDeals([]));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentDealId = getCurrentDealId();
  const currentDeal = deals.find((d) => d.id === currentDealId);

  function switchTo(dealId) {
    setCurrentDealId(dealId);
    window.location.href = "/";
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await api.createDeal(newName.trim());
      switchTo(entry.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
      >
        {currentDeal?.name ?? currentDealId}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-xl bg-white dark:bg-[#1d1d1f] shadow-lg ring-1 ring-black/10 dark:ring-white/15 overflow-hidden z-50">
          <div className="py-1.5 max-h-64 overflow-y-auto">
            {deals.map((d) => (
              <button
                key={d.id}
                onClick={() => switchTo(d.id)}
                className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors ${
                  d.id === currentDealId
                    ? "text-[#0071e3] font-medium bg-[#0071e3]/5"
                    : "text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-white/5"
                }`}
              >
                {d.name || "(unnamed deal)"}
              </button>
            ))}
          </div>

          <div className="border-t border-black/5 dark:border-white/10 p-2.5">
            {creating ? (
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Deal name…"
                  className="w-full rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-[#f5f5f7] dark:bg-white/5 px-2.5 py-1.5 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                />
                {error && <p className="text-[11px] text-[#e0393e]">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[#6e6e73] dark:text-white/60 hover:bg-[#f5f5f7] dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-1.5 py-1 text-[13px] font-medium text-[#0071e3] hover:underline"
              >
                + New Deal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
