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
