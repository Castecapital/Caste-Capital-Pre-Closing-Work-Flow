import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { downloadText } from "../lib/download";

const TAB_LABELS = [
  "DD Full Checklist",
  "Internal DD Request List",
  "External DD List",
  "HAP Assignment Checklist",
  "Lender Checklist",
];

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [generatingAgenda, setGeneratingAgenda] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(null);

  function load() {
    api.getReports().then(setReports).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleGenerateAgenda() {
    setGeneratingAgenda(true);
    setError(null);
    try {
      const result = await api.generateWeeklyAgenda();
      downloadText(result.filename, result.content, "text/markdown");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingAgenda(false);
    }
  }

  async function handleGenerateCsv(tab) {
    setGeneratingCsv(tab);
    setError(null);
    try {
      const result = await api.generateCsv(tab);
      downloadText(result.filename, result.content, "text/csv");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingCsv(null);
    }
  }

  if (error && !reports) return <p className="text-[#e0393e]">Failed to load reports: {error}</p>;

  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-1">Reports</h1>
      <p className="text-[15px] text-[#86868b] mb-8">
        Every report generated here is saved for this deal — come back anytime to re-download.
      </p>

      <div className="grid grid-cols-2 gap-6 mb-10">
        <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 p-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Weekly Agenda</h2>
          <p className="text-[13px] text-[#86868b] mb-4">
            Every Open and At Risk item across all tabs, grouped by tab then category/department/section/entity
            group.
          </p>
          <button
            onClick={handleGenerateAgenda}
            disabled={generatingAgenda}
            className="rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {generatingAgenda ? "Generating…" : "Generate Weekly Agenda"}
          </button>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 p-5">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-1">Export to CSV</h2>
          <p className="text-[13px] text-[#86868b] mb-4">
            Per-tab export matching each tab's original column structure.
          </p>
          <div className="flex flex-wrap gap-2">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleGenerateCsv(tab)}
                disabled={generatingCsv === tab}
                className="rounded-full ring-1 ring-black/10 dark:ring-white/15 hover:bg-[#f5f5f7] dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white px-3.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                {generatingCsv === tab ? "Generating…" : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-[#e0393e] mb-4">{error}</p>}

      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b] mb-3">Saved Reports</h2>
      {!reports ? (
        <p className="text-[#86868b]">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] ring-1 ring-black/5 dark:ring-white/10 px-5 py-6 text-center text-[13px] text-[#86868b]">
          No reports generated yet for this deal.
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{r.label}</p>
                <p className="text-[11px] text-[#86868b]">{formatTimestamp(r.generated_at)}</p>
              </div>
              <a
                href={api.reportDownloadUrl(r.id)}
                className="shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15 hover:bg-[#f5f5f7] dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white px-3.5 py-1.5 text-[12px] font-medium transition-colors"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
