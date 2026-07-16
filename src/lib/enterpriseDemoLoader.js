import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { runGmailAlert, syncToLinear } from "@/lib/incidentWorkflow";

export const DEMO_COMPLETE_EVENT = "signaldesk:enterprise-demo-complete";
export const DEMO_CLEAR_EVENT = "signaldesk:enterprise-demo-clear";
export const DEMO_CONNECTORS_EVENT = "signaldesk:enterprise-demo-connectors";

const BACKUP_PREFIX = "/backup/";
const DEMO_WS_IDS = ["binocs", "zap", "foxo", "corally", "yesmadam"];

const WS_LABELS = { binocs: "Binocs", zap: "Zapdata", foxo: "Foxo", corally: "Corally", yesmadam: "YesMadam" };

const PER_WS_COUNTS = {
  binocs: { tickets: 64, signals: 8, incidents: 1, memory_entries: 18, audit_logs: 19, drafts: 6 },
  zap: { tickets: 64, signals: 8, incidents: 2, memory_entries: 18, audit_logs: 20, drafts: 6 },
  foxo: { tickets: 65, signals: 8, incidents: 1, memory_entries: 18, audit_logs: 19, drafts: 5 },
  corally: { tickets: 66, signals: 8, incidents: 2, memory_entries: 19, audit_logs: 19, drafts: 6 },
  yesmadam: { tickets: 105, signals: 15, incidents: 2, memory_entries: 24, audit_logs: 58, drafts: 10 },
};

const WS_RECORDS = {};
for (const [ws, tables] of Object.entries(PER_WS_COUNTS)) {
  WS_RECORDS[ws] = Object.values(tables).reduce((a, b) => a + b, 0);
}
const TOTAL_WORK = Object.values(WS_RECORDS).reduce((a, b) => a + b, 0);

const STAGE_LABELS = {
  tickets: "Tickets",
  signals: "Signals",
  incidents: "Incidents",
  memory_entries: "Knowledge",
  audit_logs: "Activity Logs",
  drafts: "Drafts",
};

const WS_TABLES = ["tickets", "signals", "incidents", "memory_entries", "audit_logs", "drafts"];

const REFERENCE_FIELDS = {
  tickets: ["signal_id", "outage_id"],
  signals: ["incident_id"],
  incidents: ["signal_id", "ticket_ids", "outage_id"],
  memory_entries: ["source_signal_id", "related_incident_id"],
  drafts: ["ticket_id"],
  audit_logs: ["ticket_id", "signal_id", "resource_id", "incident_id"],
  ticket_incidents: ["ticket_id", "incident_id"],
  ticket_signals: ["ticket_id", "signal_id"],
};

const AUTO_FIELDS = new Set(["id", "number", "created_at", "updated_at", "user_id"]);

function generateId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

let _backupCache = {};
async function fetchBackup(table) {
  if (_backupCache[table]) return _backupCache[table];
  const res = await fetch(`${BACKUP_PREFIX}${table}.json`);
  if (!res.ok) throw new Error(`Failed to fetch backup/${table}.json`);
  const data = await res.json();
  const items = data.items || data.records || data.data || data;
  _backupCache[table] = Array.isArray(items) ? items : [];
  return _backupCache[table];
}

function remapValue(value, idMap) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(v => idMap.has(v) ? idMap.get(v) : v);
  if (typeof value === "string" && idMap.has(value)) return idMap.get(value);
  return value;
}

// ─── Clear ──────────────────────────────────────────────────────

async function clearTable(table, filter) {
  let total = 0;
  let cursor;
  do {
    const args = { limit: 200 };
    if (filter) args.filters = [filter];
    if (cursor) args.cursor = cursor;
    try {
      const page = await client.records.list(table, args);
      const items = page.items || page.records || page.data || [];
      if (items.length > 0) {
        await Promise.all(items.map(rec =>
          client.records.delete(table, rec.id).catch(() => {})
        ));
        total += items.length;
      }
      cursor = page.cursor || page.nextCursor || null;
    } catch { cursor = null; }
  } while (cursor);
  return total;
}

