// Shared workflow-item model (Step 1). Every tab's items extend this shape;
// tab-specific fields (category/phase for the Master DD Tracker, department
// for the DD request lists, section_number for HAP, etc.) live alongside
// these on the same object rather than in a separate table, since we're on
// flat JSON files with no joins.

export const SOURCE_TABS = [
  "DD Full Checklist",
  "Internal DD Request List",
  "External DD List",
  "HAP Assignment Checklist",
  "Lender Checklist",
  "Cost Schedule",
];

// "Deleted" is a real status preserved from the source file (rows explicitly
// marked Deleted keep their original numbering/reference instead of being
// dropped) - filtered out of default views, not discarded from the data.
export const STATUSES = ["Open", "Closed", "Blocked", "At Risk", "Deleted"];

// Master DD Tracker (DD Full Checklist tab) taxonomy.
export const CATEGORIES = [
  "Equity Financing",
  "Debt Financing",
  "Legal - Transaction",
  "Physical DD + CapEx Plan",
  "Property Management DD",
  "Property Financial DD",
  "Asset Management",
];

export const PHASES = [
  "PSA Execution",
  "Active Due Diligence",
  "HUD Approval Track",
  "JV Entity Formation",
  "Pre-Closing Confirmation",
  "Closing",
  "Post-Closing",
];

// Internal/External DD Request List taxonomy - derived from this workbook's
// section header rows, not an inherent property of the schema, but fixed
// enough across the two DD list tabs to enforce (Step 9's New Deal template
// reuses this same taxonomy for a blank deal).
export const DEPARTMENTS = [
  "Leasing / Marketing",
  "Development",
  "Prop Mgmt",
  "Legal/Ins/Tax",
  "Accounting",
];

export const DEAL_CONFIG_FIELDS = [
  "deal_name",
  "loi_date",
  "psa_execution_date",
  "initial_deposit_date",
  "rollover_ts_date",
  "dd_exit_deposit_date",
  "projected_hud_approval_date",
  "projected_closing_date",
  "outside_closing_date",
];

export function emptyDealConfig() {
  const config = {};
  for (const field of DEAL_CONFIG_FIELDS) config[field] = null;
  return config;
}

export const HAP_CONFIG_FIELDS = [
  "name",
  "address",
  "contract",
  "new_owner",
  "seller",
  "fha_number",
  "pbca",
  "hud_ae",
];

export function emptyHapConfig() {
  const config = {};
  for (const field of HAP_CONFIG_FIELDS) config[field] = null;
  return config;
}

// HAP Assignment Checklist section topics - carried down from the source's
// section header rows into every lettered sub-item's proposed_owner_info
// field (named for Section 1, but the field is really "what this section
// pertains to," which varies per section - see import script notes).
export const HAP_SECTION_TOPICS = [
  "Proposed Owner Information",
  "Management Company Information",
  "Project Finances and Affordability",
  "Property Information",
];

export const LENDER_CONFIG_FIELDS = ["lender_name"];

export function emptyLenderConfig() {
  const config = {};
  for (const field of LENDER_CONFIG_FIELDS) config[field] = null;
  return config;
}

