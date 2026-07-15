// One-time migration: reads whatever's currently in backend/data/**.json
// (the old fs-based storage) and inserts it into the new SQLite database via
// store.js's write functions, so any deal data that already exists - real
// deals, not just deal-1's seed data - survives the storage migration.
//
// Safe to run multiple times: each deal's tables are fully replaced by the
// corresponding write*() call, not appended to, so re-running just re-syncs
// from the JSON files rather than duplicating rows. The JSON files
// themselves are never modified or deleted by this script.
//
// Usage: node scripts/migrate-json-to-sqlite.js

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  writeDealsRegistry,
  writeItems,
  writeDealConfig,
  writeDealTeam,
  writeHapConfig,
  writeLenderConfig,
  writeCostSchedule,
  saveReport,
} from "../store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DEALS_DIR = path.join(DATA_DIR, "deals");

async function readJsonIfExists(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function migrateDeal(dealId) {
  const dealDir = path.join(DEALS_DIR, dealId);
  const counts = {};

  const items = await readJsonIfExists(path.join(dealDir, "items.json"), []);
  await writeItems(dealId, items);
  counts.items = items.length;

  const dealConfig = await readJsonIfExists(path.join(dealDir, "deal_config.json"), null);
  if (dealConfig) await writeDealConfig(dealId, dealConfig);
  counts.deal_config = dealConfig ? 1 : 0;

  const dealTeam = await readJsonIfExists(path.join(dealDir, "deal_team.json"), []);
  await writeDealTeam(dealId, dealTeam);
  counts.deal_team = dealTeam.length;

  const hapConfig = await readJsonIfExists(path.join(dealDir, "hap_config.json"), null);
  if (hapConfig) await writeHapConfig(dealId, hapConfig);
  counts.hap_config = hapConfig ? 1 : 0;

  const lenderConfig = await readJsonIfExists(path.join(dealDir, "lender_config.json"), null);
  if (lenderConfig) await writeLenderConfig(dealId, lenderConfig);
  counts.lender_config = lenderConfig ? 1 : 0;

  const costSchedule = await readJsonIfExists(path.join(dealDir, "cost_schedule.json"), []);
  await writeCostSchedule(dealId, costSchedule);
  counts.cost_schedule = costSchedule.length;

  const reportsIndex = await readJsonIfExists(path.join(dealDir, "reports.json"), []);
  let reportsMigrated = 0;
  for (const entry of reportsIndex) {
    try {
      const content = await fs.readFile(path.join(dealDir, "reports", entry.filename), "utf-8");
      await saveReport(dealId, {
        id: entry.id,
        type: entry.type,
        label: entry.label,
        filename: entry.filename,
        content,
        generatedAt: entry.generated_at,
      });
      reportsMigrated++;
    } catch (err) {
      console.warn(`  ! could not migrate report ${entry.filename}: ${err.message}`);
    }
  }
  counts.reports = reportsMigrated;

  return counts;
}

async function main() {
  const registry = await readJsonIfExists(path.join(DATA_DIR, "deals.json"), []);
  if (registry.length === 0) {
    console.log("No deals.json found (or it's empty) - nothing to migrate.");
    return;
  }

  await writeDealsRegistry(registry);
  console.log(`Migrated deals registry: ${registry.length} deal(s)`);

  for (const deal of registry) {
    console.log(`\nMigrating '${deal.id}' (${deal.name})...`);
    const counts = await migrateDeal(deal.id);
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count}`);
    }
  }

  console.log("\nDone. The original JSON files were not modified.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
