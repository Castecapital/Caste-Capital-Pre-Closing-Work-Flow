import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import MasterDdTracker from "./pages/MasterDdTracker";
import CriticalPath from "./pages/CriticalPath";
import DdRequestList from "./pages/DdRequestList";
import HapChecklist from "./pages/HapChecklist";
import LenderChecklist from "./pages/LenderChecklist";
import CostSchedule from "./pages/CostSchedule";
import ItemDetail from "./pages/ItemDetail";
import DealTeam from "./pages/DealTeam";
import DealSetup from "./pages/DealSetup";
import HapInfo from "./pages/HapInfo";
import LenderInfo from "./pages/LenderInfo";
import Reports from "./pages/Reports";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="master-dd-tracker" element={<MasterDdTracker />} />
          <Route path="critical-path" element={<CriticalPath />} />
          <Route
            path="internal-dd-list"
            element={<DdRequestList sourceTab="Internal DD Request List" title="Internal DD Request List" />}
          />
          <Route
            path="external-dd-list"
            element={<DdRequestList sourceTab="External DD List" title="External DD List" />}
          />
          <Route path="hap-checklist" element={<HapChecklist />} />
          <Route path="lender-checklist" element={<LenderChecklist />} />
          <Route path="cost-schedule" element={<CostSchedule />} />
          <Route path="items/:itemId" element={<ItemDetail />} />
          <Route path="deal-team" element={<DealTeam />} />
          <Route path="deal-setup" element={<DealSetup />} />
          <Route path="hap-info" element={<HapInfo />} />
          <Route path="lender-info" element={<LenderInfo />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
