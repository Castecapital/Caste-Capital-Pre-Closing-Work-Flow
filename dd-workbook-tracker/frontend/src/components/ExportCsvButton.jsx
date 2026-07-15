import { useState } from "react";
import { api } from "../lib/api";
import { downloadText } from "../lib/download";

export default function ExportCsvButton({ sourceTab }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  async function handleClick() {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateCsv(sourceTab);
      downloadText(result.filename, result.content, "text/csv");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={generating}
        className="rounded-full ring-1 ring-black/10 dark:ring-white/15 hover:bg-[#f5f5f7] dark:hover:bg-white/5 text-[#1d1d1f] dark:text-white px-3.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
      >
        {generating ? "Exporting…" : "Export to CSV"}
      </button>
      {error && <span className="text-[11px] text-[#e0393e]">{error}</span>}
    </div>
  );
}
