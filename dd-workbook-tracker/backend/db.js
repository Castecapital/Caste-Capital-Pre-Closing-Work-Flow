// SQLite storage (Step 1 of the SQLite migration). One connection, opened
// once and reused - better-sqlite3 is synchronous, so there's no pool to
// manage. The file path is configurable via DATABASE_PATH specifically so a
// deployment platform can point it at a mounted persistent volume; without
// that, anything written here is lost on redeploy on platforms with
// ephemeral filesystems (Render, Railway, etc.) - see DEPLOYMENT.md.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, "data", "app.db");
const DATABASE_PATH = process.env.DATABASE_PATH || DEFAULT_PATH;

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

export const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    source_tab TEXT,
    status TEXT,
    responsible_party TEXT,
    external_party TEXT,
    comments TEXT,        -- JSON array
    linked_items TEXT,    -- JSON array or null
    opened_date TEXT,
    last_updated TEXT,
    history TEXT,         -- JSON array
    category TEXT,
    phase TEXT,
    action_item TEXT,
    outside_date_raw TEXT,
    outside_date TEXT,
    is_internal INTEGER,
    is_critical_path INTEGER,
    div_folder TEXT,
    document TEXT,
    department TEXT,
    section_number TEXT,
    sub_item_letter TEXT,
    item_description TEXT,
    proposed_owner_info TEXT,
    entity_group TEXT,
    PRIMARY KEY (deal_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS deal_config (
    deal_id TEXT PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
    deal_name TEXT,
    loi_date TEXT,
    psa_execution_date TEXT,
    initial_deposit_date TEXT,
    rollover_ts_date TEXT,
    dd_exit_deposit_date TEXT,
    projected_hud_approval_date TEXT,
    projected_closing_date TEXT,
    outside_closing_date TEXT
  );

  CREATE TABLE IF NOT EXISTS hap_config (
    deal_id TEXT PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    contract TEXT,
    new_owner TEXT,
    seller TEXT,
    fha_number TEXT,
    pbca TEXT,
    hud_ae TEXT
  );

  CREATE TABLE IF NOT EXISTS lender_config (
    deal_id TEXT PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
    lender_name TEXT
  );

  CREATE TABLE IF NOT EXISTS deal_team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    role TEXT,
    organization TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS cost_schedule (
    deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    phase TEXT,
    task TEXT,
    party TEXT,
    start_date TEXT,
    end_date TEXT,
    duration_days REAL,
    budget REAL,
    proposal_cost REAL,
    spent REAL,
    remaining REAL,
    monthly_spend TEXT,   -- JSON array of {month, amount}
    linked_items TEXT,    -- JSON array or null
    PRIMARY KEY (deal_id, task_id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    type TEXT,
    label TEXT,
    filename TEXT,
    generated_at TEXT,
    content TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_items_deal ON items(deal_id);
  CREATE INDEX IF NOT EXISTS idx_deal_team_deal ON deal_team(deal_id);
  CREATE INDEX IF NOT EXISTS idx_cost_schedule_deal ON cost_schedule(deal_id);
  CREATE INDEX IF NOT EXISTS idx_reports_deal ON reports(deal_id);
`);
