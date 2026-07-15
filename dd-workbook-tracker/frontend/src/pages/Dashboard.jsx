import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

const COUNTDOWN_FIELDS = [
  { field: "loi_date", label: "LOI" },
  { field: "psa_execution_date", label: "PSA Execution" },
  { field: "projected_hud_approval_date", label: "Projected HUD Approval" },
  { field: "projected_closing_date", label: "Projected Closing" },
  { field: "outside_closing_date", label: "Outside Closing Date" },
];

const TAB_ORDER = [
  "DD Full Checklist",
  "Internal DD Request List",
  "External DD List",
  "HAP Assignment Checklist",
  "Lender Checklist",
];

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function daysAgo(dateStr) {
  return -daysUntil(dateStr);
}

function itemTitle(item) {
  return item.action_item ?? item.document ?? item.item_description ?? item.task ?? item.item_id;
}

export default function Dashboard() {
  const [items, setItems] = useState(null);
  const [costTasks, setCostTasks] = useState([]);
  const [dealConfig, setDealConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getItems(), api.getCostSchedule(), api.getDealConfig()])
      .then(([loadedItems, loadedCostTasks, loadedConfig]) => {
        setItems(loadedItems);
        setCostTasks(loadedCostTasks);
        setDealConfig(loadedConfig);
      })
      .catch((e) => setError(e.message));
  }, []);

  const blockingClosing = useMemo(() => {
    if (!items) return [];
    const critical = items.filter(
      (i) => i.source_tab === "DD Full Checklist" && i.is_critical_path && (i.status === "Open" || i.status === "Blocked")
    );
    const criticalIds = new Set(critical.map((i) => i.item_id));

    const byId = new Map([...items.map((i) => [i.item_id, i]), ...costTasks.map((t) => [t.task_id, t])]);
    const linked = new Set();
    for (const c of critical) {
      for (const linkedId of c.linked_items ?? []) {
        if (!criticalIds.has(linkedId) && byId.has(linkedId)) linked.add(linkedId);
      }
    }

    return [...critical, ...[...linked].map((id) => byId.get(id))];
  }, [items, costTasks]);

  const stalledItems = useMemo(() => {
    if (!items) return [];
    return items
      .filter((i) => i.status === "Open" && daysAgo(i.last_updated) > 7)
      .sort((a, b) => a.last_updated.localeCompare(b.last_updated));
  }, [items]);

  const tabSummary = useMemo(() => {
    if (!items) return [];
    return TAB_ORDER.map((tab) => {
      const tabItems = items.filter((i) => i.source_tab === tab);
      const open = tabItems.filter((i) => i.status === "Open" || i.status === "At Risk" || i.status === "Blocked").length;
      const closed = tabItems.filter((i) => i.status === "Closed").length;
      return { tab, total: tabItems.length, open, closed };
    }).concat({ tab: "Cost Schedule", total: costTasks.length, open: null, closed: null });
  }, [items, costTasks]);

  if (error) return <p className="text-[#e0393e]">Failed to load dashboard: {error}</p>;
  if (!items || !dealConfig) return <p className="text-[#86868b]">Loading…</p>;

  const visibleCountdowns = COUNTDOWN_FIELDS.filter((c) => dealConfig[c.field]);

  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-8">Dashboard</h1>

      {visibleCountdowns.length > 0 && (
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${visibleCountdowns.length}, minmax(0, 1fr))` }}>
          {visibleCountdowns.map((c) => {
            const days = daysUntil(dealConfig[c.field]);
            const urgent = days < 30;
            return (
              <div
                key={c.field}
                className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 px-5 py-4"
              >
                <p className="text-[12px] font-medium text-[#86868b] uppercase tracking-wide mb-1 truncate">
                  {c.label}
                </p>
                <p className="text-[26px] font-semibold tabular-nums" style={{ color: urgent ? "#e0393e" : undefined }}>
                  {days >= 0 ? days : `${Math.abs(days)} over`}
                </p>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  {days >= 0 ? "days remaining" : "days ago"} · {dealConfig[c.field]}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-8">
        <Section title={`Blocking Closing (${blockingClosing.length})`}>
          {blockingClosing.length === 0 ? (
            <EmptyNote>Nothing is currently blocking closing.</EmptyNote>
          ) : (
            <div className="space-y-2">
              {blockingClosing.map((entry) => (
                <Link
                  key={entry.item_id ?? entry.task_id}
                  to={entry.status !== undefined ? `/items/${entry.item_id}` : "/cost-schedule"}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                      {itemTitle(entry)}
                    </p>
                    <p className="text-[11px] text-[#86868b]">{entry.item_id ?? entry.task_id}</p>
                  </div>
                  {entry.status !== undefined ? (
                    <StatusBadge status={entry.status} />
                  ) : (
                    <span className="text-[11px] text-[#86868b] shrink-0">Cost task</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Stalled Items (${stalledItems.length})`}>
          {stalledItems.length === 0 ? (
            <EmptyNote>Nothing has gone stale — every Open item was touched within the last week.</EmptyNote>
          ) : (
            <div className="space-y-2">
              {stalledItems.map((item) => (
                <Link
                  key={item.item_id}
                  to={`/items/${item.item_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                      {itemTitle(item)}
                    </p>
                    <p className="text-[11px] text-[#86868b]">{item.item_id}</p>
                  </div>
                  <span className="text-[11px] text-[#86868b] shrink-0">
                    {daysAgo(item.last_updated)}d since update
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Workbook Summary">
        <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {tabSummary.map((s) => (
            <div key={s.tab} className="flex items-center gap-4 px-5 py-3">
              <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-white w-56 shrink-0">{s.tab}</span>
              {s.open === null ? (
                <span className="text-[12px] text-[#86868b]">{s.total} tasks</span>
              ) : (
                <>
                  <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden flex">
                    <div
                      className="h-full bg-[#1d9b53]"
                      style={{ width: s.total ? `${(s.closed / s.total) * 100}%` : "0%" }}
                    />
                    <div
                      className="h-full bg-[#0071e3]"
                      style={{ width: s.total ? `${(s.open / s.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-[12px] text-[#86868b] w-32 shrink-0 text-right tabular-nums">
                    {s.closed} closed · {s.open} open
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b] mb-3">{title}</h2>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] ring-1 ring-black/5 dark:ring-white/10 px-5 py-6 text-center text-[13px] text-[#86868b]">
      {children}
    </div>
  );
}
