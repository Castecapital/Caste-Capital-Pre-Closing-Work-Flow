// One-time import: RAP UP DD Work Log (Internal).xlsx -> deal-1 seed data.
//
// Handles all 7 tabs: "Deal Team", "DD Full Checklist", "Internal - DD
// Request List", "External - DD List", "HAP Assignment Checklist", "Lender
// Checklist", and "Cost Schedule" (Steps 1-6 of the workbook build).
//
// Usage: node scripts/import-workbook.js [path-to-xlsx] [deal-id]

import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import {
  writeItems,
  writeDealConfig,
  writeDealTeam,
  writeHapConfig,
  writeLenderConfig,
  writeCostSchedule,
  readItems,
} from "../store.js";
import { emptyDealConfig, emptyHapConfig, emptyLenderConfig, today } from "../schema.js";

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

// Department header rows in both DD Request List sheets carry a differently-
// cased label than the per-row Department column value actually uses (e.g.
// header "PHYSICAL / PROPERTY" but every row under it is Department
// "Development"). Rows with a blank Department column fall back to this map
// keyed by the department header text seen above them.
const DEPT_HEADER_TO_DEPARTMENT = {
  "leasing & marketing": "Leasing / Marketing",
  "physical / property": "Development",
  "property management": "Prop Mgmt",
  affordable: "Prop Mgmt",
  "legal, insurance and tax documents": "Legal/Ins/Tax",
  "accounting / finance": "Accounting",
};

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

  return { items, anomalies };
}

// Shared shape between "Internal - DD Request List" and "External - DD List":
// C=DIV Folder, D=Item#, E=Document, F=Status, G=Department, H=Responsible
// Party, I=DIV Comment, J=Partner Comment, K=Notes (Internal only - External
// has no Notes column, which is expected, not a bug).
async function importDdRequestList(workbook, { sheetName, sourceTab, idPrefix, lastRow }) {
  const ws = workbook.getWorksheet(sheetName);
  const importDate = today();
  const items = [];
  const anomalies = [];
  let currentDeptHeader = null;

  for (let r = 6; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const itemNoRaw = cellText(row.getCell(4)); // D
    const document = cellText(row.getCell(5)); // E
    const statusRaw = cellText(row.getCell(6)); // F

    if (itemNoRaw === null && document === null) continue;

    // Department header row: Item# column holds the department label, no document.
    if (typeof itemNoRaw === "string" && document === null) {
      currentDeptHeader = itemNoRaw.trim().toLowerCase();
      continue;
    }

    // Sub-section label row (e.g. "Environmental Information review"): no
    // item#, has a document-column label but no status - informational only,
    // and the Department column is already explicit on every real item row
    // beneath it, so nothing is lost by skipping these.
    if (itemNoRaw === null) continue;

    if (typeof itemNoRaw !== "number") continue; // stray/blank row

    const itemNo = itemNoRaw;
    const divFolder = cellText(row.getCell(3)); // C
    let departmentRaw = cellText(row.getCell(7)); // G
    const responsiblePartyRaw = cellText(row.getCell(8)); // H
    const divComment = cellText(row.getCell(9)); // I
    const partnerComment = cellText(row.getCell(10)); // J
    const notes = sheetName.startsWith("Internal") ? cellText(row.getCell(11)) : null; // K

    let status = typeof statusRaw === "string" ? statusRaw.trim() : statusRaw;
    const comments = [];

    // The literal "Deleted" placeholder row: document/department text is
    // itself just "Deleted" in the source - preserve the item number and
    // status, but don't carry a fake department or document string forward.
    const isDeletedRow = status === "Deleted";
    let documentText = document ? String(document).trim() : null;
    let department = null;

    if (isDeletedRow) {
      documentText = "[Deleted]";
      department = null;
    } else {
      department = departmentRaw ? String(departmentRaw).trim() : DEPT_HEADER_TO_DEPARTMENT[currentDeptHeader] ?? null;
      if (!department) {
        anomalies.push(`${sourceTab} row ${r} (item ${itemNo}): no department resolved, importing with department=null`);
      }
    }

    if (status === "Received") {
      comments.push({ author: "Original Status", text: "Received", timestamp: importDate });
      status = "Closed";
      anomalies.push(`${sourceTab} row ${r} (item ${itemNo}): status "Received" mapped to "Closed" (not a schema status), original value preserved in comments`);
    } else if (!status) {
      status = "Open";
    } else if (!["Open", "Closed", "Deleted"].includes(status)) {
      anomalies.push(`${sourceTab} row ${r} (item ${itemNo}): unexpected status "${status}", importing as-is`);
    }

    if (divComment) comments.push({ author: "DIV Comment", text: String(divComment), timestamp: importDate });
    if (partnerComment) comments.push({ author: "Partner Comment", text: String(partnerComment), timestamp: importDate });
    if (notes) comments.push({ author: "Notes", text: String(notes), timestamp: importDate });

    items.push({
      item_id: `${idPrefix}-${itemNo}`,
      source_tab: sourceTab,
      status,
      responsible_party: responsiblePartyRaw ? String(responsiblePartyRaw).trim() : "Unassigned",
      external_party: null,
      comments,
      linked_items: null,
      opened_date: importDate,
      last_updated: importDate,
      history: [],
      div_folder: divFolder ? String(divFolder).trim() : null,
      document: documentText,
      department,
    });
  }

  return { items, anomalies };
}

