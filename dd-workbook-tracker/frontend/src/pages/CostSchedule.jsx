import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const currency = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CostSchedule() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("start_date");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    api.getCostSchedule().then(setTasks).catch((e) => setError(e.message));
  }, []);

  const totals = useMemo(() => {
    if (!tasks) return null;
    return tasks.reduce(
      (acc, t) => ({
        budget: acc.budget + t.budget,
        spent: acc.spent + t.spent,
        remaining: acc.remaining + t.remaining,
      }),
      { budget: 0, spent: 0, remaining: 0 }
    );
  }, [tasks]);

  const sorted = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => {
      const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (error) return <p className="text-[#e0393e]">Failed to load cost schedule: {error}</p>;
  if (!tasks) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            Cost Schedule
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">{tasks.length} tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatTile label="Total Budget" value={currency(totals.budget)} />
        <StatTile label="Total Spent" value={currency(totals.spent)} accent="#0071e3" />
        <StatTile label="Total Remaining" value={currency(totals.remaining)} accent="#1d9b53" />
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10 text-left text-[11px] uppercase tracking-wide text-[#86868b]">
                <Th sortable active={sortKey === "phase"} dir={sortDir} onClick={() => toggleSort("phase")}>
                  Phase
                </Th>
                <Th>Task</Th>
                <Th>Party</Th>
                <Th sortable active={sortKey === "start_date"} dir={sortDir} onClick={() => toggleSort("start_date")}>
                  Start
                </Th>
                <Th>End</Th>
                <Th>Budget</Th>
                <Th>Spent</Th>
                <Th>Remaining</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {sorted.map((t) => (
                <tr key={t.task_id} className="hover:bg-[#f5f5f7] dark:hover:bg-white/5">
                  <Td className="text-[#6e6e73] dark:text-white/60">{t.phase}</Td>
                  <Td className="font-medium text-[#1d1d1f] dark:text-white">{t.task ?? "—"}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{t.party ?? "—"}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{t.start_date}</Td>
                  <Td className="text-[#6e6e73] dark:text-white/60">{t.end_date}</Td>
                  <Td className="tabular-nums">{currency(t.budget)}</Td>
                  <Td className="tabular-nums">{currency(t.spent)}</Td>
                  <Td className="tabular-nums">{currency(t.remaining)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 px-5 py-4">
      <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[26px] font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function Th({ children, sortable, active, dir, onClick }) {
  return (
    <th
      className={`px-4 py-3 font-medium whitespace-nowrap ${sortable ? "cursor-pointer select-none hover:text-[#1d1d1f] dark:hover:text-white transition-colors" : ""}`}
      onClick={onClick}
    >
      {children}
      {sortable && active && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
