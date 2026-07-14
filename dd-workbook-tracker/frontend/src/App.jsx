import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import MasterDdTracker from "./pages/MasterDdTracker";
import DealTeam from "./pages/DealTeam";
import DealSetup from "./pages/DealSetup";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MasterDdTracker />} />
          <Route path="deal-team" element={<DealTeam />} />
          <Route path="deal-setup" element={<DealSetup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
