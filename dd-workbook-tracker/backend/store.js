import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "data");
export const DEALS_DIR = path.join(DATA_DIR, "deals");
export const DEALS_REGISTRY_FILE = path.join(DATA_DIR, "deals.json");

// Serializes writes per file so concurrent requests can't interleave and
// corrupt the JSON (there's no DB transaction to lean on here).
const writeQueues = new Map();

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  const prior = writeQueues.get(file) || Promise.resolve();
  const next = prior
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2));
      await fs.rename(tmp, file);
    });
  writeQueues.set(file, next);
  return next;
}

function dealDir(dealId) {
  return path.join(DEALS_DIR, dealId);
}

function itemsFile(dealId) {
  return path.join(dealDir(dealId), "items.json");
}

function dealConfigFile(dealId) {
  return path.join(dealDir(dealId), "deal_config.json");
}

function dealTeamFile(dealId) {
  return path.join(dealDir(dealId), "deal_team.json");
}

function hapConfigFile(dealId) {
  return path.join(dealDir(dealId), "hap_config.json");
}

function lenderConfigFile(dealId) {
  return path.join(dealDir(dealId), "lender_config.json");
}

function costScheduleFile(dealId) {
  return path.join(dealDir(dealId), "cost_schedule.json");
}

function reportsDir(dealId) {
  return path.join(dealDir(dealId), "reports");
}

function reportsIndexFile(dealId) {
  return path.join(dealDir(dealId), "reports.json");
}

function reportFile(dealId, filename) {
  return path.join(reportsDir(dealId), filename);
}

export async function readDealsRegistry() {
  return readJson(DEALS_REGISTRY_FILE, []);
}

export async function writeDealsRegistry(deals) {
  return writeJson(DEALS_REGISTRY_FILE, deals);
}

export async function dealExists(dealId) {
  const deals = await readDealsRegistry();
  return deals.some((d) => d.id === dealId);
}

export async function readItems(dealId) {
  return readJson(itemsFile(dealId), []);
}

export async function writeItems(dealId, items) {
  return writeJson(itemsFile(dealId), items);
}

export async function readDealConfig(dealId) {
  return readJson(dealConfigFile(dealId), null);
}

export async function writeDealConfig(dealId, config) {
  return writeJson(dealConfigFile(dealId), config);
}

export async function readDealTeam(dealId) {
  return readJson(dealTeamFile(dealId), []);
}

export async function writeDealTeam(dealId, team) {
  return writeJson(dealTeamFile(dealId), team);
}

export async function readHapConfig(dealId) {
  return readJson(hapConfigFile(dealId), null);
}

export async function writeHapConfig(dealId, config) {
  return writeJson(hapConfigFile(dealId), config);
}

export async function readLenderConfig(dealId) {
  return readJson(lenderConfigFile(dealId), null);
}

export async function writeLenderConfig(dealId, config) {
  return writeJson(lenderConfigFile(dealId), config);
}

export async function readCostSchedule(dealId) {
  return readJson(costScheduleFile(dealId), []);
}

export async function writeCostSchedule(dealId, tasks) {
  return writeJson(costScheduleFile(dealId), tasks);
}

// Reports (Step 10) are saved permanently, not just handed to the browser
// as a one-off download - the generated file lives in reports/<filename>
// and an entry is appended to reports.json so the Reports page can list
// and re-download anything generated in the past, not just the most recent
// run.
export async function readReportsIndex(dealId) {
  return readJson(reportsIndexFile(dealId), []);
}

export async function saveReport(dealId, { id, type, label, filename, content, generatedAt }) {
  await fs.mkdir(reportsDir(dealId), { recursive: true });
  await fs.writeFile(reportFile(dealId, filename), content, "utf-8");

  const index = await readReportsIndex(dealId);
  const entry = { id, type, label, filename, generated_at: generatedAt };
  await writeJson(reportsIndexFile(dealId), [entry, ...index]);
  return entry;
}

export async function readReportContent(dealId, filename) {
  return fs.readFile(reportFile(dealId, filename), "utf-8");
}
