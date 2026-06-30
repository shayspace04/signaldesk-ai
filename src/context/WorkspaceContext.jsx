import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { workspaces, DEFAULT_WORKSPACE_ID, getWorkspace } from "@/lib/workspaceConfig";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaceId, setWorkspaceId] = useState(() => {
    try {
      return localStorage.getItem("signaldesk-workspace") || DEFAULT_WORKSPACE_ID;
    } catch {
      return DEFAULT_WORKSPACE_ID;
    }
  });

  const setWorkspace = useCallback((id) => {
    setWorkspaceId(id);
    try {
      localStorage.setItem("signaldesk-workspace", id);
    } catch {}
  }, []);

  const workspace = useMemo(() => getWorkspace(workspaceId), [workspaceId]);

  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspace, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export { workspaces };
