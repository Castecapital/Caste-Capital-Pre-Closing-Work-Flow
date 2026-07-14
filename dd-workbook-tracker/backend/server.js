import express from "express";
import cors from "cors";
import {
  readDealsRegistry,
  dealExists,
  readItems,
  writeItems,
  readDealConfig,
  writeDealConfig,
  readDealTeam,
  writeDealTeam,
  readHapConfig,
  writeHapConfig,
} from "./store.js";
import {
  validateItem,
  validateDdFullChecklistItem,
  validateDdRequestListItem,
  validateHapItem,
  emptyDealConfig,
  emptyHapConfig,
  DEAL_CONFIG_FIELDS,
  HAP_CONFIG_FIELDS,
  SOURCE_TABS,
  STATUSES,
  CATEGORIES,
  PHASES,
  DEPARTMENTS,
  today,
} from "./schema.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

async function requireDeal(req, res, next) {
  const { dealId } = req.params;
  if (!(await dealExists(dealId))) {
    return res.status(404).json({ error: `deal '${dealId}' not found` });
  }
  next();
}

function validatorFor(sourceTab) {
  if (sourceTab === "DD Full Checklist") return validateDdFullChecklistItem;
  if (sourceTab === "Internal DD Request List" || sourceTab === "External DD List") return validateDdRequestListItem;
  if (sourceTab === "HAP Assignment Checklist") return validateHapItem;
  return validateItem;
}

app.get("/api/meta", (req, res) => {
  res.json({ sourceTabs: SOURCE_TABS, statuses: STATUSES, categories: CATEGORIES, phases: PHASES, departments: DEPARTMENTS });
});

app.get("/api/deals", async (req, res) => {
  const deals = await readDealsRegistry();
  res.json(deals);
});

app.get("/api/deals/:dealId/items", requireDeal, async (req, res) => {
  const items = await readItems(req.params.dealId);
  const { source_tab } = req.query;
  const filtered = source_tab ? items.filter((i) => i.source_tab === source_tab) : items;
  res.json(filtered);
});

app.get("/api/deals/:dealId/items/:itemId", requireDeal, async (req, res) => {
  const items = await readItems(req.params.dealId);
  const item = items.find((i) => i.item_id === req.params.itemId);
  if (!item) return res.status(404).json({ error: "item not found" });
  res.json(item);
});

app.post("/api/deals/:dealId/items", requireDeal, async (req, res) => {
  const validate = validatorFor(req.body.source_tab);
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const items = await readItems(req.params.dealId);
  const now = today();

  const item = {
    ...req.body,
    external_party: req.body.external_party ?? null,
    comments: req.body.comments ?? [],
    linked_items: req.body.linked_items ?? null,
    opened_date: req.body.opened_date ?? now,
    last_updated: now,
    history: [],
  };

  items.push(item);
  await writeItems(req.params.dealId, items);
  res.status(201).json(item);
});

app.put("/api/deals/:dealId/items/:itemId", requireDeal, async (req, res) => {
  const { itemId } = req.params;
  const items = await readItems(req.params.dealId);
  const index = items.findIndex((i) => i.item_id === itemId);
  if (index === -1) return res.status(404).json({ error: "item not found" });

  const current = items[index];
  const validate = validatorFor(req.body.source_tab ?? current.source_tab);
  const errors = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const now = today();
  const history = [...(current.history ?? [])];

  if (req.body.status !== undefined && req.body.status !== current.status) {
    history.push({ field: "status", old_value: current.status, new_value: req.body.status, timestamp: now });
  }

  const updated = {
    ...current,
    ...req.body,
    item_id: itemId,
    last_updated: now,
    history,
  };

  items[index] = updated;
  await writeItems(req.params.dealId, items);
  res.json(updated);
});

