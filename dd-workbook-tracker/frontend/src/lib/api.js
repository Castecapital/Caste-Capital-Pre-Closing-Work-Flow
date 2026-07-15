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

// Same-origin by default (blank), which is all the Vite dev proxy or a
// single reverse-proxied production origin needs. Only set when the
// frontend is deployed on a different origin than the backend (e.g. a
// static host + a separately deployed Node service) - see DEPLOYMENT.md.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(path, options) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error || body.errors?.join(", ") || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// Step 2: single shared-password gate. checkSession() is used at app
// startup to decide whether to show the login screen - it hits a route
// that's protected but has no side effects, so a 401 just means "not
// logged in yet" rather than a real error.
export const auth = {
  login: (password) => request("/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/logout", { method: "POST" }),
  checkSession: () => request("/session"),
};

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
  reportDownloadUrl: (reportId, dealId = CURRENT_DEAL_ID) => `${API_BASE}/api/deals/${dealId}/reports/${reportId}/download`,
  getMeta: () => request("/meta"),
};