// "HAP Assignment Checklist" tab: a general-info header (rows 3-7, all blank
// in this workbook - it's an unfilled template) followed by 4 numbered
// sections, each with lettered sub-items (a., b., c. ...). Section rows:
// column A/B (merged) = "Section N", column C = the section's topic label.
// Sub-item rows: B = letter, C = item description, D = Responsible Party,
// E = CC/MG Notes, F = Status, G = a fill-in-the-blank prompt (folded into
// comments as "Comments", same treatment as the other free-text columns).
async function importHapAssignmentChecklist(workbook) {
  const ws = workbook.getWorksheet("HAP Assignment Checklist");
  const importDate = today();
  const items = [];
  const anomalies = [];
  let currentSection = null;
  let currentTopic = null;

  for (let r = 8; r <= 66; r++) {
    const row = ws.getRow(r);
    const sectionLabel = cellText(row.getCell(1)); // A (merged with B on header rows)
    const letter = cellText(row.getCell(2)); // B
    const description = cellText(row.getCell(3)); // C

    if (sectionLabel === null && letter === null && description === null) continue;

    // Section header row: A holds "Section N", C holds the topic label.
    if (sectionLabel) {
      currentSection = String(sectionLabel).trim();
      currentTopic = description ? String(description).trim() : null;
      continue;
    }

    // Sub-label row (e.g. "If new management is being retained at closing:"):
    // no letter, informational only - the real items beneath it still carry
    // the section's topic, so nothing is lost by skipping it.
    if (!letter) continue;

    if (!currentSection) {
      anomalies.push(`HAP Assignment Checklist row ${r}: no section header seen yet, skipping`);
      continue;
    }

    const responsiblePartyRaw = cellText(row.getCell(4)); // D
    const ccMgNotes = cellText(row.getCell(5)); // E
    const statusRaw = cellText(row.getCell(6)); // F
    const commentsPrompt = cellText(row.getCell(7)); // G

    const comments = [];
    if (ccMgNotes) comments.push({ author: "CC/MG Notes", text: String(ccMgNotes).trim(), timestamp: importDate });
    if (commentsPrompt) comments.push({ author: "Comments", text: String(commentsPrompt).trim(), timestamp: importDate });

    const status = typeof statusRaw === "string" && statusRaw.trim() ? statusRaw.trim() : "Open";
    const sectionNumber = currentSection.replace(/^Section\s*/i, "");
    // Source has stray internal whitespace in a couple of letter cells
    // (e.g. "l ." instead of "l.") - strip all periods/whitespace rather
    // than just a trailing period so the item_id never ends up with a
    // trailing space (e.g. "hap-4l ").
    const letterKey = String(letter).replace(/[.\s]/g, "");

    items.push({
      item_id: `hap-${sectionNumber}${letterKey}`,
      source_tab: "HAP Assignment Checklist",
      status,
      responsible_party: responsiblePartyRaw ? String(responsiblePartyRaw).trim() : "Unassigned",
      external_party: null,
      comments,
      linked_items: null,
      opened_date: importDate,
      last_updated: importDate,
      history: [],
      section_number: currentSection,
      sub_item_letter: String(letter).trim(),
      item_description: String(description).trim(),
      proposed_owner_info: currentTopic,
    });
  }

  return { items, anomalies };
}

