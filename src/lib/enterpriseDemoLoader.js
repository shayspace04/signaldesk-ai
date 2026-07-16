import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { runGmailAlert, syncToLinear } from "@/lib/incidentWorkflow";

export const DEMO_COMPLETE_EVENT = "signaldesk:enterprise-demo-complete";
export const DEMO_CLEAR_EVENT = "signaldesk:enterprise-demo-clear";
export const DEMO_CONNECTORS_EVENT = "signaldesk:enterprise-demo-connectors";

const BACKUP_PREFIX = "/backup/";
const DEMO_WS_IDS = ["binocs", "zap", "foxo", "corally", "yesmadam"];

const WS_LABELS = { binocs: "Binocs", zap: "Zapdata", foxo: "Foxo", corally: "Corally", yesmadam: "YesMadam" };

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
    Promise.all(clearCombos.map(({ wsId, table }) =>
      clearTable(table, { field: "workspaceId", op: "eq", value: wsId })
    )),
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

// ─── Parallel batch create (no sequential loops) ────────────────

async function batchCreate(table, items) {
  if (!items.length) return 0;

  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map(chunk =>
    Promise.all(chunk.map(async ({ fields }) => {
      try {
        await client.records.create(table, fields);
        return 1;
      } catch (err) {
        if (err?.code === "DATASTORE_CONFLICT" || /already exists.*id/i.test(err?.message || "")) {
          fields.id = generateId();
          try {
            await client.records.create(table, fields);
            return 1;
          } catch (retryErr) {
            console.error(`[create] RETRY FAILED ${table}/${fields.id}: ${retryErr?.message || retryErr}`);
            return 0;
          }
        }
        console.error(`[create] FAILED ${table}/${fields.id}: ${err?.message || err}`);
        return 0;
      }
    }))
  ));

  return results.flat().reduce((a, b) => a + b, 0);
}

// ─── Generate all data in memory ───────────────────────────────

async function generateAllData() {
  const idMap = new Map();
  const allData = {};
  const allTables = [...WS_TABLES, "ticket_incidents", "ticket_signals", "approvals", "user_roles", "d"];

  for (const table of allTables) {
    const records = await fetchBackup(table);

    let filtered;
    if (table === "audit_logs") {
      filtered = records.filter(r => DEMO_WS_IDS.includes(r.workspaceId) || !r.workspaceId || r.workspaceId === "");
    } else if (WS_TABLES.includes(table)) {
      filtered = records.filter(r => DEMO_WS_IDS.includes(r.workspaceId));
    } else {
      filtered = records.filter(r => !r.workspaceId || r.workspaceId === "");
    }

    const prepared = filtered.map(rec => {
      const fields = {};
      for (const [k, v] of Object.entries(rec)) {
        if (!AUTO_FIELDS.has(k)) fields[k] = v;
      }
      fields.id = generateId();
      return { oldId: rec.id, fields };
    });

    allData[table] = prepared;

    for (const { oldId, fields } of prepared) {
      idMap.set(oldId, fields.id);
    }
  }

  for (const [table, items] of Object.entries(allData)) {
    const refs = REFERENCE_FIELDS[table];
    if (!refs) continue;
    for (const item of items) {
      for (const refField of refs) {
        if (item.fields[refField] !== undefined) {
          item.fields[refField] = remapValue(item.fields[refField], idMap);
        }
      }
    }
  }

  return { allData, idMap };
}

// ─── Enrich ticket relationships ────────────────────────────────

