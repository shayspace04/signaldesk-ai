import { AnimatePresence } from "framer-motion";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

import Dashboard from "../../pages/Dashboard";
import Tickets from "../../pages/Tickets";
import ApprovalDesk from "../../pages/ApprovalDesk";
import Incidents from "../../pages/Incidents";
import Signals from "../../pages/Signals";
import Knowledge from "../../pages/Knowledge";
import Analytics from "../../pages/Analytics";
import Settings from "../../pages/Settings";
import CommandPalette from "../common/CommandPalette";

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-zinc-950 text-white">

      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">

        <Header />

        <main className="flex-1 overflow-auto p-8">

          <AnimatePresence mode="wait">

            <Routes
              location={location}
              key={location.pathname}
            >

              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/tickets"
                element={<Tickets />}
              />

              <Route
                path="/approval"
                element={<ApprovalDesk />}
              />

              <Route
                path="/incidents"
                element={<Incidents />}
              />

              <Route
                path="/signals"
                element={<Signals />}
              />

              <Route
                path="/knowledge"
                element={<Knowledge />}
              />

              <Route
                path="/analytics"
                element={<Analytics />}
              />

              <Route
                path="/settings"
                element={<Settings />}
              />

            </Routes>

          </AnimatePresence>

        </main>

      </div>
      
      <CommandPalette />

    </div>
  );
}