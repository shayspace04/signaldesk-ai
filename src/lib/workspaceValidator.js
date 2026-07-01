import client from "@/lib/lemmaClient";

const WORKSPACE_IDS = ["signaldesk", "corally", "foxo", "binocs", "zap", "yesmadam"];
const TABLES = ["tickets", "signals", "incidents", "drafts", "audit_logs", "approvals", "memory_entries"];

export async function validateWorkspaceSwitch(workspaceId) {
  const results = {};
  for (const table of TABLES) {
    const filters = workspaceId === "signaldesk" ? undefined : [{ field: "workspaceId", op: "eq", value: workspaceId }];
    try {
      const res = await client.records.list(table, { filters, limit: 200 });
      results[table] = (res.items || res.data || []).length;
    } catch {
      results[table] = 0;
    }
  }
  return results;
}

export async function validateAllWorkspaces() {
  const all = {};
  for (const ws of WORKSPACE_IDS) {
    all[ws] = await validateWorkspaceSwitch(ws);
  }
  return all;
}

export function workspaceSummaryTable(all) {
  const header = ["Workspace"].concat(TABLES.map(t => t.charAt(0).toUpperCase() + t.slice(1)));
  const lines = [header.join(" | ")];
  lines.push("-".repeat(header.join(" | ").length));
  for (const [ws, counts] of Object.entries(all)) {
    const row = [ws].concat(TABLES.map(t => String(counts[t] || 0)));
    lines.push(row.join(" | "));
  }
  return lines.join("\n");
}
