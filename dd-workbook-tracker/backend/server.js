import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
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
  readLenderConfig,
  writeLenderConfig,
  readCostSchedule,
  writeCostSchedule,
  readReportsIndex,
  saveReport,
  readReportContent,
} from "./store.js";
import { createDealFromTemplate } from "./dealTemplate.js";
import { generateWeeklyAgenda, generateCsv, csvSourceTabs } from "./reports.js";
import {
  validateItem,
  validateDdFullChecklistItem,
  validateDdRequestListItem,
  validateHapItem,
  validateLenderItem,
  validateCostTask,
  emptyDealConfig,
  emptyHapConfig,
  emptyLenderConfig,
  DEAL_CONFIG_FIELDS,
  HAP_CONFIG_FIELDS,
  LENDER_CONFIG_FIELDS,
  SOURCE_TABS,
  STATUSES,
  CATEGORIES,
  PHASES,
  DEPARTMENTS,
  ENTITY_GROUPS,
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
  if (sourceTab === "Lender Checklist") return validateLenderItem;
  return validateItem;
}

// Deal Setup, HAP Info, and Lender Info are all the same shape: a flat,
// nullable key/value config scoped to the deal. Registers GET/PUT for one.
function registerConfigRoutes(path, { read, write, fields, empty }) {
  app.get(`/api/deals/:dealId/${path}`, requireDeal, async (req, res) => {
    const config = await read(req.params.dealId);
    res.json(config ?? empty());
  });

  app.put(`/api/deals/:dealId/${path}`, requireDeal, async (req, res) => {
    const existing = (await read(req.params.dealId)) ?? empty();
    const updated = { ...existing };
    for (const field of fields) {
      if (field in req.body) updated[field] = req.body[field] || null;
    }
    await write(req.params.dealId, updated);
    res.json(updated);
  });
}

app.get("/api/meta", (req, res) => {
  res.json({
    sourceTabs: SOURCE_TABS,
    statuses: STATUSES,
    categories: CATEGORIES,
    phases: PHASES,
    departments: DEPARTMENTS,
    entityGroups: ENTITY_GROUPS,
  });
});

app.get("/api/deals", async (req, res) => {
  const deals = await readDealsRegistry();
  res.json(deals);
});

// "New Deal" (Step 9): clones deal-1's checklist taxonomy into a fresh deal
// with everything deal-specific reset - see dealTemplate.js for exactly
// what's kept vs. cleared.
app.post("/api/deals", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
  const entry = await createDealFromTemplate(name.trim());
  res.status(201).json(entry);
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

// Confirms a suggested or manually-picked cross-tab link (Step 3 + Step 6):
// the frontend computes document-name similarity (Step 3) or lets the user
// search-and-pick (Step 6, for linking to a Cost Schedule task) and only
// calls this on explicit confirmation - nothing gets linked automatically.
// Bidirectional so either side's detail view shows the relationship. The
// target can live in either items.json or cost_schedule.json (Cost Schedule
// tasks don't extend the shared workflow-item shape but do carry their own
// linked_items array for exactly this purpose).
app.post("/api/deals/:dealId/items/:itemId/link", requireDeal, async (req, res) => {
  const { itemId } = req.params;
  const { target_item_id } = req.body;
  if (!target_item_id) return res.status(400).json({ error: "target_item_id is required" });

  const items = await readItems(req.params.dealId);
  const sourceIndex = items.findIndex((i) => i.item_id === itemId);
  if (sourceIndex === -1) return res.status(404).json({ error: "item not found" });

  const now = today();
  const link = (entity, otherId) => {
    const existing = entity.linked_items ?? [];
    if (existing.includes(otherId)) return entity;
    return { ...entity, linked_items: [...existing, otherId], last_updated: now };
  };

  const targetInItems = items.findIndex((i) => i.item_id === target_item_id);
  if (targetInItems !== -1) {
    items[sourceIndex] = link(items[sourceIndex], target_item_id);
    items[targetInItems] = link(items[targetInItems], itemId);
    await writeItems(req.params.dealId, items);
    return res.json({ a: items[sourceIndex], b: items[targetInItems] });
  }

  const costTasks = await readCostSchedule(req.params.dealId);
  const targetTaskIndex = costTasks.findIndex((t) => t.task_id === target_item_id);
  if (targetTaskIndex === -1) return res.status(404).json({ error: "target item not found" });

  items[sourceIndex] = link(items[sourceIndex], target_item_id);
  costTasks[targetTaskIndex] = link(costTasks[targetTaskIndex], itemId);
  await Promise.all([writeItems(req.params.dealId, items), writeCostSchedule(req.params.dealId, costTasks)]);
  res.json({ a: items[sourceIndex], b: costTasks[targetTaskIndex] });
});

app.get("/api/deals/:dealId/cost-schedule", requireDeal, async (req, res) => {
  const tasks = await readCostSchedule(req.params.dealId);
  res.json(tasks);
});

app.get("/api/deals/:dealId/cost-schedule/:taskId", requireDeal, async (req, res) => {
  const tasks = await readCostSchedule(req.params.dealId);
  const task = tasks.find((t) => t.task_id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "task not found" });
  res.json(task);
});

