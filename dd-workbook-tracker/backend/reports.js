// Step 10: workflow automation & reporting.

import { today } from "./schema.js";

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

function itemTitle(item) {
  return item.action_item ?? item.document ?? item.item_description ?? item.item_id;
}

function commentByAuthor(item, author) {
  const match = (item.comments ?? []).find((c) => c.author === author);
  return match?.text ?? "";
}

function latestComment(item) {
  const comments = item.comments ?? [];
  return comments.length ? comments[comments.length - 1].text : "";
}

// Grouping key per tab mirrors each tab's own taxonomy field, so the
// agenda reads the same way the corresponding list view is organized.
function groupKey(item) {
  switch (item.source_tab) {
    case "DD Full Checklist":
      return item.category;
    case "Internal DD Request List":
    case "External DD List":
      return item.department ?? "(no department)";
    case "HAP Assignment Checklist":
      return item.section_number;
    case "Lender Checklist":
      return item.entity_group;
    default:
      return "Other";
  }
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export function generateWeeklyAgenda(items, dealName) {
  const relevant = items.filter((i) => i.status === "Open" || i.status === "At Risk");
  const byTab = groupBy(relevant, (i) => i.source_tab);

  const lines = [];
  lines.push(`# Weekly Agenda${dealName ? ` — ${dealName}` : ""}`);
  lines.push("");
  lines.push(`Generated ${today()} · ${relevant.length} open/at-risk item(s)`);
  lines.push("");

  if (relevant.length === 0) {
    lines.push("Nothing Open or At Risk right now.");
    return lines.join("\n") + "\n";
  }

  for (const [tab, tabItems] of byTab) {
    lines.push(`## ${tab}`);
    lines.push("");
    const byGroup = groupBy(tabItems, groupKey);
    for (const [group, groupItems] of byGroup) {
      lines.push(`### ${group}`);
      lines.push("");
      for (const item of groupItems) {
        const comment = latestComment(item);
        const statusTag = item.status === "At Risk" ? " **(At Risk)**" : "";
        lines.push(
          `- **${item.item_id}** — ${itemTitle(item)} — ${item.responsible_party}${statusTag}${
            comment ? `\n  > ${comment}` : ""
          }`
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

const CSV_COLUMNS = {
  "DD Full Checklist": {
    headers: [
      "Item #",
      "Category",
      "Action Item",
      "Status",
      "Responsible Party",
      "External Party",
      "Outside Date",
      "CC Comment",
      "Partner Comment",
      "Internal",
      "Critical Path",
      "Last Updated",
    ],
    row: (i) => [
      i.item_id,
      i.category,
      i.action_item,
      i.status,
      i.responsible_party,
      i.external_party,
      i.outside_date ?? i.outside_date_raw,
      commentByAuthor(i, "CC Comment"),
      commentByAuthor(i, "Partner Comment"),
      i.is_internal ? "INTERNAL" : "",
      i.is_critical_path ? "Yes" : "",
      i.last_updated,
    ],
  },
  "Internal DD Request List": {
    headers: [
      "DIV Folder",
      "Item #",
      "Document",
      "Status",
      "Department",
      "Responsible Party",
      "DIV Comment",
      "Partner Comment",
      "Notes",
      "Last Updated",
    ],
    row: (i) => [
      i.div_folder,
      i.item_id,
      i.document,
      i.status,
      i.department,
      i.responsible_party,
      commentByAuthor(i, "DIV Comment"),
      commentByAuthor(i, "Partner Comment"),
      commentByAuthor(i, "Notes"),
      i.last_updated,
    ],
  },
  "External DD List": {
    headers: [
      "DIV Folder",
      "Item #",
      "Document",
      "Status",
      "Department",
      "Responsible Party",
      "DIV Comment",
      "Partner Comment",
      "Last Updated",
    ],
    row: (i) => [
      i.div_folder,
      i.item_id,
      i.document,
      i.status,
      i.department,
      i.responsible_party,
      commentByAuthor(i, "DIV Comment"),
      commentByAuthor(i, "Partner Comment"),
      i.last_updated,
    ],
  },
  "HAP Assignment Checklist": {
    headers: [
      "Section",
      "Sub-Item",
      "Item Description",
      "Section Topic",
      "Responsible Party",
      "Status",
      "CC/MG Notes",
      "Comments",
      "Last Updated",
    ],
    row: (i) => [
      i.section_number,
      i.sub_item_letter,
      i.item_description,
      i.proposed_owner_info,
      i.responsible_party,
      i.status,
      commentByAuthor(i, "CC/MG Notes"),
      commentByAuthor(i, "Comments"),
      i.last_updated,
    ],
  },
  "Lender Checklist": {
    headers: ["Item #", "Entity Group", "Document", "Status", "Responsible Party", "External Party", "Comment", "Last Updated"],
    row: (i) => [
      i.item_id,
      i.entity_group,
      i.document,
      i.status,
      i.responsible_party,
      i.external_party,
      commentByAuthor(i, "Comment") || latestComment(i),
      i.last_updated,
    ],
  },
};

export function csvSourceTabs() {
  return Object.keys(CSV_COLUMNS);
}

export function generateCsv(items, sourceTab) {
  const spec = CSV_COLUMNS[sourceTab];
  if (!spec) throw new Error(`no CSV column mapping for source_tab "${sourceTab}"`);
  const filtered = items.filter((i) => i.source_tab === sourceTab && i.status !== "Deleted");
  return toCsv([spec.headers, ...filtered.map(spec.row)]);
}