function enrichTicketRelationships(allData) {
  const wsCatTickets = {};
  for (const ticket of allData.tickets || []) {
    const ws = ticket.fields.workspaceId;
    const cat = ticket.fields.category || "general";
    if (!wsCatTickets[ws]) wsCatTickets[ws] = {};
    if (!wsCatTickets[ws][cat]) wsCatTickets[ws][cat] = [];
    wsCatTickets[ws][cat].push(ticket);
  }

  // Assign example_ticket_ids to signals and set signal_id on linked tickets
  for (const signal of allData.signals || []) {
    const ws = signal.fields.workspaceId;
    const cat = signal.fields.category || "general";
    const count = signal.fields.evidence_count ?? 0;
    const pool = wsCatTickets[ws]?.[cat] || [];
    const selected = count > 0 ? pool.slice(0, count) : [];
    const selectedIds = selected.map(t => t.fields.id);
    signal.fields.example_ticket_ids = selectedIds;
    for (const ticket of selected) {
      ticket.fields.signal_id = signal.fields.id;
    }
  }

  // Assign ticket_ids and affected counts to incidents
  for (const incident of allData.incidents || []) {
    const signalId = incident.fields.signal_id;
    if (!signalId) { console.warn(`[enrich] incident ${incident.fields.id?.slice(0,8)}: no signal_id`); continue; }
    const signal = allData.signals?.find(s => s.fields.id === signalId);
    if (!signal) { console.warn(`[enrich] incident ${incident.fields.id?.slice(0,8)}: signal ${signalId.slice(0,8)} not found`); continue; }
    const ticketIds = signal?.fields?.example_ticket_ids || [];
    if (!ticketIds.length) { console.warn(`[enrich] incident ${incident.fields.id?.slice(0,8)}: signal ${signalId.slice(0,8)} has 0 example_ticket_ids`); continue; }
    incident.fields.ticket_ids = ticketIds;
    incident.fields.ticket_count = ticketIds.length;
    incident.fields.affected_ticket_count = ticketIds.length;
    incident.fields.affected_customer_count = Math.max(
      incident.fields.affected_customer_count || 0,
      new Set((allData.tickets || []).filter(t => ticketIds.includes(t.fields.id)).map(t => t.fields.customer_name).filter(Boolean)).size
    );
  }
}

// ─── Launch ─────────────────────────────────────────────────────

