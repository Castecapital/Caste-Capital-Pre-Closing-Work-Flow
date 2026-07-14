import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export default function DealTeam() {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.getDealTeam().then(setTeam).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!team) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return team;
    return team.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.role.toLowerCase().includes(needle) ||
        m.organization.toLowerCase().includes(needle)
    );
  }, [team, query]);

  if (error) return <p className="text-[#e0393e]">Failed to load deal team: {error}</p>;
  if (!team) return <p className="text-[#86868b]">Loading…</p>;

  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mb-1">
        Deal Team
      </h1>
      <p className="text-[15px] text-[#86868b] mb-6">
        Reference roster used to populate Responsible Party / External Party across the workbook.
      </p>

      <input
        type="text"
        placeholder="Search by name, role, or organization…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6 w-full max-w-md rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-white dark:bg-[#1d1d1f] px-3.5 py-2 text-[14px] text-[#1d1d1f] dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow"
      />

      <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/10 text-left text-[11px] uppercase tracking-wide text-[#86868b]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Organization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((m, i) => (
                <tr key={i} className="transition-colors duration-150 hover:bg-[#f5f5f7] dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-white">{m.name}</td>
                  <td className="px-4 py-3 text-[#6e6e73] dark:text-white/60">{m.role}</td>
                  <td className="px-4 py-3 text-[#6e6e73] dark:text-white/60">{m.organization}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