async function importHapConfig() {
  // The General Information header (rows 3-7: Name/Address/Contract/New
  // Owner/Seller/FHA/PBCA/HUD AE) is entirely unfilled in this workbook -
  // it's a blank template, not missing data. Every field starts null, same
  // as Deal Setup, and is meant to be filled in via the HAP Info panel.
  return emptyHapConfig();
}

// "Lender Checklist" tab, column E: header rows carry the entity_group
// label (rows 6/12/20/26 for the 4 entity types, rows 32/45/62 for the
// 3 non-entity groups sharing the same item columns). Umbrella section
// titles (rows 5/31/44/61, e.g. "PROPERTY-LEVEL ITEMS FOR RATE LOCK") don't
// map to a group themselves - they're skipped without resetting
// currentGroup, so the group carried from the last recognized header stays
// in effect until the next real sub-header.
const ENTITY_GROUP_HEADER_MAP = {
  "tbd borrowing entity": "Borrowing Entity",
  "tbd key principal / guarantor": "Key Principal / Guarantor",
  "tbd princial individuals": "Principal Individuals", // source typo, preserved for matching only
  "tbd principal entities": "Principal Entities",
  "operating statements": "Operating Statements",
  "insurance, legal, & third-party items": "Insurance/Legal/Third-Party",
  other: "Other",
};

async function importLenderChecklist(workbook, dealTeam) {
  const ws = workbook.getWorksheet("Lender Checklist");
  const initialsMap = buildInitialsMap(dealTeam);
  const importDate = today();
  const items = [];
  const anomalies = [];
  let currentGroup = null;

  for (let r = 6; r <= 65; r++) {
    const row = ws.getRow(r);
    const itemNoRaw = cellText(row.getCell(5)); // E
    const document = cellText(row.getCell(6)); // F

    if (itemNoRaw === null && document === null) continue;

    // Header/label row: E holds text, F (Document) is blank.
    if (typeof itemNoRaw === "string" && document === null) {
      const mapped = ENTITY_GROUP_HEADER_MAP[itemNoRaw.trim().toLowerCase()];
      if (mapped) currentGroup = mapped;
      else anomalies.push(`Lender Checklist row ${r}: unmapped header "${itemNoRaw}" - carrying forward previous entity_group`);
      continue;
    }

    if (typeof itemNoRaw !== "number") continue; // stray/blank row

    if (!currentGroup) {
      anomalies.push(`Lender Checklist row ${r} (item ${itemNoRaw}): no entity_group header seen yet, skipping`);
      continue;
    }

    const statusRaw = cellText(row.getCell(7)); // G
    const responsiblePartyRaw = cellText(row.getCell(8)); // H
    const externalParty = cellText(row.getCell(9)); // I
    const comment = cellText(row.getCell(11)); // K

    const status = typeof statusRaw === "string" && statusRaw.trim() ? statusRaw.trim() : "Open";
    let responsibleParty = responsiblePartyRaw ? String(responsiblePartyRaw).trim() : "Unassigned";
    if (initialsMap[responsibleParty]) responsibleParty = initialsMap[responsibleParty];

    const comments = [];
    if (comment) comments.push({ author: "Comment", text: String(comment).trim(), timestamp: importDate });

    items.push({
      item_id: `lender-${itemNoRaw}`,
      source_tab: "Lender Checklist",
      status,
      responsible_party: responsibleParty,
      external_party: externalParty ? String(externalParty).trim() : null,
      comments,
      linked_items: null,
      opened_date: importDate,
      last_updated: importDate,
      history: [],
      entity_group: currentGroup,
      document: String(document).trim(),
    });
  }

  // Supplemental document requests: a second, unrelated list tucked into
  // column M of the same sheet (rows 7-13), with no item numbers or status
  // of its own - imported as its own set of items tagged "Supplemental
  // Requests" so nothing from it gets lost or conflated with the primary
  // checklist above. Row 5's column M value ("Walker" - a person's name,
  // not a document) is noise from the sheet's layout, not a real entry, and
  // is excluded.
  let supplementalIndex = 0;
  for (let r = 7; r <= 13; r++) {
    const doc = cellText(ws.getRow(r).getCell(13)); // M
    if (!doc) continue;
    supplementalIndex += 1;
    items.push({
      item_id: `lender-s${supplementalIndex}`,
      source_tab: "Lender Checklist",
      status: "Open",
      responsible_party: "Unassigned",
      external_party: null,
      comments: [],
      linked_items: null,
      opened_date: importDate,
      last_updated: importDate,
      history: [],
      entity_group: "Supplemental Requests",
      document: String(doc).trim(),
    });
  }

  return { items, anomalies };
}

