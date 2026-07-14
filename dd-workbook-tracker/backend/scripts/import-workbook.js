// One-time import: RAP UP DD Work Log (Internal).xlsx -> deal-1 seed data.
//
// Only handles the "Deal Team" and "DD Full Checklist" tabs (Step 1 + Step 2
// of the workbook build). The other five tabs (Internal/External DD lists,
// HAP Assignment Checklist, Lender Checklist, Cost Schedule) are structurally
// irregular in their own ways and are imported in later steps once the core
// engine is proven against this tab.
//
// Usage: node scripts/import-workbook.js [path-to-xlsx] [deal-id]

import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { writeItems, writeDealConfig, writeDealTeam, readItems } from "../store.js";
import { emptyDealConfig, today } from "../schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_PATH = process.argv[2] || path.join(__dirname, "source-data", "RAP_UP_DD_Work_Log_Internal.xlsx");
const DEAL_ID = process.argv[3] || "deal-1";

// Category header rows in the "DD Full Checklist" sheet carry the category
// name for every numbered item beneath them, ending at the next header row.
// Source text has inconsistent casing/whitespace ("Legal - Transaction ",
// "ASSET MANAGEMENT") - normalized to the schema enum here.
const CATEGORY_NORMALIZE = {
  "equity financing": "Equity Financing",
  "debt financing": "Debt Financing",
  "legal - transaction": "Legal - Transaction",
  "physical dd + capex plan": "Physical DD + CapEx Plan",
  "property management dd": "Property Management DD",
  "property financial dd": "Property Financial DD",
  "asset management": "Asset Management",
};

// Confirmed by exact item-number lookup against the source file, not text
// matching - text matching on phrases like "JV OA" false-positives against
// unrelated rows that happen to contain "oa" as a substring.
const CRITICAL_PATH_ITEM_NUMBERS = new Set([11, 17, 18, 24, 28, 25, 31, 34, 65, 138, 139]);

function cellText(cell) {
  let v = cell?.value;
  if (v === null || v === undefined) return null;
  // Many cells in this sheet are formulas (e.g. item # = "+MAX($D$14:D15)+1",
  // outside date = "+G11-60") - exceljs exposes {formula, result}, and we
  // want the computed result, same as openpyxl's data_only=True.
  if (typeof v === "object" && "result" in v) v = v.result;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v.richText) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && v.text) return v.text;
  if (v instanceof Date) return v;
  return v;
}

function toIsoDate(d) {
  if (!(d instanceof Date)) return null;
  return d.toISOString().slice(0, 10);
}

async function importDealTeam(workbook) {
  const ws = workbook.getWorksheet("Deal Team");
  const team = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 2) return; // header row: Role | Organization | Name
    const role = cellText(row.getCell(2));
    const organization = cellText(row.getCell(3));
    const name = cellText(row.getCell(4));
    if (role || organization || name) {
      team.push({ role: role ?? "", organization: organization ?? "", name: name ?? "" });
    }
  });
  await writeDealTeam(DEAL_ID, team);
  return team;
}

// Best-effort match of initials seen in the Responsible Party column against
// the imported Deal Team roster. Only exact single-token initials are
// mapped; combos like "AS/BA" and org-level tags like "CC" are left as-is
// rather than guessed at, per the shared-engine spec ("match when possible").
function buildInitialsMap(team) {
  const map = {};
  for (const member of team) {
    const parts = member.name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const initials = parts.map((p) => p[0]).join("").toUpperCase();
    if (initials.length <= 3) map[initials] = member.name;
  }
  return map;
}

