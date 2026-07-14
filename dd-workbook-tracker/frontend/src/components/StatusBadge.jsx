const DOT = {
  Open: "bg-[#0071e3]",
  Closed: "bg-[#1d9b53]",
  Blocked: "bg-[#e0393e]",
  "At Risk": "bg-[#f5a623]",
  Deleted: "bg-[#86868b]",
};

export default function StatusBadge({ status }) {
  const dot = DOT[status] ?? "bg-[#86868b]";
  const struck = status === "Deleted" ? "line-through opacity-60" : "";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1d1d1f] dark:text-white ${struck}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
