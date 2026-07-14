const STYLES = {
  Open: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Blocked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "At Risk": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Deleted: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through",
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
