-- Initial schema (Postgres migration from SQLite). Every child table carries
-- deal_id as a foreign key (ON DELETE CASCADE) rather than separate
-- files/databases per deal, so "New Deal" cloning and multi-deal isolation
-- work the same way they did under SQLite.
--
-- comments/linked_items/history/monthly_spend use JSONB (not TEXT) so they
-- can be queried/indexed later if needed, not just stored as opaque blobs.
--
-- Date-only fields use DATE rather than TIMESTAMP - they're always plain
-- "YYYY-MM-DD" values (from schema.js's today() or date-only imports), never
-- a specific time of day. outside_date_raw stays TEXT: unlike outside_date,
-- it can hold non-date raw text carried over from the source workbook.
-- reports.generated_at is the one genuine timestamp (new Date().toISOString()
-- at generation time), so it's TIMESTAMPTZ.

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at DATE,
  -- Insertion-order marker (SQLite's implicit rowid had no Postgres
  -- equivalent). Only ever set on INSERT, never touched by the upsert in
  -- writeDealsRegistry, so a deal's registry position doesn't shift when
  -- it's later updated.
  seq BIGSERIAL
);

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  source_tab TEXT,
  status TEXT,
  responsible_party TEXT,
  external_party TEXT,
  comments JSONB,
  linked_items JSONB,
  opened_date DATE,
  last_updated DATE,
  history JSONB,
  category TEXT,
  phase TEXT,
  action_item TEXT,
  outside_date_raw TEXT,
  outside_date DATE,
  is_internal BOOLEAN,
  is_critical_path BOOLEAN,
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
  loi_date DATE,
  psa_execution_date DATE,
  initial_deposit_date DATE,
  rollover_ts_date DATE,
  dd_exit_deposit_date DATE,
  projected_hud_approval_date DATE,
  projected_closing_date DATE,
  outside_closing_date DATE
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
  id SERIAL PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  role TEXT,
  organization TEXT,
  name TEXT
);

CREATE TABLE IF NOT EXISTS cost_schedule (
  id BIGSERIAL,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  phase TEXT,
  task TEXT,
  party TEXT,
  start_date DATE,
  end_date DATE,
  duration_days DOUBLE PRECISION,
  budget DOUBLE PRECISION,
  proposal_cost DOUBLE PRECISION,
  spent DOUBLE PRECISION,
  remaining DOUBLE PRECISION,
  monthly_spend JSONB,
  linked_items JSONB,
  PRIMARY KEY (deal_id, task_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT,
  label TEXT,
  filename TEXT,
  generated_at TIMESTAMPTZ,
  content TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_deal ON items(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_deal ON deal_team(deal_id);
CREATE INDEX IF NOT EXISTS idx_cost_schedule_deal ON cost_schedule(deal_id);
CREATE INDEX IF NOT EXISTS idx_reports_deal ON reports(deal_id);
