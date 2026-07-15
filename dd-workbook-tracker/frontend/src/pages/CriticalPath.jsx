import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

// Step 8 scope: only these three tabs' linked entries are shown alongside
// each critical-path item, per spec - not every tab a critical item might
// happen to be linked to (that's the general "Linked Items" section on the
// item detail page instead).
const RELEVANT_TABS = new Set(["Lender Checklist", "HAP Assignment Checklist"]);

function itemTitle(item) {
  return item.action_item ?? item.document ?? item.item_description ?? item.task ?? item.item_id;
}

export default function CriticalPath() {
  const [items, setItems] = useState(null);
  const [costTasks, setCostTasks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getItems(), api.getCostSchedule()])
      .then(([loadedItems, loadedCostTasks]) => {
        setItems(loadedItems);
        setCostTasks(loadedCostTasks);
      })
      .catch((e) => setError(e.message));
  }, []);

  const criticalItems = useMemo(() => {
    if (!items) return [];
    const byId = new Map([
      ...items.map((i) => [i.item_id, i]),
      ...costTasks.map((t) => [t.task_id, { ...t, item_id: t.task_id, isCostTask: true }]),
    ]);

    return items
      .filter((i) => i.source_tab === "DD Full Checklist" && i.is_critical_path)
      .map((i) => {
        const linked = (i.linked_items ?? [])
          .map((id) => byId.get(id))
          .filter((entity) => entity && (entity.isCostTask || RELEVANT_TABS.has(entity.source_tab)));
        return { ...i, relevantLinks: linked };
      });
  }, [items, costTasks]);

  if (error) return <p className="text-[#e0393e]">Failed to load critical path: {error}</p>;
  if (!items) return <p className="text-[#86868b]">Loading…</p>;

  const closedCount = criticalItems.filter((i) => i.status === "Closed").length;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            Critical Path
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            {closedCount} of {criticalItems.length} critical-path items closed
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {criticalItems.map((item) => {
          const hasUnclosedLink = item.relevantLinks.some((l) => !l.isCostTask && l.status !== "Closed");
          return (
            <div
              key={item.item_id}
              className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
            >
              <Link
                to={`/items/${item.item_id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#f5f5f7] dark:hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {itemTitle(item)}
                  </p>
                  <p className="text-[12px] text-[#86868b]">
                    {item.item_id} · {item.category}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </Link>

              {item.relevantLinks.length > 0 ? (
                <div className="border-t border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/5">
                  {item.relevantLinks.map((l) => (
                    <Link
                      key={l.item_id}
                      to={l.isCostTask ? "/cost-schedule" : `/items/${l.item_id}`}
                      className="flex items-center justify-between gap-4 pl-9 pr-5 py-2.5 hover:bg-[#f5f5f7] dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] text-[#1d1d1f] dark:text-white truncate">{itemTitle(l)}</p>
                        <p className="text-[11px] text-[#86868b]">
                          {l.item_id} · {l.isCostTask ? "Cost Schedule" : l.source_tab}
                        </p>
                      </div>
                      {l.isCostTask ? (
                        <span className="text-[11px] text-[#86868b] shrink-0">Cost task</span>
                      ) : (
                        <StatusBadge status={l.status} />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="border-t border-black/5 dark:border-white/10 px-5 py-3 text-[12px] text-[#86868b]">
                  Not yet linked to a Lender Checklist, HAP Assignment Checklist, or Cost Schedule item.
                </p>
              )}

              {hasUnclosedLink && (
                <p className="border-t border-black/5 dark:border-white/10 bg-[#fff4e5] dark:bg-[#3a2a0a] px-5 py-2 text-[12px] font-medium text-[#a05a00] dark:text-[#f5a623]">
                  Blocked by open dependencies
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
