import { useEffect, useState } from "react";
import { api } from "../lib/api";

const FIELD_LABELS = {
  deal_name: "Deal Name",
  loi_date: "LOI Date",
  psa_execution_date: "PSA Execution Date",
  initial_deposit_date: "Initial Deposit Date",
  rollover_ts_date: "Rollover TS Date",
  dd_exit_deposit_date: "DD Exit Deposit Date",
  projected_hud_approval_date: "Projected HUD Approval Date",
  projected_closing_date: "Projected Closing Date",
  outside_closing_date: "Outside Closing Date",
};

export default function DealSetup() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getDealConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  function handleChange(field, value) {
    setConfig((c) => ({ ...c, [field]: value === "" ? null : value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDealConfig(config);
      setConfig(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !config) return <p className="text-[#e0393e]">Failed to load deal setup: {error}</p>;
  if (!config) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-1">
        Deal Setup
      </h1>
      <p className="text-[15px] text-[#86868b] mb-8">
        All fields are optional — leave anything blank and the rest of the app still works.
      </p>

      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden"
      >
        <Field
          label={FIELD_LABELS.deal_name}
          type="text"
          value={config.deal_name ?? ""}
          onChange={(v) => handleChange("deal_name", v)}
        />
        {Object.keys(FIELD_LABELS)
          .filter((f) => f !== "deal_name")
          .map((field) => (
            <Field
              key={field}
              label={FIELD_LABELS[field]}
              type="date"
              value={config[field] ?? ""}
              onChange={(v) => handleChange(field, v)}
            />
          ))}

        <div className="flex items-center gap-3 px-5 py-4 bg-[#f5f5f7] dark:bg-white/[0.03]">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] text-white px-5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {savedAt && <span className="text-[12px] text-[#86868b]">Saved at {savedAt}</span>}
          {error && <span className="text-[12px] text-[#e0393e]">{error}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, type, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 px-5 py-3.5 text-[13px]">
      <span className="text-[#6e6e73] dark:text-white/60 w-56 shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-[#f5f5f7] dark:bg-white/5 px-3 py-1.5 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow"
      />
    </label>
  );
}