// Comments append-only: a dedicated endpoint keeps the "comments changed"
// history entry accurate (the generic PUT above would otherwise need to
// diff array contents to know whether a comment was actually added).
app.post("/api/deals/:dealId/items/:itemId/comments", requireDeal, async (req, res) => {
  const { itemId } = req.params;
  const { author, text } = req.body;
  if (!text) return res.status(400).json({ error: "comment text is required" });

  const items = await readItems(req.params.dealId);
  const index = items.findIndex((i) => i.item_id === itemId);
  if (index === -1) return res.status(404).json({ error: "item not found" });

  const now = today();
  const comment = { author: author ?? "", text, timestamp: now };
  const current = items[index];

  const updated = {
    ...current,
    comments: [...(current.comments ?? []), comment],
    last_updated: now,
    history: [...(current.history ?? []), { field: "comments", old_value: null, new_value: text, timestamp: now }],
  };

  items[index] = updated;
  await writeItems(req.params.dealId, items);
  res.status(201).json(updated);
});

// Confirms a suggested cross-tab link (Step 3): the frontend computes
// document-name similarity client-side and only calls this when the user
// clicks "Link" - nothing gets linked automatically. Bidirectional so either
// item's detail view shows the relationship.
app.post("/api/deals/:dealId/items/:itemId/link", requireDeal, async (req, res) => {
  const { itemId } = req.params;
  const { target_item_id } = req.body;
  if (!target_item_id) return res.status(400).json({ error: "target_item_id is required" });

  const items = await readItems(req.params.dealId);
  const a = items.find((i) => i.item_id === itemId);
  const b = items.find((i) => i.item_id === target_item_id);
  if (!a || !b) return res.status(404).json({ error: "item not found" });

  const now = today();
  const link = (item, otherId) => {
    const existing = item.linked_items ?? [];
    if (existing.includes(otherId)) return item;
    return { ...item, linked_items: [...existing, otherId], last_updated: now };
  };

  const updatedItems = items.map((i) => {
    if (i.item_id === itemId) return link(i, target_item_id);
    if (i.item_id === target_item_id) return link(i, itemId);
    return i;
  });

  await writeItems(req.params.dealId, updatedItems);
  res.json({
    a: updatedItems.find((i) => i.item_id === itemId),
    b: updatedItems.find((i) => i.item_id === target_item_id),
  });
});

app.get("/api/deals/:dealId/deal-config", requireDeal, async (req, res) => {
  const config = await readDealConfig(req.params.dealId);
  res.json(config ?? emptyDealConfig());
});

app.put("/api/deals/:dealId/deal-config", requireDeal, async (req, res) => {
  const existing = (await readDealConfig(req.params.dealId)) ?? emptyDealConfig();
  const updated = { ...existing };
  for (const field of DEAL_CONFIG_FIELDS) {
    if (field in req.body) updated[field] = req.body[field] || null;
  }
  await writeDealConfig(req.params.dealId, updated);
  res.json(updated);
});

app.get("/api/deals/:dealId/hap-config", requireDeal, async (req, res) => {
  const config = await readHapConfig(req.params.dealId);
  res.json(config ?? emptyHapConfig());
});

app.put("/api/deals/:dealId/hap-config", requireDeal, async (req, res) => {
  const existing = (await readHapConfig(req.params.dealId)) ?? emptyHapConfig();
  const updated = { ...existing };
  for (const field of HAP_CONFIG_FIELDS) {
    if (field in req.body) updated[field] = req.body[field] || null;
  }
  await writeHapConfig(req.params.dealId, updated);
  res.json(updated);
});

app.get("/api/deals/:dealId/deal-team", requireDeal, async (req, res) => {
  const team = await readDealTeam(req.params.dealId);
  const { q } = req.query;
  if (!q) return res.json(team);
  const needle = q.toLowerCase();
  res.json(
    team.filter(
      (m) =>
        m.name?.toLowerCase().includes(needle) ||
        m.role?.toLowerCase().includes(needle) ||
        m.organization?.toLowerCase().includes(needle)
    )
  );
});

app.put("/api/deals/:dealId/deal-team", requireDeal, async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "body must be an array of {role, organization, name}" });
  await writeDealTeam(req.params.dealId, req.body);
  res.json(req.body);
});

app.listen(PORT, () => {
  console.log(`dd-workbook-tracker backend listening on http://localhost:${PORT}`);
});
