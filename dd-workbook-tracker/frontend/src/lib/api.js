const STORAGE_KEY = "dd-workbook-tracker:currentDealId";

// A `let` binding, not `const` - default parameter expressions below
// (`dealId = CURRENT_DEAL_ID`) are re-evaluated on every call, so switching
// deals here immediately changes what every api.* call without an explicit
// dealId talks to, no prop-drilling or context provider needed.
let CURRENT_DEAL_ID = localStorage.getItem(STORAGE_KEY) || "deal-1";

export function getCurrentDealId() {
  return CURRENT_DEAL_ID;
}

export function setCurrentDealId(dealId) {
  CURRENT_DEAL_ID = dealId;
  localStorage.setItem(STORAGE_KEY, dealId);
}

async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.errors?.join(", ") || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getDeals: () => request("/deals"),
  createDeal: (name) => request("/deals", { method: "POST", body: JSON.stringify({ name }) }),
  getItems: (sourceTab, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/items${sourceTab ? `?source_tab=${encodeURIComponent(sourceTab)}` : ""}`),
  getItem: (itemId, dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/items/${itemId}`),
  updateItem: (itemId, patch, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(patch) }),
  addComment: (itemId, comment, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}/comments`, { method: "POST", body: JSON.stringify(comment) }),
  linkItems: (itemId, targetItemId, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}/link`, {
      method: "POST",
      body: JSON.stringify({ target_item_id: targetItemId }),
    }),
  getDealConfig: (dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/deal-config`),
  updateDealConfig: (patch, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/deal-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getDealTeam: (dealId = CURRENT_DEAL_ID, q) =>
    request(`/deals/${dealId}/deal-team${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getHapConfig: (dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/hap-config`),
  updateHapConfig: (patch, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/hap-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getLenderConfig: (dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/lender-config`),
  updateLenderConfig: (patch, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/lender-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getCostSchedule: (dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/cost-schedule`),
  getCostTask: (taskId, dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/cost-schedule/${taskId}`),
  getReports: (dealId = CURRENT_DEAL_ID) => request(`/deals/${dealId}/reports`),
  generateWeeklyAgenda: (dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/reports/weekly-agenda`, { method: "POST" }),
  generateCsv: (sourceTab, dealId = CURRENT_DEAL_ID) =>
    request(`/deals/${dealId}/reports/csv/${encodeURIComponent(sourceTab)}`, { method: "POST" }),
  reportDownloadUrl: (reportId, dealId = CURRENT_DEAL_ID) => `/api/deals/${dealId}/reports/${reportId}/download`,
  getMeta: () => request("/meta"),
};
