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

  if (error) return <p className="text-red-600">Failed to load deal team: {error}</p>;
  if (!team) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Deal Team</h1>
      <p className="text-sm text-slate-500 mb-4">
        Reference roster used to populate Responsible Party / External Party across the workbook.
      </p>

      <input
        type="text"
        placeholder="Search by name, role, or organization…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-md rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Organization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((m, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2">{m.role}</td>
                <td className="px-3 py-2">{m.organization}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
