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
