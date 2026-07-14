import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/", label: "Master DD Tracker", end: true },
  { to: "/deal-team", label: "Deal Team" },
  { to: "/deal-setup", label: "Deal Setup" },
];

function navLinkClass({ isActive }) {
  return [
    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
    isActive
      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  ].join(" ");
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight">DD Workbook Tracker</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">RAP UP Portfolio, Roxbury, MA</span>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={navLinkClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
