import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function LenderChecklist() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [groupOrder, setGroupOrder] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getItems("Lender Checklist"), api.getMeta()])
      .then(([loadedItems, meta]) => {
        setItems(loadedItems);
        setGroupOrder(meta.entityGroups);
      })
      .catch((e) => setError(e.message));
  }, []);

  const byGroup = useMemo(() => {
    if (!items) return [];
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.entity_group)) groups.set(item.entity_group, []);
      groups.get(item.entity_group).push(item);
    }
    return groupOrder.filter((g) => groups.has(g)).map((g) => [g, groups.get(g)]);
  }, [items, groupOrder]);

  if (error) return <p className="text-[#e0393e]">Failed to load items: {error}</p>;
  if (!items) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            Lender Checklist
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            {items.length} items across {byGroup.length} groups
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {byGroup.map(([group, groupItems]) => (
          <div key={group}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b] mb-3">{group}</h2>
            <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-[11px] uppercase tracking-wide text-[#86868b]">
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Responsible</th>
                      <th className="px-4 py-3 font-medium">External</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {groupItems.map((item) => (
                      <tr
                        key={item.item_id}
                        onClick={() => navigate(`/items/${item.item_id}`)}
                        className="cursor-pointer transition-colors duration-150 hover:bg-[#f5f5f7] dark:hover:bg-white/5"
                      >
                        <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-white max-w-md">
                          {item.document}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3">{item.responsible_party}</td>
                        <td className="px-4 py-3 text-[#6e6e73] dark:text-white/60">{item.external_party ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