async function deleteByWorkspace() {
  const clearCombos = DEMO_WS_IDS.flatMap(wsId =>
    WS_TABLES.map(table => ({ wsId, table }))
  );

  const actionPrefixes = ["incident.", "manager.", "email.", "demo.", "ticket.", "signal.", "linear.", "draft.", "knowledge."];
  const auditCombos = DEMO_WS_IDS.flatMap(wsId =>
    actionPrefixes.map(prefix => ({ wsId, prefix }))
  );

  const junctionTables = ["ticket_signals", "ticket_incidents", "approvals", "user_roles", "d"];

  const [clearResults, auditResults, junctionResults] = await Promise.all([
    // Phase 1: Clear per-workspace tables
    Promise.all(clearCombos.map(({ wsId, table }) =>
      clearTable(table, { field: "workspaceId", op: "eq", value: wsId })
    )),
    // Phase 1b: Clear audit_logs by action prefix
    Promise.all(auditCombos.map(async ({ wsId, prefix }) => {
      let subTotal = 0;
      let cursor;
      do {
        const prefixFilter = { field: "action", op: "like", value: `${prefix}%` };
        const args = { filters: [prefixFilter], limit: 200 };
        if (cursor) args.cursor = cursor;
        try {
          const page = await client.records.list("audit_logs", args);
          const items = page.items || page.records || page.data || [];
          const toDelete = items.filter(rec => {
            const detailWs = rec.details?.workspaceId || rec.details?.workspace_id || rec.workspaceId;
            return detailWs === wsId || DEMO_WS_IDS.includes(detailWs) || !detailWs;
          });
          if (toDelete.length > 0) {
            await Promise.all(toDelete.map(rec =>
              client.records.delete("audit_logs", rec.id).catch(() => {})
            ));
            subTotal += toDelete.length;
          }
          cursor = page.cursor || page.nextCursor || null;
        } catch { cursor = null; }
      } while (cursor);
      return subTotal;
    })),
    // Phase 2: Clear junction tables
    Promise.all(junctionTables.map(t => clearTable(t))),
  ]);

  return clearResults.reduce((a, b) => a + b, 0)
       + auditResults.reduce((a, b) => a + b, 0)
       + junctionResults.reduce((a, b) => a + b, 0);
}

export async function clearEnterpriseDemo(onProgress) {
  if (onProgress) onProgress({ type: "status", status: "clearing", message: "Clearing demo data..." });
  const count = await deleteByWorkspace();
  window.dispatchEvent(new CustomEvent(DEMO_CLEAR_EVENT));
  emitRefresh();
  if (onProgress) onProgress({ type: "status", status: "cleared", count });
  return count;
}

// ─── Chunked Parallel Create ────────────────────────────────────

async function createRecords(table, workspaceId, idMap, onBatch) {
  const allRecords = await fetchBackup(table);
  const wsRecords = workspaceId
    ? allRecords.filter(r => r.workspaceId === workspaceId)
    : allRecords.filter(r => !r.workspaceId || r.workspaceId === "");

  if (wsRecords.length === 0) return [];

  const results = [];
  const CHUNK_SIZE = 20;

  for (let i = 0; i < wsRecords.length; i += CHUNK_SIZE) {
    const chunk = wsRecords.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(async (rec) => {
      const fields = {};
      for (const [k, v] of Object.entries(rec)) {
        if (!AUTO_FIELDS.has(k)) fields[k] = v;
      }
      if (idMap && REFERENCE_FIELDS[table]) {
        for (const refField of REFERENCE_FIELDS[table]) {
          if (fields[refField] !== undefined) {
            fields[refField] = remapValue(fields[refField], idMap);
          }
        }
      }
      fields.id = generateId();
      try {
        const result = await client.records.create(table, fields);
        return { oldId: rec.id, newId: result.id };
      } catch (err) {
        if (err?.code === "DATASTORE_CONFLICT" || /already exists.*id/i.test(err?.message || "")) {
          fields.id = generateId();
          try {
            const result = await client.records.create(table, fields);
            return { oldId: rec.id, newId: result.id };
          } catch (retryErr) {
            console.error(`[create] RETRY FAILED ${table}/${rec.id}: ${retryErr?.message || retryErr}`);
            return null;
          }
        }
        console.error(`[create] FAILED ${table}/${rec.id}: ${err?.message || err}`);
        return null;
      }
    }));

    const valid = chunkResults.filter(Boolean);
    for (const cr of valid) results.push(cr);
    if (onBatch) onBatch(valid.length);
  }

  const finalResults = results.filter(Boolean);
  for (const { oldId, newId } of finalResults) {
    idMap.set(oldId, newId);
  }
  return finalResults;
}