export async function launchEnterpriseDemo(onProgress) {
  _backupCache = {};
  const failures = [];
  let workDone = 0;
  const startTime = Date.now();
  const phaseTimes = {};

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

  const mark = (label) => { phaseTimes[label] = Date.now(); };
  const markEnd = (label) => {
    const started = phaseTimes[label];
    if (typeof started === "number") {
      phaseTimes[label] = (Date.now() - started) / 1000;
    }
  };

  let totalWork = 0;

  const fire = (detail) => {
    detail.percent = totalWork ? Math.min(100, Math.round((workDone / totalWork) * 100)) : 0;
    detail.workDone = workDone;
    detail.workTotal = totalWork;
    if (onProgress) onProgress(detail);
  };

  // ── Phase 0: Clear ──────────────────────────────────────────
  mark("clear");
  try {
    if (onProgress) onProgress({ type: "status", status: "clearing" });
    await deleteByWorkspace();
    window.dispatchEvent(new CustomEvent(DEMO_CLEAR_EVENT));
    if (onProgress) onProgress({ type: "status", status: "cleared" });
  } catch {}
  markEnd("clear");
  console.log(`[perf] clear: ${phaseTimes.clear.toFixed(1)}s`);

  // ── Phase 1: Generate all data in memory ────────────────────
  mark("generate");
  if (onProgress) onProgress({ type: "status", status: "generating" });
  const { allData, idMap } = await generateAllData();
  enrichTicketRelationships(allData);
  markEnd("generate");
  console.log(`[perf] generate: ${phaseTimes.generate.toFixed(1)}s`);

  totalWork = WS_TABLES.reduce((sum, t) => sum + (allData[t]?.length || 0), 0);

  // Synthetic single workspace for progress UI
  fire({
    type: "workspace-start",
    workspaceId: "enterprise", workspaceLabel: "Enterprise",
    workspaceIndex: 1, totalWorkspaces: 1,
  });

  const connectorTargets = [];

  // ── Phase 2-7: Create tables in dependency order ────────────
  const createPhase = async (stageId, stageLabel) => {
    const items = allData[stageId] || [];
    if (!items.length) return;

    fire({
      type: "stage-start", workspaceId: "enterprise", workspaceLabel: "Enterprise",
      workspaceIndex: 1, totalWorkspaces: 1,
      stageId, stageLabel, count: 0, total: items.length,
    });

    mark(stageId);
    const created = await batchCreate(stageId, items);
    markEnd(stageId);

    workDone += created;

    fire({
      type: "stage-complete", workspaceId: "enterprise", workspaceLabel: "Enterprise",
      workspaceIndex: 1, totalWorkspaces: 1,
      stageId, stageLabel, count: created, total: items.length,
    });

    if (stageId === "incidents") {
      for (const item of items) {
        const sev = item.fields.severity || "";
        if ((sev === "high" || sev === "urgent") && !item.fields.email_sent) {
          connectorTargets.push({
            incident: { id: item.fields.id, ...item.fields },
            needsGmail: true,
            needsLinear: sev === "urgent" && !item.fields.linearIssueId,
          });
        } else if (sev === "urgent" && !item.fields.linearIssueId) {
          connectorTargets.push({
            incident: { id: item.fields.id, ...item.fields },
            needsLinear: true,
          });
        }
      }
    }
  };

  // tickets → signals → incidents → memory_entries
  await createPhase("tickets", "Tickets");
  await createPhase("signals", "Signals");
  await createPhase("incidents", "Incidents");

  // PATCH ticket_ids on incidents after create (create doesn't persist JSON arrays)
  if (allData.incidents?.length) {
    const patches = allData.incidents
      .filter(item => item.fields.ticket_ids?.length > 0)
      .map(item => {
        const f = item.fields;
        return client.records.update("incidents", f.id, {
          ticket_ids: f.ticket_ids,
          ticket_count: f.ticket_count,
          affected_ticket_count: f.affected_ticket_count,
          affected_customer_count: f.affected_customer_count,
        }).then(r => 1).catch(err => {
          console.error(`[demo] PATCH ticket_ids on incident ${f.id?.slice(0,8)} failed: ${err?.message || err}`);
          return 0;
        });
      });
    if (patches.length) {
      await Promise.all(patches);
    }
  }

  await createPhase("memory_entries", "Knowledge");

  // audit_logs + drafts: no dependencies between them, run in parallel
  mark("remaining");
  await Promise.all([
    createPhase("audit_logs", "Activity Logs"),
    createPhase("drafts", "Drafts"),
  ]);
  markEnd("remaining");

  // ── Phase: Junction tables ──────────────────────────────────
  mark("junctions");
  const junctionTables = ["ticket_incidents", "ticket_signals", "approvals", "user_roles", "d"];
  await Promise.all(junctionTables.map(async (table) => {
    const items = allData[table] || [];
    if (!items.length) return;
    await batchCreate(table, items);
  }));
  markEnd("junctions");

  // ── Refresh ONCE ────────────────────────────────────────────
  emitRefresh();

  const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  const summary = {
    tickets: allData.tickets?.length || 0,
    signals: allData.signals?.length || 0,
    incidents: allData.incidents?.length || 0,
    memory_entries: allData.memory_entries?.length || 0,
    drafts: allData.drafts?.length || 0,
    gmail_alerts: 0,
    linear_issues: 0,
    workspaces: DEMO_WS_IDS.length,
  };

  fire({
    type: "complete",
    results: [],
    failures,
    loadTime,
    summary,
    percent: 100,
    workDone: totalWork,
    workTotal: totalWork,
  });

  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: [] }));

  // ── Performance Report ──────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log("  ENTERPRISE DEMO PERFORMANCE REPORT");
  console.log("═══════════════════════════════════════════");
  for (const phase of ["tickets", "signals", "incidents", "memory_entries", "remaining", "junctions", "generate", "clear"]) {
    const t = phaseTimes[phase];
    if (t != null && typeof t === "number") {
      console.log(`  ${phase}: ${t.toFixed(1)}s`);
    }
  }
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
  if (!connectorTargets.length) return [];

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

  const connTimeout = new Promise(resolve => setTimeout(() => resolve("timeout"), 30000));
  const connRace = Promise.all(connPromises).then(() => "done");

  connRace.then(() => {
    const connTime = ((Date.now() - connStart) / 1000).toFixed(1);
    console.log(`[perf] Connectors: ${connTime}s`);
    console.log(`[perf] Gmail sent: ${gmailSent}, Linear synced: ${linearSynced}`);
    if (connectorErrors.length > 0) {
      console.log(`[perf] Connector errors:`, connectorErrors);
    }
    emitRefresh();
    window.dispatchEvent(new CustomEvent(DEMO_CONNECTORS_EVENT, {
      detail: { gmailSent, linearSynced, connectorErrors, connTime },
    }));
  });

  connTimeout.then(() => {
    if (!connectorTargets.length) return;
    console.warn(`[perf] Connector timeout after 30s — ${connectorTargets.length - gmailSent - linearSynced} tasks still pending`);
  });

  return [];
}
