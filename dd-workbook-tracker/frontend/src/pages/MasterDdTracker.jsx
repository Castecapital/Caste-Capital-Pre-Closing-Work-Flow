import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

const ALL = "All";

export default function MasterDdTracker() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [internalOnly, setInternalOnly] = useState(ALL);
  const [sortDir, setSortDir] = useState("desc");
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    api
      .getItems("deal-1", "DD Full Checklist")
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

  if (error) return <p className="text-red-600">Failed to load items: {error}</p>;
  if (!items) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Master DD Tracker</h1>
        <p className="text-sm text-slate-500">
          {filtered.length} of {items.length} items
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <FilterSelect label="Category" value={category} onChange={setCategory} options={categories} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} />
        <FilterSelect
          label="Internal"
          value={internalOnly}
          onChange={setInternalOnly}
          options={[ALL, "Internal", "External"]}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 self-end pb-1.5">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show deleted
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
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
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((item) => (
              <tr key={item.item_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <Td className="text-slate-400 font-mono text-xs">{item.item_id}</Td>
                <Td>{item.category}</Td>
                <Td className="max-w-xs">
                  <div className="font-medium">{item.action_item}</div>
                  {item.comments.length > 0 && (
                    <div className="text-xs text-slate-500 truncate">{item.comments[0].text}</div>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td>{item.responsible_party}</Td>
                <Td>{item.external_party ?? "—"}</Td>
                <Td>{item.outside_date ?? (item.outside_date_raw || "—")}</Td>
                <Td>{item.last_updated}</Td>
                <Td>
                  <div className="flex gap-1">
                    {item.is_critical_path && <Flag color="red">Critical</Flag>}
                    {item.is_internal && <Flag color="slate">Internal</Flag>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
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
      className={`px-3 py-2 whitespace-nowrap ${sortable ? "cursor-pointer select-none" : ""}`}
      onClick={onClick}
    >
      {children}
      {sortable && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function Flag({ color, children }) {
  const colors = {
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    slate: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${colors[color]}`}>
      {children}
    </span>
  );
}
