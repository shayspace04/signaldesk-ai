import { AnimatePresence } from "framer-motion";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

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
import Notifications from "../../pages/Notifications";
import EnterpriseDemo from "../../pages/EnterpriseDemo";
import CommandPalette from "../common/CommandPalette";
import AtAGlance from "../common/AtAGlance";
import ErrorBoundary from "../common/ErrorBoundary";
import useAtAGlance from "@/hooks/useAtAGlance";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";

function Page({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function LayoutContent() {
  const location = useLocation();
  const atAGlance = useAtAGlance();
  const { workspace } = useWorkspace();

  return (
    <div className="flex h-screen bg-white dark:bg-[#09090B] text-primary" style={{ "--accent": workspace.accent, "--accent-dark": workspace.accentDark }}>

      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-8 py-8">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
                <Route path="/notifications" element={<Page><Notifications /></Page>} />
                <Route path="/tickets" element={<Page><Tickets /></Page>} />
                <Route path="/approval" element={<Page><ApprovalDesk /></Page>} />
                <Route path="/incidents" element={<Page><Incidents /></Page>} />
                <Route path="/signals" element={<Page><Signals /></Page>} />
                <Route path="/knowledge" element={<Page><Knowledge /></Page>} />
                <Route path="/analytics" element={<Page><Analytics /></Page>} />
                <Route path="/audit" element={<Page><Audit /></Page>} />
                <Route path="/settings" element={<Page><Settings /></Page>} />
                <Route path="/enterprise-demo" element={<Page><EnterpriseDemo /></Page>} />
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
