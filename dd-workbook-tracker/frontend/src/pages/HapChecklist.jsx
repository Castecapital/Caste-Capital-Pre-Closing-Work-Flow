import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function HapChecklist() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getItems("deal-1", "HAP Assignment Checklist")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  const bySection = useMemo(() => {
    if (!items) return [];
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.section_number)) groups.set(item.section_number, []);
      groups.get(item.section_number).push(item);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [items]);

  if (error) return <p className="text-[#e0393e]">Failed to load items: {error}</p>;
  if (!items) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
            HAP Assignment Checklist
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">{items.length} items across {bySection.length} sections</p>
        </div>
      </div>

      <div className="space-y-8">
        {bySection.map(([section, sectionItems]) => (
          <div key={section}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b] mb-3">
              {section} — {sectionItems[0]?.proposed_owner_info}
            </h2>
            <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-[11px] uppercase tracking-wide text-[#86868b]">
                      <th className="px-4 py-3 font-medium w-12">#</th>
                      <th className="px-4 py-3 font-medium">Item Description</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Responsible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {sectionItems
                      .sort((a, b) => a.sub_item_letter.localeCompare(b.sub_item_letter, undefined, { numeric: true }))
                      .map((item) => (
                        <tr
                          key={item.item_id}
                          onClick={() => navigate(`/items/${item.item_id}`)}
                          className="cursor-pointer transition-colors duration-150 hover:bg-[#f5f5f7] dark:hover:bg-white/5"
                        >
                          <td className="px-4 py-3 text-[#86868b] font-mono text-[11px]">{item.sub_item_letter}</td>
                          <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-white">
                            {item.item_description}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-4 py-3">{item.responsible_party}</td>
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
