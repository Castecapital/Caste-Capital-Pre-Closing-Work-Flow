// Step 9: "New Deal" cloning. deal-1 (the RAP UP workbook) doubles as the
// standard template - its 5 checklist tabs' taxonomy (category, phase,
// department, section_number/proposed_owner_info, entity_group) represents
// Caste's recurring HUD Section 8 acquisition process, reusable deal to
// deal, even though the specific text was written for one real deal.
//
// Cost Schedule is deliberately NOT templated: unlike the checklist tabs,
// its content (dollar figures, dates, specific tasks) is pure per-deal
// budget data with no reusable "taxonomy" the way category/department/
// entity_group are - a new deal starts with an empty cost schedule.
// Deal Team is the same story (a new deal's team isn't Caste's last deal's
// team) and isn't one of the "fresh, blank config files" the spec names
// anyway - it starts as an empty roster.

import {
  readItems,
  writeItems,
  readDealsRegistry,
  writeDealsRegistry,
  writeDealConfig,
  writeHapConfig,
  writeLenderConfig,
  writeDealTeam,
  writeCostSchedule,
} from "./store.js";
import { emptyDealConfig, emptyHapConfig, emptyLenderConfig, today } from "./schema.js";

export const TEMPLATE_SOURCE_DEAL_ID = "deal-1";

// Resets everything genuinely specific to how deal-1's real DD process
// played out, while keeping the taxonomy fields that make an item what
// *kind* of task it is (category/phase/department/section/entity_group,
// action_item/document/item_description/task text, is_critical_path,
// is_internal). phase resets to "PSA Execution" regardless of deal-1's
// current phase, since a fresh deal starts at the beginning of the
// process, not wherever deal-1 happens to be tracked today.
function templateItem(sourceItem, creationDate) {
  const cloned = {
    ...sourceItem,
    status: "Open",
    responsible_party: "Unassigned",
    external_party: null,
    comments: [],
    linked_items: null,
    opened_date: creationDate,
    last_updated: creationDate,
    history: [],
  };

  if (cloned.phase !== undefined) cloned.phase = "PSA Execution";
  if (cloned.outside_date !== undefined) cloned.outside_date = null;
  if (cloned.outside_date_raw !== undefined) cloned.outside_date_raw = null;

  return cloned;
}

function nextDealId(deals) {
  let n = deals.length + 1;
  const ids = new Set(deals.map((d) => d.id));
  while (ids.has(`deal-${n}`)) n++;
  return `deal-${n}`;
}

export async function createDealFromTemplate(name) {
  const deals = await readDealsRegistry();
  const dealId = nextDealId(deals);
  const creationDate = today();

  // The deal's own row must exist before any child-table writes: SQLite
  // (Step 1 migration) enforces deal_id as a foreign key on items,
  // cost_schedule, deal_team, deal_config, hap_config, and lender_config,
  // so registering the deal first isn't just tidy ordering, it's required -
  // writing a child row for a deal_id that doesn't exist yet in `deals`
  // fails the FK constraint.
  const entry = { id: dealId, name, created_at: creationDate };
  await writeDealsRegistry([...deals, entry]);

  const sourceItems = await readItems(TEMPLATE_SOURCE_DEAL_ID);
  const templatedItems = sourceItems.map((i) => templateItem(i, creationDate));

  await writeItems(dealId, templatedItems);
  await writeCostSchedule(dealId, []);
  await writeDealTeam(dealId, []);

  const dealConfig = emptyDealConfig();
  dealConfig.deal_name = name;
  await writeDealConfig(dealId, dealConfig);
  await writeHapConfig(dealId, emptyHapConfig());
  await writeLenderConfig(dealId, emptyLenderConfig());

  return entry;
}
