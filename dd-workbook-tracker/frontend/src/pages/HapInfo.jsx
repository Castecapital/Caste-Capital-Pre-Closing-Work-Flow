import { api } from "../lib/api";
import ConfigPanel from "../components/ConfigPanel";

const FIELD_LABELS = {
  name: "Name",
  address: "Address",
  contract: "Contract",
  new_owner: "New Owner",
  seller: "Seller",
  fha_number: "FHA Number",
  pbca: "PBCA",
  hud_ae: "HUD AE",
};

export default function HapInfo() {
  return (
    <ConfigPanel
      title="HAP General Info"
      description="General information for the HAP Assignment Checklist. All fields are optional."
      fieldLabels={FIELD_LABELS}
      load={api.getHapConfig}
      save={api.updateHapConfig}
    />
  );
}
