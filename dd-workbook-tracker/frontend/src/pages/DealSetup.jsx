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

  if (error && !config) return <p className="text-red-600">Failed to load deal setup: {error}</p>;
  if (!config) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Deal Setup</h1>
      <p className="text-sm text-slate-500 mb-6">
        All fields are optional — leave anything blank and the rest of the app still works.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
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

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {savedAt && <span className="text-xs text-slate-500">Saved at {savedAt}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, type, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-600 dark:text-slate-300 w-56 shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100"
      />
    </label>
  );
}
