import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import ExportCsvButton from "../components/ExportCsvButton";

const ALL = "All";

export default function MasterDdTracker() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [internalOnly, setInternalOnly] = useState(ALL);
  const [sortDir, setSortDir] = useState("desc");
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    api
      .getItems("DD Full Checklist")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(
    () => (items ? [ALL, ...new Set(items.map((i) => i.category))].sort() : [ALL]),
    [items]
  );
  const statuses = useMemo(
    () => (items ? [ALL, ...new Set(items.map((i) => i.status))] : [ALL]),
    [items]
  );

  const filtered = useMemo(() => {
    if (!items) return [];
    return items
      .filter((i) => showDeleted || i.status !== "Deleted")
      .filter((i) => category === ALL || i.category === category)
      .filter((i) => status === ALL || i.status === status)
      .filter((i) => internalOnly === ALL || (internalOnly === "Internal" ? i.is_internal : !i.is_internal))
      .sort((a, b) => {
        const cmp = a.last_updated.localeCompare(b.last_updated);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [items, category, status, internalOnly, sortDir, showDeleted]);

  if (error) return <p className="text-[#e0393e]">Failed to load items: {error}</p>;
  if (!items) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            Master DD Tracker
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            {filtered.length} of {items.length} items
          </p>
        </div>
        <ExportCsvButton sourceTab="DD Full Checklist" />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} />
        <FilterSelect
          label="Internal"
          value={internalOnly}
          onChange={setInternalOnly}
          options={[ALL, "Internal", "External"]}
        />
        <label className="flex items-center gap-2 text-[13px] text-[#6e6e73] dark:text-white/60 pb-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="accent-[#0071e3]"
          />
          Show deleted
        </label>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10 text-left text-[11px] uppercase tracking-wide text-[#86868b]">
                <Th>#</Th>
                <Th>Category</Th>
                <Th>Action Item</Th>
                <Th>Status</Th>
                <Th>Responsible</Th>
                <Th>External</Th>
                <Th>Outside Date</Th>
                <Th
                  sortable
                  sortDir={sortDir}
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Last Updated
                </Th>
                <Th>Flags</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((item) => (
                <tr
                  key={item.item_id}
                  onClick={() => navigate(`/items/${item.item_id}`)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[#f5f5f7] dark:hover:bg-white/5"
                >
                  <Td className="text-[#86868b] font-mono text-[11px]">{item.item_id}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{item.category}</Td>
                  <Td className="max-w-xs">
                    <div className="font-medium text-[#1d1d1f] dark:text-white">{item.action_item}</div>
                    {item.comments.length > 0 && (
                      <div className="text-[12px] text-[#86868b] truncate mt-0.5">
                        {item.comments[0].text}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={item.status} />
                  </Td>
                  <Td>{item.responsible_party}</Td>
                  <Td>{item.external_party ?? "—"}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">
                    {item.outside_date ?? (item.outside_date_raw || "—")}
                  </Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{item.last_updated}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {item.is_critical_path && <Flag color="red">Critical</Flag>}
                      {item.is_internal && <Flag color="gray">Internal</Flag>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[#6e6e73] dark:text-white/50">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-white dark:bg-[#1d1d1f] px-3 py-1.5 text-[13px] text-[#1d1d1f] dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children, sortable, sortDir, onClick }) {
  return (
    <th
      className={`px-4 py-3 font-medium whitespace-nowrap ${sortable ? "cursor-pointer select-none hover:text-[#1d1d1f] dark:hover:text-white transition-colors" : ""}`}
      onClick={onClick}
    >
      {children}
      {sortable && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function Flag({ color, children }) {
  const colors = {
    red: "bg-[#e0393e]/10 text-[#e0393e]",
    gray: "bg-black/5 text-[#6e6e73] dark:bg-white/10 dark:text-white/60",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${colors[color]}`}>
      {children}
    </span>
  );
}
