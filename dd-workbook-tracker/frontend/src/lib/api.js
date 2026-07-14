const DEAL_ID = "deal-1"; // TODO: replace with deal-switcher state (Step 9)

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

export function currentDealId() {
  return DEAL_ID;
}

export const api = {
  getDeals: () => request("/deals"),
  getItems: (dealId = DEAL_ID, sourceTab) =>
    request(`/deals/${dealId}/items${sourceTab ? `?source_tab=${encodeURIComponent(sourceTab)}` : ""}`),
  getItem: (itemId, dealId = DEAL_ID) => request(`/deals/${dealId}/items/${itemId}`),
  updateItem: (itemId, patch, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(patch) }),
  addComment: (itemId, comment, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}/comments`, { method: "POST", body: JSON.stringify(comment) }),
  linkItems: (itemId, targetItemId, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/items/${itemId}/link`, {
      method: "POST",
      body: JSON.stringify({ target_item_id: targetItemId }),
    }),
  getDealConfig: (dealId = DEAL_ID) => request(`/deals/${dealId}/deal-config`),
  updateDealConfig: (patch, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/deal-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getDealTeam: (dealId = DEAL_ID, q) =>
    request(`/deals/${dealId}/deal-team${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getHapConfig: (dealId = DEAL_ID) => request(`/deals/${dealId}/hap-config`),
  updateHapConfig: (patch, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/hap-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getLenderConfig: (dealId = DEAL_ID) => request(`/deals/${dealId}/lender-config`),
  updateLenderConfig: (patch, dealId = DEAL_ID) =>
    request(`/deals/${dealId}/lender-config`, { method: "PUT", body: JSON.stringify(patch) }),
  getCostSchedule: (dealId = DEAL_ID) => request(`/deals/${dealId}/cost-schedule`),
  getCostTask: (taskId, dealId = DEAL_ID) => request(`/deals/${dealId}/cost-schedule/${taskId}`),
  getMeta: () => request("/meta"),
};
