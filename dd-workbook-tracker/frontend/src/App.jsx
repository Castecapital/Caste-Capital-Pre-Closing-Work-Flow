import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import MasterDdTracker from "./pages/MasterDdTracker";
import DdRequestList from "./pages/DdRequestList";
import ItemDetail from "./pages/ItemDetail";
import DealTeam from "./pages/DealTeam";
import DealSetup from "./pages/DealSetup";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MasterDdTracker />} />
          <Route
            path="internal-dd-list"
            element={<DdRequestList sourceTab="Internal DD Request List" title="Internal DD Request List" />}
          />
          <Route
            path="external-dd-list"
            element={<DdRequestList sourceTab="External DD List" title="External DD List" />}
          />
          <Route path="items/:itemId" element={<ItemDetail />} />
          <Route path="deal-team" element={<DealTeam />} />
          <Route path="deal-setup" element={<DealSetup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