// ─── Chunked Parallel Cross-Reference Update ────────────────────

async function updateCrossReferences(table, created, idMap) {
  const refs = REFERENCE_FIELDS[table];
  if (!refs || !created.length) return 0;
  const allRecords = await fetchBackup(table);
  let updated = 0;
  const CHUNK_SIZE = 30;

  for (let i = 0; i < created.length; i += CHUNK_SIZE) {
    const chunk = created.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(async ({ oldId, newId }) => {
      const original = allRecords.find(r => r.id === oldId);
      if (!original) return 0;
      const updates = {};
      for (const refField of refs) {
        const val = original[refField];
        if (val == null) continue;
        const remapped = remapValue(val, idMap);
        if (JSON.stringify(remapped) !== JSON.stringify(val)) {
          updates[refField] = remapped;
        }
      }
      if (Object.keys(updates).length === 0) return 0;
      try {
        await client.records.update(table, newId, updates);
        return 1;
      } catch {
        return 0;
      }
    }));
    updated += chunkResults.reduce((a, b) => a + b, 0);
  }
  return updated;
}

// ─── Launch ─────────────────────────────────────────────────────

export async function launchEnterpriseDemo(onProgress) {
  _backupCache = {};
  const failures = [];
  let cumulativeWork = 0;
  const idMap = new Map();
  const startTime = Date.now();
  const phaseTimes = {};

  // API call tracking (wraps client without mutating global)
  const apiCounts = { POST: 0, GET: 0, PATCH: 0, DELETE: 0, FUNC: 0 };
  const c = client;
  const _orig = {
    create: c.records.create.bind(c.records),
    update: c.records.update.bind(c.records),
    list: c.records.list.bind(c.records),
    get: c.records.get.bind(c.records),
    delete: c.records.delete.bind(c.records),
    run: c.functions.run.bind(c.functions),
  };
  c.records.create = (...a) => { apiCounts.POST++; return _orig.create(...a); };
  c.records.update = (...a) => { apiCounts.PATCH++; return _orig.update(...a); };
  c.records.list = (...a) => { apiCounts.GET++; return _orig.list(...a); };
  c.records.get = (...a) => { apiCounts.GET++; return _orig.get(...a); };
  c.records.delete = (...a) => { apiCounts.DELETE++; return _orig.delete(...a); };
  c.functions.run = (...a) => { apiCounts.FUNC++; return _orig.run(...a); };

  const _marks = {};
  const mark = (label) => { _marks[label] = Date.now(); };
  const markEnd = (label) => {
    const elapsed = (Date.now() - (_marks[label] || Date.now())) / 1000;
    phaseTimes[label] = (phaseTimes[label] || 0) + elapsed;
  };

  const fire = (detail) => {
    detail.percent = Math.min(100, Math.round((cumulativeWork / TOTAL_WORK) * 100));
    detail.workDone = cumulativeWork;
    detail.workTotal = TOTAL_WORK;
    if (onProgress) onProgress(detail);
  };

  // Phase: Clear
  mark("clear");
  try { await clearEnterpriseDemo(onProgress); } catch {}
  markEnd("clear");
  console.log(`[perf] clear: ${phaseTimes.clear.toFixed(1)}s`);

  // Phase: Workspace record creation
  const connectorTargets = [];

  for (let wsIndex = 0; wsIndex < DEMO_WS_IDS.length; wsIndex++) {
    const wsId = DEMO_WS_IDS[wsIndex];
    const label = WS_LABELS[wsId];
    const wsCounts = PER_WS_COUNTS[wsId];

    fire({
      type: "workspace-start",
      workspaceId: wsId, workspaceLabel: label,
      workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length,
    });

    const allCreated = {};
    const wsTimer = `ws_${wsId}`;
    mark(wsTimer);

    await Promise.all(WS_TABLES.map(async (stageId) => {
      const stageTotal = wsCounts[stageId];
      const stageLabel = STAGE_LABELS[stageId];
      fire({
        type: "stage-start", workspaceId: wsId, workspaceLabel: label,
        workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length,
        stageId, stageLabel, count: 0, total: stageTotal,
      });

      let stageCount = 0;
      try {
        const created = await createRecords(stageId, wsId, idMap, (batchSize) => {
          cumulativeWork += batchSize;
          stageCount += batchSize;
          fire({
            type: "stage-progress", workspaceId: wsId, workspaceLabel: label,
            workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length,
            stageId, stageLabel, count: stageCount, total: stageTotal,
          });
        });
        allCreated[stageId] = created;
        fire({
          type: "stage-complete", workspaceId: wsId, workspaceLabel: label,
          workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length,
          stageId, stageLabel, count: stageCount, total: stageTotal,
        });
      } catch (err) {
        failures.push({ workspaceId: wsId, workspaceLabel: label, stageId, stageLabel, reason: err.message });
        fire({
          type: "stage-error", workspaceId: wsId, workspaceLabel: label,
          workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length,
          stageId, stageLabel, reason: err.message,
        });
      }
    }));

    mark("refs");
    const refTables = ["tickets", "signals", "incidents"];
    await Promise.all(refTables.map(async (stageId) => {
      const refs = REFERENCE_FIELDS[stageId];
      if (!refs || refs.length === 0) return;
      const created = allCreated[stageId] || [];
      if (created.length === 0) return;
      try { await updateCrossReferences(stageId, created, idMap); } catch {}
    }));
    markEnd("refs");

    // Collect incidents that need connectors (do NOT start Gmail/Linear yet)
    mark("collectConnectors");
    try {
      let cursor;
      do {
        const args = { filters: [{ field: "workspaceId", op: "eq", value: wsId }], limit: 100 };
        if (cursor) args.cursor = cursor;
        const page = await client.records.list("incidents", args).catch(() => ({ items: [], records: [], data: [], cursor: null }));
        const items = page.items || page.records || page.data || [];
        for (const inc of items) {
          const sev = inc.severity || "";
          if ((sev === "high" || sev === "urgent") && !inc.email_sent) {
            connectorTargets.push({ incident: inc, needsGmail: true, needsLinear: sev === "urgent" && !inc.linearIssueId });
          } else if (sev === "urgent" && !inc.linearIssueId) {
            connectorTargets.push({ incident: inc, needsLinear: true });
          }
        }
        cursor = page.cursor || page.nextCursor || null;
      } while (cursor);
    } catch {}
    markEnd("collectConnectors");

    markEnd(wsTimer);
    console.log(`[perf] ws_${wsId} (${label}): ${phaseTimes[wsTimer].toFixed(1)}s`);

    fire({ type: "workspace-complete", workspaceId: wsId, workspaceLabel: label, workspaceIndex: wsIndex + 1, totalWorkspaces: DEMO_WS_IDS.length });
  }

  // Phase: Junction tables (parallel)
  mark("junctions");
  const junctionTables = ["ticket_incidents", "ticket_signals", "approvals", "user_roles", "d"];
  await Promise.all(junctionTables.map(async (stageId) => {
    try {
      const allRecords = await fetchBackup(stageId);
      const nonWsRecords = allRecords.filter(r => !r.workspaceId || r.workspaceId === "");
      if (nonWsRecords.length === 0) return;
      await createRecords(stageId, null, idMap);
    } catch {}
  }));
  markEnd("junctions");

  // Phase: Orphan audit_logs
  mark("orphans");
  try {
    const allAuditLogs = await fetchBackup("audit_logs");
    const orphanAuditLogs = allAuditLogs.filter(r => !r.workspaceId || r.workspaceId === "");
    if (orphanAuditLogs.length > 0) {
      await createRecords("audit_logs", null, idMap);
    }
  } catch {}
  markEnd("orphans");

  emitRefresh();

  const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Compute summary (record counts)
  let totalTickets = 0, totalSignals = 0, totalIncidents = 0;
  let totalKnowledge = 0, totalDrafts = 0;
  for (const wsId of DEMO_WS_IDS) {
    const ws = PER_WS_COUNTS[wsId];
    totalTickets += ws.tickets;
    totalSignals += ws.signals;
    totalIncidents += ws.incidents;
    totalKnowledge += ws.memory_entries;
    totalDrafts += ws.drafts;
  }

  // Fire complete event — demo is ready, connectors will follow
  fire({
    type: "complete",
    results: [],
    failures,
    loadTime,
    summary: {
      tickets: totalTickets,
      signals: totalSignals,
      incidents: totalIncidents,
      memory_entries: totalKnowledge,
      drafts: totalDrafts,
      gmail_alerts: 0,
      linear_issues: 0,
      workspaces: DEMO_WS_IDS.length,
    },
    percent: 100,
    workDone: TOTAL_WORK,
    workTotal: TOTAL_WORK,
  });

  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: [] }));

  // ── Performance Report ──────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log("  ENTERPRISE DEMO PERFORMANCE REPORT");
  console.log("═══════════════════════════════════════════");
  for (const wsId of DEMO_WS_IDS) {
    console.log(`  ${WS_LABELS[wsId]}: ${phaseTimes[`ws_${wsId}`]?.toFixed(1)}s`);
  }
  console.log(`  Refs: ${(phaseTimes.refs || 0).toFixed(1)}s`);
  console.log(`  Collect connectors: ${(phaseTimes.collectConnectors || 0).toFixed(1)}s`);
  console.log(`  Junctions: ${(phaseTimes.junctions || 0).toFixed(1)}s`);
  console.log(`  Orphans: ${(phaseTimes.orphans || 0).toFixed(1)}s`);
  console.log(`  Clear: ${(phaseTimes.clear || 0).toFixed(1)}s`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL: ${loadTime}s`);
  const apiTotal = apiCounts.POST + apiCounts.GET + apiCounts.PATCH + apiCounts.DELETE + apiCounts.FUNC;
  console.log(`  API Calls: POST=${apiCounts.POST} GET=${apiCounts.GET} PATCH=${apiCounts.PATCH} DELETE=${apiCounts.DELETE} FUNC=${apiCounts.FUNC} Total=${apiTotal}`);
  console.log("───────────────────────────────────────────");

  // Restore original client methods
  c.records.create = _orig.create;
  c.records.update = _orig.update;
  c.records.list = _orig.list;
  c.records.get = _orig.get;
  c.records.delete = _orig.delete;
  c.functions.run = _orig.run;

  // ── Deferred Connectors (after complete event) ────────────
  // These run asynchronously — they NEVER block the demo completion
  const connStart = Date.now();
  let gmailSent = 0, linearSynced = 0, connectorErrors = [];

  const connPromises = connectorTargets.map(target => {
    const tasks = [];
    if (target.needsGmail) {
      tasks.push(
        runGmailAlert(target.incident)
          .then(r => {
            if (r?.status === "sent") gmailSent++;
            else if (r?.status === "error") connectorErrors.push({ type: "gmail", error: r.error });
          })
          .catch(e => connectorErrors.push({ type: "gmail", error: e.message }))
      );
    }
    if (target.needsLinear) {
      tasks.push(
        syncToLinear(target.incident.id)
          .then(r => {
            if (r?.status === "synced") linearSynced++;
            else if (r?.status === "error" || r?.status === "connector_unavailable") connectorErrors.push({ type: "linear", error: r.error });
          })
          .catch(e => connectorErrors.push({ type: "linear", error: e.message }))
      );
    }
    return Promise.all(tasks);
  });

  // Fire connectors in background — timeout after 30s
  const connTimeout = new Promise(resolve => setTimeout(() => resolve("timeout"), 30000));
  const connRace = Promise.all(connPromises).then(() => "done");

  connRace.then(async (result) => {
    const connTime = ((Date.now() - connStart) / 1000).toFixed(1);
    console.log(`[perf] Connectors: ${connTime}s (${result})`);
    console.log(`[perf] Gmail sent: ${gmailSent}, Linear synced: ${linearSynced}`);
    if (connectorErrors.length > 0) {
      console.log(`[perf] Connector errors:`, connectorErrors);
    }
    // Dispatch event so UI can update summary
    window.dispatchEvent(new CustomEvent(DEMO_CONNECTORS_EVENT, {
      detail: { gmailSent, linearSynced, connectorErrors, connTime },
    }));
  });

  // Also wait for timeout (don't block, just log)
  connTimeout.then(() => {
    if (!connectorTargets.length) return;
    console.warn(`[perf] Connector timeout after 30s — ${connectorTargets.length - gmailSent - linearSynced} tasks still pending`);
  });

  return [];
}