app.put("/api/deals/:dealId/cost-schedule/:taskId", requireDeal, async (req, res) => {
  const { taskId } = req.params;
  const tasks = await readCostSchedule(req.params.dealId);
  const index = tasks.findIndex((t) => t.task_id === taskId);
  if (index === -1) return res.status(404).json({ error: "task not found" });

  const errors = validateCostTask(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  tasks[index] = { ...tasks[index], ...req.body, task_id: taskId };
  await writeCostSchedule(req.params.dealId, tasks);
  res.json(tasks[index]);
});

// Step 10: generated reports are saved to disk (not just handed to the
// browser as a one-off download), so the team can come back and re-download
// any past weekly agenda or CSV export instead of losing it the moment the
// browser download completes.
app.get("/api/deals/:dealId/reports", requireDeal, async (req, res) => {
  const index = await readReportsIndex(req.params.dealId);
  res.json(index);
});

app.post("/api/deals/:dealId/reports/weekly-agenda", requireDeal, async (req, res) => {
  const dealId = req.params.dealId;
  const [items, dealConfig] = await Promise.all([readItems(dealId), readDealConfig(dealId)]);
  const content = generateWeeklyAgenda(items, dealConfig?.deal_name);

  const generatedAt = new Date().toISOString();
  const filename = `weekly-agenda-${generatedAt.slice(0, 19).replace(/[:T]/g, "-")}.md`;
  const entry = await saveReport(dealId, {
    id: randomUUID(),
    type: "weekly-agenda",
    label: "Weekly Agenda",
    filename,
    content,
    generatedAt,
  });

  res.status(201).json({ ...entry, content });
});

app.post("/api/deals/:dealId/reports/csv/:sourceTab", requireDeal, async (req, res) => {
  const dealId = req.params.dealId;
  const sourceTab = decodeURIComponent(req.params.sourceTab);
  if (!csvSourceTabs().includes(sourceTab)) {
    return res.status(400).json({ error: `no CSV export defined for source_tab "${sourceTab}"` });
  }

  const items = await readItems(dealId);
  const content = generateCsv(items, sourceTab);

  const generatedAt = new Date().toISOString();
  const slug = sourceTab.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `${slug}-${generatedAt.slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  const entry = await saveReport(dealId, {
    id: randomUUID(),
    type: "csv",
    label: `${sourceTab} Export`,
    filename,
    content,
    generatedAt,
  });

  res.status(201).json({ ...entry, content });
});

app.get("/api/deals/:dealId/reports/:reportId/download", requireDeal, async (req, res) => {
  const index = await readReportsIndex(req.params.dealId);
  const entry = index.find((r) => r.id === req.params.reportId);
  if (!entry) return res.status(404).json({ error: "report not found" });

  const content = await readReportContent(req.params.dealId, entry.filename);
  res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
  res.setHeader("Content-Type", entry.type === "csv" ? "text/csv" : "text/markdown");
  res.send(content);
});

registerConfigRoutes("deal-config", {
  read: readDealConfig,
  write: writeDealConfig,
  fields: DEAL_CONFIG_FIELDS,
  empty: emptyDealConfig,
});

registerConfigRoutes("hap-config", {
  read: readHapConfig,
  write: writeHapConfig,
  fields: HAP_CONFIG_FIELDS,
  empty: emptyHapConfig,
});

registerConfigRoutes("lender-config", {
  read: readLenderConfig,
  write: writeLenderConfig,
  fields: LENDER_CONFIG_FIELDS,
  empty: emptyLenderConfig,
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
