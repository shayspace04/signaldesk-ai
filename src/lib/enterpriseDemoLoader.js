import client from "@/lib/lemmaClient";
import { ENTERPRISE_DEMO_WORKSPACES } from "@/data/enterpriseDemoDatasets";
import { emitRefresh } from "@/lib/refreshEvents";

export const DEMO_COMPLETE_EVENT = "signaldesk:enterprise-demo-complete";
export const DEMO_CLEAR_EVENT = "signaldesk:enterprise-demo-clear";

const BACKUP_PREFIX = "/backup/";
const TABLES_IN_ORDER = [
  "tickets",
  "signals",
  "incidents",
  "memory_entries",
  "audit_logs",
  "drafts",
  "ticket_incidents",
  "ticket_signals",
  "approvals",
  "user_roles",
  "d",
];
const DEMO_WS_IDS = ["yesmadam", "corally", "foxo", "zap", "binocs"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBackup(table) {
  const res = await fetch(`${BACKUP_PREFIX}${table}.json`);
  if (!res.ok) throw new Error(`Failed to fetch backup/${table}.json`);
  const data = await res.json();
  return data.items || data.records || data.data || [];
}

// Tables that have a workspaceId column (can filter by workspace)
const WS_TABLES = ["tickets", "signals", "incidents", "memory_entries", "audit_logs", "drafts", "ticket_incidents", "ticket_signals", "approvals", "user_roles"];

async function deleteByWorkspace() {
  let total = 0;
  for (const wsId of DEMO_WS_IDS) {
    for (const table of WS_TABLES) {
      let cursor;
      do {
        const filter = { field: "workspaceId", op: "eq", value: wsId };
        const args = { filters: [filter], limit: 200 };
        if (cursor) args.cursor = cursor;
        try {
          const page = await client.records.list(table, args);
          const items = page.items || page.records || page.data || [];
          for (const rec of items) {
            try { await client.records.delete(table, rec.id); total++; } catch { }
          }
          cursor = page.cursor || page.nextCursor || null;
        } catch { cursor = null; }
      } while (cursor);
    }
    // Also clear audit_logs by action prefix (catches entries without workspaceId from backend functions)
    const actionPrefixes = ["incident.", "manager.", "email.", "demo."];
    for (const prefix of actionPrefixes) {
      let cursor;
      do {
        const prefixFilter = { field: "action", op: "like", value: `${prefix}%` };
        // Only delete from demo workspaces: filter by details.workspaceId via a second pass
        const args = { filters: [prefixFilter], limit: 200 };
        if (cursor) args.cursor = cursor;
        try {
          const page = await client.records.list("audit_logs", args);
          const items = page.items || page.records || page.data || [];
          for (const rec of items) {
            const detailWs = rec.details?.workspaceId || rec.details?.workspace_id || rec.workspaceId;
            if (detailWs === wsId || DEMO_WS_IDS.includes(detailWs)) {
              try { await client.records.delete("audit_logs", rec.id); total++; } catch { }
            }
          }
          cursor = page.cursor || page.nextCursor || null;
        } catch { cursor = null; }
      } while (cursor);
    }
  }
  return total;
}

export async function clearEnterpriseDemo(onProgress) {
  const count = await deleteByWorkspace();
  window.dispatchEvent(new CustomEvent(DEMO_CLEAR_EVENT));
  emitRefresh();
  if (onProgress) onProgress(0, 0, `Cleared ${count} records`, 100);
  return count;
}

const AUTO_FIELDS = new Set(["number", "created_at", "updated_at", "user_id"]);

async function restoreTable(table, onProgress, wsName) {
  const records = await fetchBackup(table);
  let created = 0;
  for (const rec of records) {
    const fields = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!AUTO_FIELDS.has(k)) fields[k] = v;
    }
    try {
      await client.records.create(table, fields);
      created++;
    } catch (e2) {
      if (e2?.code === "DATASTORE_CONFLICT" || e2?.message?.includes("already exists")) {
        created++;
      } else {
        console.error(`[restore] FAILED create ${table}/${rec.id}: ${e2?.message || e2}`);
      }
    }
  }
  if (onProgress) onProgress(null, wsName, created, records.length, `Restored ${table}`, 0);
  return { table, created, total: records.length };
}

async function sendIncidentAlerts(workspaceId, onProgress) {
  let emailsSent = 0;
  let cursor;
  do {
    const filter = { field: "workspaceId", op: "eq", value: workspaceId };
    const args = { filters: [filter], limit: 100 };
    if (cursor) args.cursor = cursor;
    try {
      const page = await client.records.list("incidents", args);
      const items = page.items || page.records || page.data || [];
      for (const inc of items) {
        const sev = inc.severity || "";
        if ((sev === "high" || sev === "urgent") && !inc.email_sent) {
          try {
            await client.functions.run("escalate_incident", {
              input: {
                incident_id: inc.id,
                new_severity: sev,
                workspace_name: inc.workspaceName || workspaceId,
                dashboard_link: `${window.location.origin}/incidents`,
              },
            });
            emailsSent++;
          } catch (e) {
            console.warn(`[alerts] Failed for ${inc.id}: ${e.message}`);
          }
        }
      }
      cursor = page.cursor || page.nextCursor || null;
    } catch { cursor = null; }
  } while (cursor);
  if (emailsSent > 0 && onProgress) onProgress(null, workspaceId, 0, 0, `Sent ${emailsSent} Gmail alerts`, 0);
  return emailsSent;
}

export async function loadEnterpriseWorkspace(workspaceId, onProgress) {
  const wsName = workspaceId;
  let totalRecords = 0;
  let totalCreated = 0;

  for (const table of TABLES_IN_ORDER) {
    const result = await restoreTable(table, onProgress, wsName);
    totalRecords += result.total;
    totalCreated += result.created;
    await sleep(10);
  }

  if (onProgress) onProgress(null, wsName, 0, 0, "Sending Gmail alerts...", 0);
  await sendIncidentAlerts(workspaceId, onProgress);

  emitRefresh();

  return {
    workspaceName: wsName,
    ticketsCreated: totalCreated,
    totalRecords,
  };
}

export async function launchEnterpriseDemo(onProgress) {
  const results = [];

  for (let wi = 0; wi < DEMO_WS_IDS.length; wi++) {
    const wsId = DEMO_WS_IDS[wi];
    if (onProgress) onProgress(wsId, wsId, 0, 0, `Loading ${wsId}...`, Math.round((wi / DEMO_WS_IDS.length) * 100));
    try {
      const r = await loadEnterpriseWorkspace(wsId, onProgress);
      results.push(r);
    } catch (err) {
      results.push({ workspaceName: wsId, error: err.message });
    }
  }

  emitRefresh();
  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: results }));
  return results;
}
