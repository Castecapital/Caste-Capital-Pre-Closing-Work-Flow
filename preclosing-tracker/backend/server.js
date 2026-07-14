import express from "express";
import cors from "cors";
import {
  readDealsRegistry,
  dealExists,
  readItems,
  writeItems,
  readDealConfig,
  writeDealConfig,
} from "./store.js";
import {
  validateItem,
  emptyDealConfig,
  DEAL_CONFIG_FIELDS,
  CATEGORIES,
  PHASES,
  STATUSES,
} from "./schema.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensures every /api/deals/:dealId/* route 404s cleanly instead of silently
// operating on a deal folder that doesn't exist yet.
async function requireDeal(req, res, next) {
  const { dealId } = req.params;
  if (!(await dealExists(dealId))) {
    return res.status(404).json({ error: `deal '${dealId}' not found` });
  }
  next();
}

app.get("/api/meta", (req, res) => {
  res.json({ categories: CATEGORIES, phases: PHASES, statuses: STATUSES });
});

app.get("/api/deals", async (req, res) => {
  const deals = await readDealsRegistry();
  res.json(deals);
});

app.get("/api/deals/:dealId/items", requireDeal, async (req, res) => {
  const items = await readItems(req.params.dealId);
  res.json(items);
});

app.post("/api/deals/:dealId/items", requireDeal, async (req, res) => {
  const errors = validateItem(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const items = await readItems(req.params.dealId);
  const nextId = items.reduce((max, i) => Math.max(max, i.item_id), 0) + 1;
  const now = new Date().toISOString().slice(0, 10);

  const item = {
    item_id: nextId,
    category: req.body.category,
    phase: req.body.phase,
    action_item: req.body.action_item,
    status: req.body.status,
    responsible_party: req.body.responsible_party,
    external_party: req.body.external_party ?? "",
    cc: req.body.cc ?? "",
    comment: req.body.comment ?? "",
    due_date: req.body.due_date ?? null,
    depends_on: req.body.depends_on ?? null,
    opened_date: req.body.opened_date ?? now,
    last_updated: now,
    is_critical_path: req.body.is_critical_path ?? false,
  };

  items.push(item);
  await writeItems(req.params.dealId, items);
  res.status(201).json(item);
});

app.put("/api/deals/:dealId/items/:id", requireDeal, async (req, res) => {
  const id = Number(req.params.id);
  const items = await readItems(req.params.dealId);
  const index = items.findIndex((i) => i.item_id === id);
  if (index === -1) return res.status(404).json({ error: "item not found" });

  const errors = validateItem(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const now = new Date().toISOString().slice(0, 10);
  items[index] = {
    ...items[index],
    ...req.body,
    item_id: id,
    last_updated: now,
  };

  await writeItems(req.params.dealId, items);
  res.json(items[index]);
});

app.delete("/api/deals/:dealId/items/:id", requireDeal, async (req, res) => {
  const id = Number(req.params.id);
  const items = await readItems(req.params.dealId);
  const filtered = items.filter((i) => i.item_id !== id);
  if (filtered.length === items.length) {
    return res.status(404).json({ error: "item not found" });
  }
  await writeItems(req.params.dealId, filtered);
  res.status(204).end();
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

app.listen(PORT, () => {
  console.log(`preclosing-tracker backend listening on http://localhost:${PORT}`);
});
