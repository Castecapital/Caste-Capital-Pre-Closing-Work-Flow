import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/", label: "Master DD Tracker", end: true },
  { to: "/internal-dd-list", label: "Internal DD List" },
  { to: "/external-dd-list", label: "External DD List" },
  { to: "/deal-team", label: "Deal Team" },
  { to: "/deal-setup", label: "Deal Setup" },
];

function navLinkClass({ isActive }) {
  return [
    "px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors duration-200",
    isActive ? "text-white bg-white/10" : "text-white/70 hover:text-white",
  ].join(" ");
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black text-[#1d1d1f] dark:text-white">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 h-11 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[15px] font-semibold text-white tracking-tight">
              DD Workbook Tracker
            </span>
            <span className="hidden sm:inline text-[13px] text-white/40">
              RAP UP Portfolio, Roxbury, MA
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={navLinkClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