async function importDdFullChecklist(workbook, dealTeam) {
  const ws = workbook.getWorksheet("DD Full Checklist");
  const initialsMap = buildInitialsMap(dealTeam);
  const importDate = today();

  const items = [];
  let currentCategory = null;
  const anomalies = [];

  for (let r = 15; r <= 165; r++) {
    const row = ws.getRow(r);
    const itemNoRaw = cellText(row.getCell(4)); // D
    const actionItem = cellText(row.getCell(5)); // E

    if (itemNoRaw === null && actionItem === null) continue;

    // Category header row: Item# column holds the category name, no action item.
    if (typeof itemNoRaw === "string" && actionItem === null) {
      const normalized = CATEGORY_NORMALIZE[itemNoRaw.trim().toLowerCase()];
      if (normalized) currentCategory = normalized;
      else anomalies.push(`row ${r}: unrecognized category header "${itemNoRaw}"`);
      continue;
    }

    if (typeof itemNoRaw !== "number") continue; // stray/blank row

    const itemNo = itemNoRaw;
    const statusRaw = cellText(row.getCell(6)); // F
    const status = typeof statusRaw === "string" ? statusRaw.trim() : statusRaw;
    const responsiblePartyRaw = cellText(row.getCell(7)); // G
    const externalParty = cellText(row.getCell(8)); // H
    const outsideDateCell = cellText(row.getCell(9)); // I
    const ccComment = cellText(row.getCell(10)); // J
    const partnerComment = cellText(row.getCell(11)); // K
    const internalFlag = cellText(row.getCell(13)); // M
    const strayNote = cellText(row.getCell(16)); // P (2 known stray rows: 34, 35)

    if (!currentCategory) {
      anomalies.push(`row ${r} (item ${itemNo}): no category header seen yet, skipping`);
      continue;
    }
    if (status !== "Open" && status !== "Closed") {
      anomalies.push(`row ${r} (item ${itemNo}): unexpected status "${status}", importing as-is`);
    }

    let outsideDateRaw = null;
    let outsideDate = null;
    if (outsideDateCell instanceof Date) {
      outsideDateRaw = outsideDateCell.toISOString();
      outsideDate = toIsoDate(outsideDateCell);
    } else if (typeof outsideDateCell === "string") {
      outsideDateRaw = outsideDateCell;
    }

    const comments = [];
    if (ccComment) comments.push({ author: "CC Comment", text: String(ccComment), timestamp: importDate });
    if (partnerComment) comments.push({ author: "Partner Comment", text: String(partnerComment), timestamp: importDate });
    if (strayNote) comments.push({ author: "Note", text: String(strayNote), timestamp: importDate });

    let responsibleParty = responsiblePartyRaw ? String(responsiblePartyRaw).trim() : "Unassigned";
    if (initialsMap[responsibleParty]) responsibleParty = initialsMap[responsibleParty];
    if (responsibleParty === "Closed") {
      anomalies.push(`row ${r} (item ${itemNo}): Responsible Party cell literally contains "Closed" in the source file - likely a data-entry error, imported as-is`);
    }

    items.push({
      item_id: `dd-${itemNo}`,
      source_tab: "DD Full Checklist",
      status: status ?? "Open",
      responsible_party: responsibleParty,
      external_party: externalParty ? String(externalParty).trim() : null,
      comments,
      linked_items: null,
      opened_date: importDate,
      last_updated: importDate,
      history: [],
      category: currentCategory,
      phase: "Active Due Diligence",
      action_item: String(actionItem).trim(),
      outside_date_raw: outsideDateRaw,
      outside_date: outsideDate,
      is_internal: internalFlag === "INTERNAL",
      is_critical_path: CRITICAL_PATH_ITEM_NUMBERS.has(itemNo),
    });
  }

  await writeItems(DEAL_ID, items);
  return { items, anomalies };
}

async function importDealConfig(workbook) {
  const ws = workbook.getWorksheet("DD Full Checklist");
  const config = emptyDealConfig();

  config.deal_name = cellText(ws.getRow(3).getCell(4)); // D3

  // Key Dates block: label in column F, date in column G, rows 3-12.
  const KEY_DATE_MAP = {
    "loi executed": "loi_date",
    "initial deposit ($50k)": "initial_deposit_date",
    "rollover ts": "rollover_ts_date",
    "end of dd / 2nd deposit ($150k)": "dd_exit_deposit_date",
    "projected hud approval": "projected_hud_approval_date",
    "projected closing": "projected_closing_date",
    "outside closing date": "outside_closing_date",
  };

  const anomalies = [];
  for (let r = 3; r <= 12; r++) {
    const row = ws.getRow(r);
    const label = cellText(row.getCell(6)); // F
    const dateVal = cellText(row.getCell(7)); // G
    if (!label) continue;
    const field = KEY_DATE_MAP[String(label).trim().toLowerCase()];
    if (field && dateVal instanceof Date) {
      config[field] = toIsoDate(dateVal);
    }
  }

  // No "PSA execution" key-date row exists in the source (only "Initial
  // Deposit ($50K)", which item #13's comment suggests happened same-day as
  // PSA execution, but that's inference, not a labeled fact) - left null
  // for the team to fill in via the Deal Setup panel.
  anomalies.push("psa_execution_date: no labeled key-date row in source - left null, fill in via Deal Setup");

  await writeDealConfig(DEAL_ID, config);
  return { config, anomalies };
}

async function main() {
  console.log(`Importing ${SOURCE_PATH} into deal '${DEAL_ID}'...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_PATH);

  const team = await importDealTeam(workbook);
  console.log(`Deal Team: imported ${team.length} members`);

  const { items, anomalies: itemAnomalies } = await importDdFullChecklist(workbook, team);
  console.log(`DD Full Checklist: imported ${items.length} items`);

  const { config, anomalies: configAnomalies } = await importDealConfig(workbook);
  console.log(`Deal Setup: ${Object.entries(config).filter(([, v]) => v !== null).length}/${Object.keys(config).length} fields populated`);

  const allAnomalies = [...itemAnomalies, ...configAnomalies];
  if (allAnomalies.length) {
    console.log(`\n${allAnomalies.length} note(s) from import:`);
    for (const a of allAnomalies) console.log(`  - ${a}`);
  }

  const critical = items.filter((i) => i.is_critical_path);
  console.log(`\nCritical path items flagged: ${critical.map((i) => i.item_id).join(", ")}`);

  const verify = await readItems(DEAL_ID);
  console.log(`\nVerification: ${verify.length} items on disk for deal '${DEAL_ID}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
