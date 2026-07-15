import client from "@/lib/lemmaClient";
import { WORKSPACE_SEEDS, WORKSPACE_NAMES, generateTicket } from "@/data/seedData";

const SEED_STORAGE_KEY = "signaldesk-seed-ids";

function seedStorage() {
  try { return JSON.parse(sessionStorage.getItem(SEED_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveSeedStorage(store) {
  try { sessionStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(store)); } catch { }
}

function trackSeedId(table, id) {
  const store = seedStorage();
  if (!store[table]) store[table] = [];
  store[table].push(id);
  saveSeedStorage(store);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const STATUS_MAP = {
  open: "new", pending: "triaged", waiting_on_customer: "waiting_approval",
  escalated: "waiting_approval", resolved: "resolved", closed: "resolved",
};

async function createTicket(scenario, received_at, workspaceId, workspaceName) {
  try {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const status = STATUS_MAP[scenario.status] || (scenario.status || "new");
    const record = await client.records.create("tickets", {
      id,
      title: scenario.title,
      customer_name: scenario.customer_name,
      customer_email: scenario.customer_email,
      body: scenario.body,
      channel: scenario.channel || "email",
      priority: scenario.priority || "normal",
      category: scenario.category || "General",
      status,
      received_at: received_at || new Date().toISOString(),
      workspaceId,
      workspaceName,
    });
    trackSeedId("tickets", record.id);
    return record.id;
  } catch (err) {
    console.warn("Failed to create ticket:", scenario.title, err?.message);
    return null;
  }
}

async function createSignal(signalDef, status, workspaceId, workspaceName) {
  try {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const record = await client.records.create("signals", {
      id,
      name: signalDef.name,
      summary: signalDef.summary,
      category: signalDef.category,
      status: status || "pending",
      workspaceId,
      workspaceName,
    });
    trackSeedId("signals", record.id);
    return record.id;
  } catch (err) {
    console.warn("Failed to create signal:", signalDef.name, err?.message);
    return null;
  }
}

async function createDraft(ticketId, body, confidence, workspaceId, workspaceName) {
  try {
    const draftId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.records.create("drafts", {
      id: draftId,
      ticket_id: ticketId,
      body,
      confidence: confidence || Math.floor(Math.random() * 15) + 80,
      status: "pending",
      workspaceId,
      workspaceName,
    });
    trackSeedId("drafts", draftId);
    return draftId;
  } catch (err) {
    console.warn("Failed to create draft:", err?.message);
    return null;
  }
}

async function createAuditLog(entry, workspaceId, workspaceName) {
  try {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.records.create("audit_logs", {
      id,
      action: entry.action,
      actor_agent_name: entry.actor,
      resource_type: entry.resource_type || "ticket",
      details: entry.details || {},
      created_at: entry.created_at,
      workspaceId,
      workspaceName,
    });
    trackSeedId("audit_logs", id);
  } catch {
    /* silent */
  }
}

export async function seedWorkspace(workspaceId, onProgress) {
  const seed = WORKSPACE_SEEDS[workspaceId];
  if (!seed) throw new Error(`No seed data for workspace: ${workspaceId}`);

  const wsName = WORKSPACE_NAMES[workspaceId] || workspaceId;
  const total = seed.tickets.length + seed.signals.length + seed.drafts.length + 5;
  let done = 0;

  const report = (msg) => {
    done++;
    if (onProgress) onProgress(done, total, msg);
  };

  /* --- tickets --- */
  const ticketIds = [];
  for (let i = 0; i < seed.tickets.length; i++) {
    const scenario = seed.tickets[i];
    const enriched = generateTicket(workspaceId, i, scenario);
    const id = await createTicket(enriched, enriched.created_at, workspaceId, wsName);
    if (id) ticketIds.push(id);
    report(`Ticket: ${scenario.title.slice(0, 50)}`);
    if (i % 5 === 4) await sleep(200);
  }

  /* --- signals --- */
  report("Creating signals...");
  const signalStatuses = ["pending", "approved", "approved", "memory"];
  for (let i = 0; i < seed.signals.length; i++) {
    const sig = seed.signals[i];
    await createSignal(sig, signalStatuses[i % signalStatuses.length], workspaceId, wsName);
    report(`Signal: ${sig.name}`);
    await sleep(200);
  }

  /* --- audit logs --- */
  report("Creating audit log entries...");
  const actorNames = ["Triage Agent", "Signal Detection Agent", "Knowledge Agent", "Reply Agent", "Support Manager"];
  const logActions = [
    "ticket.created", "triage.completed", "knowledge.search.completed",
    "draft.generated", "manager.notification_created", "signal.detected",
    "incident.created", "draft.pending_approval", "ticket.escalated",
  ];
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 20) + 1;
    await createAuditLog({
      action: logActions[i % logActions.length],
      actor: actorNames[i % actorNames.length],
      resource_type: i % 3 === 0 ? "signal" : "ticket",
      details: { name: seed.tickets[i % seed.tickets.length]?.title || "system" },
      created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    }, workspaceId, wsName);
    report(`Audit log entry ${i + 1}`);
  }

  /* --- drafts --- */
  report("Generating AI draft replies...");
  const draftTicketIds = ticketIds.filter((_, i) => i < seed.drafts.length);
  for (let i = 0; i < draftTicketIds.length; i++) {
    const tid = draftTicketIds[i];
    const body = seed.drafts[i % seed.drafts.length];
    if (tid && body) {
      await createDraft(tid, body, Math.floor(Math.random() * 15) + 80, workspaceId, wsName);
    }
    report(`Draft ${i + 1}/${draftTicketIds.length}`);
    await sleep(200);
  }

  /* --- memory entries --- */
  report("Creating memory entries...");
  const memoryEntries = seed.memoryEntries || [];
  for (let i = 0; i < memoryEntries.length; i++) {
    try {
      const entry = memoryEntries[i];
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await client.records.create("memory_entries", {
        id,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        root_cause: entry.root_cause,
        resolution: entry.resolution,
        category: entry.category,
        tags: entry.tags || [],
        confidence: entry.confidence || Math.floor(Math.random() * 15) + 80,
        customers_affected: entry.customers_affected,
        resolution_time_hours: entry.resolution_time_hours,
        severity: entry.severity,
        preventive_actions: entry.preventive_actions,
        symptoms: entry.symptoms,
        workspaceId,
        workspaceName: wsName,
        status: "published",
        captured_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
      });
      trackSeedId("memory_entries", id);
    } catch (err) {
      console.warn("Failed to create memory entry:", memoryEntries[i]?.title, err?.message);
    }
    report(`Memory entry ${i + 1}/${memoryEntries.length}`);
    await sleep(100);
  }

  /* --- update ticket created_at timestamps --- */
  report("Finalizing...");
  for (let i = 0; i < ticketIds.length; i++) {
    const daysAgo = Math.floor(Math.random() * 28) + 1;
    const created = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 3600000)).toISOString();
    try {
      await client.records.update("tickets", ticketIds[i], { created_at: created });
    } catch {
      /* skip */
    }
  }

  report("Complete!");
  return { ticketsCreated: ticketIds.length };
}

export async function destroySeeds(onProgress) {
  const store = seedStorage();
  const entries = Object.entries(store);
  const allIds = entries.flatMap(([, ids]) => ids);
  const total = allIds.length;

  if (total === 0) {
    if (onProgress) onProgress(0, 1, "No seed data found");
    return 0;
  }

  let done = 0;
  let totalDeleted = 0;
  for (const [table, ids] of entries) {
    for (const id of ids) {
      try {
        await client.records.delete(table, id);
        totalDeleted++;
      } catch { /* record may have been deleted already */ }
      done++;
      if (onProgress) onProgress(done, total, `Deleting ${table}: ${id.slice(0, 8)}...`);
      await sleep(30);
    }
  }
  sessionStorage.removeItem(SEED_STORAGE_KEY);
  return totalDeleted;
}

export async function checkSeedExists(workspaceId) {
  const store = seedStorage();
  return Object.values(store).some((ids) => ids.length > 0);
}
