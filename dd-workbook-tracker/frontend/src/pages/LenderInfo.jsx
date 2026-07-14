import { api } from "../lib/api";
import ConfigPanel from "../components/ConfigPanel";

const FIELD_LABELS = {
  lender_name: "Lender Name",
};

export default function LenderInfo() {
  return (
    <ConfigPanel
      title="Lender Info"
      description="General information for the Lender Checklist. Optional."
      fieldLabels={FIELD_LABELS}
      load={api.getLenderConfig}
      save={api.updateLenderConfig}
    />
  );
}
