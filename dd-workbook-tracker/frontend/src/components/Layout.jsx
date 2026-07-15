import { Link, NavLink, Outlet } from "react-router-dom";
import DealSwitcher from "./DealSwitcher";

const tabs = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/master-dd-tracker", label: "Master DD Tracker" },
  { to: "/critical-path", label: "Critical Path" },
  { to: "/internal-dd-list", label: "Internal DD List" },
  { to: "/external-dd-list", label: "External DD List" },
  { to: "/hap-checklist", label: "HAP Checklist" },
  { to: "/lender-checklist", label: "Lender Checklist" },
  { to: "/cost-schedule", label: "Cost Schedule" },
  { to: "/deal-team", label: "Deal Team" },
  { to: "/deal-setup", label: "Deal Setup" },
  { to: "/hap-info", label: "HAP Info" },
  { to: "/lender-info", label: "Lender Info" },
];

function navLinkClass({ isActive }) {
  return [
    "shrink-0 whitespace-nowrap px-3 py-1 text-[12.5px] font-medium rounded-full transition-colors duration-200",
    isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white",
  ].join(" ");
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black text-[#1d1d1f] dark:text-white">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 h-11 flex items-center gap-3">
          <Link to="/" className="text-[15px] font-semibold text-white tracking-tight shrink-0">
            DD Workbook Tracker
          </Link>
          <DealSwitcher />
        </div>
        <div className="mx-auto max-w-6xl px-6 h-9 flex items-center border-t border-white/5">
          <nav className="flex items-center gap-1 overflow-x-auto">
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
