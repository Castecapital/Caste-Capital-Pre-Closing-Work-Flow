import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import ExportCsvButton from "../components/ExportCsvButton";

const ALL = "All";

export default function DdRequestList({ sourceTab, title }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [department, setDepartment] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sortDir, setSortDir] = useState("desc");
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    setItems(null);
    api
      .getItems(sourceTab)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [sourceTab]);

  const departments = useMemo(
    () => (items ? [ALL, ...new Set(items.map((i) => i.department).filter(Boolean))].sort() : [ALL]),
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
      .filter((i) => department === ALL || i.department === department)
      .filter((i) => status === ALL || i.status === status)
      .sort((a, b) => {
        const cmp = a.last_updated.localeCompare(b.last_updated);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [items, department, status, sortDir, showDeleted]);

  if (error) return <p className="text-[#e0393e]">Failed to load items: {error}</p>;
  if (!items) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{title}</h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            {filtered.length} of {items.length} items
          </p>
        </div>
        <ExportCsvButton sourceTab={sourceTab} />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} />
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
                <Th>DIV Folder</Th>
                <Th>Document</Th>
                <Th>Department</Th>
                <Th>Status</Th>
                <Th>Responsible</Th>
                <Th
                  sortable
                  sortDir={sortDir}
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Last Updated
                </Th>
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
                  <Td className="text-[#6e6e73] dark:text-white/60">{item.div_folder ?? "—"}</Td>
                  <Td className="font-medium text-[#1d1d1f] dark:text-white max-w-sm">{item.document}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{item.department ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={item.status} />
                  </Td>
                  <Td>{item.responsible_party}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{item.last_updated}</Td>
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

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
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
