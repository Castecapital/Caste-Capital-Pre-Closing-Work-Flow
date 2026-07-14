import { api } from "../lib/api";
import ConfigPanel from "../components/ConfigPanel";

const FIELD_LABELS = {
  deal_name: "Deal Name",
  loi_date: "LOI Date",
  psa_execution_date: "PSA Execution Date",
  initial_deposit_date: "Initial Deposit Date",
  rollover_ts_date: "Rollover TS Date",
  dd_exit_deposit_date: "DD Exit Deposit Date",
  projected_hud_approval_date: "Projected HUD Approval Date",
  projected_closing_date: "Projected Closing Date",
  outside_closing_date: "Outside Closing Date",
};

const FIELD_TYPES = {
  deal_name: "text",
  loi_date: "date",
  psa_execution_date: "date",
  initial_deposit_date: "date",
  rollover_ts_date: "date",
  dd_exit_deposit_date: "date",
  projected_hud_approval_date: "date",
  projected_closing_date: "date",
  outside_closing_date: "date",
};

export default function DealSetup() {
  return (
    <ConfigPanel
      title="Deal Setup"
      description="All fields are optional — leave anything blank and the rest of the app still works."
      fieldLabels={FIELD_LABELS}
      fieldTypes={FIELD_TYPES}
      load={api.getDealConfig}
      save={api.updateDealConfig}
    />
  );
}
