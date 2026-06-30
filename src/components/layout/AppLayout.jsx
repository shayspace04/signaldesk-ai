import { AnimatePresence } from "framer-motion";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Sidebar from "./Sidebar";

import Dashboard from "../../pages/Dashboard";
import Tickets from "../../pages/Tickets";
import ApprovalDesk from "../../pages/ApprovalDesk";
import Incidents from "../../pages/Incidents";
import Signals from "../../pages/Signals";
import Knowledge from "../../pages/Knowledge";
import Analytics from "../../pages/Analytics";
import Audit from "../../pages/Audit";
import Settings from "../../pages/Settings";
import CommandPalette from "../common/CommandPalette";
import AtAGlance from "../common/AtAGlance";
import useAtAGlance from "@/hooks/useAtAGlance";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";

function LayoutContent() {
  const location = useLocation();
  const atAGlance = useAtAGlance();
  const { workspace } = useWorkspace();

  return (
    <div className="flex h-screen bg-white text-zinc-900" style={{ "--accent": workspace.accent, "--accent-dark": workspace.accentDark }}>

      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <Routes
                location={location}
                key={location.pathname}
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/approval" element={<ApprovalDesk />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/signals" element={<Signals />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <CommandPalette />
      <AtAGlance open={atAGlance.open} setOpen={atAGlance.setOpen} />

    </div>
  );
}

export default function AppLayout() {
  return (
    <WorkspaceProvider>
      <LayoutContent />
    </WorkspaceProvider>
  );
}
