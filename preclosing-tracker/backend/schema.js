export const CATEGORIES = [
  "Debt Financing",
  "Legal - Transaction",
  "Physical DD + CapEx Plan",
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

export const STATUSES = ["Open", "Closed", "Blocked", "At Risk"];

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

export function validateItem(item, { partial = false } = {}) {
  const errors = [];
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

  if (!partial || item.status !== undefined) {
    if (item.status !== undefined && !STATUSES.includes(item.status)) {
      errors.push(`status must be one of: ${STATUSES.join(", ")}`);
    }
  }
  required("status");

  required("action_item");
  required("responsible_party");
  required("opened_date");

  if (item.depends_on !== undefined && item.depends_on !== null && !Array.isArray(item.depends_on)) {
    errors.push("depends_on must be an array of item_id or null");
  }

  if (item.is_critical_path !== undefined && typeof item.is_critical_path !== "boolean") {
    errors.push("is_critical_path must be a boolean");
  }

  return errors;
}