async function importLenderConfig(workbook) {
  const ws = workbook.getWorksheet("Lender Checklist");
  const title = cellText(ws.getRow(3).getCell(5)); // E3, e.g. "Northmarq - Lender Checklist"
  const config = emptyLenderConfig();
  if (typeof title === "string") {
    const match = title.match(/^(.*?)\s*-\s*Lender Checklist/i);
    config.lender_name = match ? match[1].trim() : title.trim();
  }
  return config;
}

// "Cost Schedule" tab: columns C=Phase, D=Task, E=Party, F=Start, G=Duration,
// H=End, I=Budget, J=Proposal Cost, K=Spent, L=Remaining, then one column
// per month (O onward, header = that month's end date) through X. Rows
// 26-27 are precomputed "Total (Incl./Excl. Deposits)" rows and 29-31 are a
// "Note:" aside - neither are tasks, both excluded. Row 23 ("Contingency")
// has a phase and dollar figures but no task/party - imported with
// task: null rather than invented text.
async function importCostSchedule(workbook) {
  const ws = workbook.getWorksheet("Cost Schedule");
  const anomalies = [];

  // Month columns run from O (15) to whatever the last populated header is,
  // rather than a hardcoded end column, so this doesn't silently drop a
  // month if the sheet grows.
  const monthColumns = [];
  const headerRow = ws.getRow(4);
  for (let c = 15; c <= 30; c++) {
    const header = cellText(headerRow.getCell(c));
    if (header instanceof Date) monthColumns.push({ col: c, month: header.toISOString().slice(0, 7) });
  }

  const tasks = [];
  for (let r = 5; r <= 25; r++) {
    const row = ws.getRow(r);
    const phase = cellText(row.getCell(3)); // C
    if (!phase) continue;

    const task = cellText(row.getCell(4)); // D
    const party = cellText(row.getCell(5)); // E
    const startDate = cellText(row.getCell(6)); // F
    const durationDays = cellText(row.getCell(7)); // G
    const endDate = cellText(row.getCell(8)); // H
    const budget = cellText(row.getCell(9)); // I
    const proposalCost = cellText(row.getCell(10)); // J
    const spent = cellText(row.getCell(11)); // K
    const remaining = cellText(row.getCell(12)); // L

    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      anomalies.push(`Cost Schedule row ${r} (phase "${phase}"): missing start/end date, skipping - likely a totals/notes row, not a task`);
      continue;
    }

    // A handful of monthly-spend cells are shared-formula references with no
    // cached result at all (e.g. row 5's Dec-2025 column caches 0.0001, but
    // every other month on that row is just "same formula as O5" with
    // nothing cached). Since these are date-range-conditional formulas that
    // dump the task's cost into whichever month it falls in, and every task
    // here only actually spans one or two months, an uncached cell reliably
    // means "this month is outside the task's range" - 0, not missing data.
    const monthlySpend = monthColumns.map(({ col, month }) => {
      const raw = cellText(row.getCell(col));
      return { month, amount: typeof raw === "number" ? raw : 0 };
    });

    const proposalCostNum = typeof proposalCost === "number" ? proposalCost : 0;
    const spentNum = typeof spent === "number" ? spent : 0;

    // The "Remaining" column is a shared Excel formula (+ProposalCost-Spent);
    // exceljs doesn't cache a result on the formula's master cell in a few
    // rows (5, 11, 16), so those come through as a formula object rather
    // than a number - computed directly rather than left as 0.
    let remainingNum;
    if (typeof remaining === "number") {
      remainingNum = remaining;
    } else {
      remainingNum = proposalCostNum - spentNum;
      anomalies.push(`Cost Schedule row ${r} (phase "${phase}"): Remaining had no cached formula result in source, computed as Proposal Cost - Spent`);
    }

    tasks.push({
      task_id: `cost-${tasks.length + 1}`,
      phase: String(phase).trim(),
      task: task ? String(task).trim() : null,
      party: party ? String(party).trim() : null,
      start_date: toIsoDate(startDate),
      end_date: toIsoDate(endDate),
      duration_days: typeof durationDays === "number" ? durationDays : null,
      budget: typeof budget === "number" ? budget : 0,
      proposal_cost: proposalCostNum,
      spent: spentNum,
      remaining: remainingNum,
      monthly_spend: monthlySpend,
      linked_items: null,
    });
  }

  return { tasks, anomalies };
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

  const ddFull = await importDdFullChecklist(workbook, team);
  console.log(`DD Full Checklist: imported ${ddFull.items.length} items`);

  const internalDd = await importDdRequestList(workbook, {
    sheetName: "Internal - DD Request List",
    sourceTab: "Internal DD Request List",
    idPrefix: "idd",
    lastRow: 97,
  });
  console.log(`Internal DD Request List: imported ${internalDd.items.length} items`);

  const externalDd = await importDdRequestList(workbook, {
    sheetName: "External - DD List",
    sourceTab: "External DD List",
    idPrefix: "xdd",
    lastRow: 90,
  });
  console.log(`External DD List: imported ${externalDd.items.length} items`);

  const hap = await importHapAssignmentChecklist(workbook);
  console.log(`HAP Assignment Checklist: imported ${hap.items.length} items`);

  const lender = await importLenderChecklist(workbook, team);
  console.log(`Lender Checklist: imported ${lender.items.length} items`);

  const allItems = [...ddFull.items, ...internalDd.items, ...externalDd.items, ...hap.items, ...lender.items];
  await writeItems(DEAL_ID, allItems);

  const costSchedule = await importCostSchedule(workbook);
  await writeCostSchedule(DEAL_ID, costSchedule.tasks);
  const totalBudget = costSchedule.tasks.reduce((sum, t) => sum + t.budget, 0);
  const totalSpent = costSchedule.tasks.reduce((sum, t) => sum + t.spent, 0);
  console.log(
    `Cost Schedule: imported ${costSchedule.tasks.length} tasks, total budget $${totalBudget.toLocaleString()}, total spent $${totalSpent.toLocaleString()}`
  );

  const hapConfig = await importHapConfig();
  await writeHapConfig(DEAL_ID, hapConfig);

  const lenderConfig = await importLenderConfig(workbook);
  await writeLenderConfig(DEAL_ID, lenderConfig);
  console.log(`Lender Info: lender_name = ${JSON.stringify(lenderConfig.lender_name)}`);

  const { config, anomalies: configAnomalies } = await importDealConfig(workbook);
  console.log(`Deal Setup: ${Object.entries(config).filter(([, v]) => v !== null).length}/${Object.keys(config).length} fields populated`);

  const allAnomalies = [
    ...ddFull.anomalies,
    ...internalDd.anomalies,
    ...externalDd.anomalies,
    ...hap.anomalies,
    ...lender.anomalies,
    ...costSchedule.anomalies,
    ...configAnomalies,
  ];
  if (allAnomalies.length) {
    console.log(`\n${allAnomalies.length} note(s) from import:`);
    for (const a of allAnomalies) console.log(`  - ${a}`);
  }

  const critical = ddFull.items.filter((i) => i.is_critical_path);
  console.log(`\nCritical path items flagged: ${critical.map((i) => i.item_id).join(", ")}`);

  const verify = await readItems(DEAL_ID);
  console.log(`\nVerification: ${verify.length} total items on disk for deal '${DEAL_ID}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
