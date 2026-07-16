import client from "@/lib/lemmaClient";
import { ENTERPRISE_DEMO_WORKSPACES } from "@/data/enterpriseDemoDatasets";
import { emitRefresh } from "@/lib/refreshEvents";

export const DEMO_COMPLETE_EVENT = "signaldesk:enterprise-demo-complete";

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
const WS_TABLES = ["tickets", "signals", "incidents", "memory_entries", "audit_logs", "drafts"];

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
  }
  return total;
}

export async function clearEnterpriseDemo(onProgress) {
  const count = await deleteByWorkspace();
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
    } catch (e) {
      const isConflict = e?.code === "DATASTORE_CONFLICT" || e?.message?.includes?.("already exists");
      if (isConflict) {
        created++;
      } else {
        console.warn(`[restore] ${table}/${rec.id}: ${e.message}${e?.code ? ` (${e.code})` : ""}`);
      }
    }
  }
  if (onProgress) onProgress(null, wsName, created, records.length, `Restored ${table}`, 0);
  return { table, created, total: records.length };
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