// Lender Checklist entity_group taxonomy. The source's "PRIORITY CREDIT
// ITEMS FOR RATE LOCK" section has 4 entity-type sub-groups; the rest of the
// sheet (property-level, insurance/legal, closing items) is a different kind
// of grouping entirely but uses the same item columns, so it's folded into
// this same field rather than left unmodeled. "Supplemental Requests" is the
// separate document list tucked into later columns of the same sheet.
export const ENTITY_GROUPS = [
  "Borrowing Entity",
  "Key Principal / Guarantor",
  "Principal Individuals",
  "Principal Entities",
  "Operating Statements",
  "Insurance/Legal/Third-Party",
  "Other",
  "Supplemental Requests",
];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Only the fields every tab shares are enforced strictly here; tab-specific
// required fields (action_item for Master DD Tracker, document for the DD
// request lists, etc.) are validated by each tab's own import/route code
// since the shape genuinely differs by source_tab.
export function validateItem(item, { partial = false } = {}) {
  const errors = [];
  const required = (field) => {
    if (!partial && (item[field] === undefined || item[field] === null || item[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  if (!partial || item.source_tab !== undefined) {
    if (item.source_tab !== undefined && !SOURCE_TABS.includes(item.source_tab)) {
      errors.push(`source_tab must be one of: ${SOURCE_TABS.join(", ")}`);
    }
  }
  required("source_tab");

  if (!partial || item.status !== undefined) {
    if (item.status !== undefined && !STATUSES.includes(item.status)) {
      errors.push(`status must be one of: ${STATUSES.join(", ")}`);
    }
  }
  required("status");

  required("responsible_party");
  required("opened_date");

  if (item.linked_items !== undefined && item.linked_items !== null && !Array.isArray(item.linked_items)) {
    errors.push("linked_items must be an array of item_id or null");
  }

  if (item.comments !== undefined && !Array.isArray(item.comments)) {
    errors.push("comments must be an array");
  }

  if (item.history !== undefined && !Array.isArray(item.history)) {
    errors.push("history must be an array");
  }

  return errors;
}

export function validateDdFullChecklistItem(item, { partial = false } = {}) {
  const errors = validateItem(item, { partial });
  const required = (field) => {
    if (!partial && (item[field] === undefined || item[field] === null || item[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  if (!partial || item.category !== undefined) {
    if (item.category !== undefined && !CATEGORIES.includes(item.category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
    }
  }
  required("category");

  if (!partial || item.phase !== undefined) {
    if (item.phase !== undefined && !PHASES.includes(item.phase)) {
      errors.push(`phase must be one of: ${PHASES.join(", ")}`);
    }
  }
  required("phase");

  required("action_item");

  return errors;
}

export function validateDdRequestListItem(item, { partial = false } = {}) {
  const errors = validateItem(item, { partial });
  const required = (field) => {
    if (!partial && (item[field] === undefined || item[field] === null || item[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  required("document");

  // Deleted rows keep a null department (there's no real department for a
  // row whose content was blanked out in the source) - only validate the
  // enum when a department is actually present.
  if (item.department !== undefined && item.department !== null && !DEPARTMENTS.includes(item.department)) {
    errors.push(`department must be one of: ${DEPARTMENTS.join(", ")}`);
  }
  if (!partial && item.department === undefined && item.status !== "Deleted") {
    errors.push("department is required");
  }

  return errors;
}

export function validateHapItem(item, { partial = false } = {}) {
  const errors = validateItem(item, { partial });
  const required = (field) => {
    if (!partial && (item[field] === undefined || item[field] === null || item[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  required("section_number");
  required("sub_item_letter");
  required("item_description");
  required("proposed_owner_info");

  return errors;
}

export function validateLenderItem(item, { partial = false } = {}) {
  const errors = validateItem(item, { partial });
  const required = (field) => {
    if (!partial && (item[field] === undefined || item[field] === null || item[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  required("document");

  if (!partial || item.entity_group !== undefined) {
    if (item.entity_group !== undefined && !ENTITY_GROUPS.includes(item.entity_group)) {
      errors.push(`entity_group must be one of: ${ENTITY_GROUPS.join(", ")}`);
    }
  }
  required("entity_group");

  return errors;
}

// Cost Schedule (Step 6) is structurally a budget/Gantt tracker, not a
// document checklist - it deliberately does NOT extend the shared
// workflow-item model (no status, no comments, no source_tab). It keeps its
// own linked_items array so other tabs' items can still point at a specific
// cost-tracker task (e.g. a DD Full Checklist item linking to the task that
// funds it), which is the only piece it shares with the workflow-item shape.
export function validateCostTask(task, { partial = false } = {}) {
  const errors = [];
  const required = (field) => {
    if (!partial && (task[field] === undefined || task[field] === null || task[field] === "")) {
      errors.push(`${field} is required`);
    }
  };

  required("phase");
  required("start_date");
  required("end_date");

  for (const field of ["duration_days", "budget", "proposal_cost", "spent", "remaining"]) {
    if (!partial && (task[field] === undefined || task[field] === null)) {
      errors.push(`${field} is required`);
    } else if (task[field] !== undefined && task[field] !== null && typeof task[field] !== "number") {
      errors.push(`${field} must be a number`);
    }
  }

  if (task.monthly_spend !== undefined && !Array.isArray(task.monthly_spend)) {
    errors.push("monthly_spend must be an array of {month, amount}");
  }

  if (task.linked_items !== undefined && task.linked_items !== null && !Array.isArray(task.linked_items)) {
    errors.push("linked_items must be an array of item_id or null");
  }

  return errors;
}
