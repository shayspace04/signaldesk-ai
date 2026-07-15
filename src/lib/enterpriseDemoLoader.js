import client from "@/lib/lemmaClient";
import { ENTERPRISE_DEMO, ENTERPRISE_DEMO_WORKSPACES, WORKSPACE_NAMES } from "@/data/enterpriseDemoDatasets";
import { emitRefresh } from "@/lib/refreshEvents";

export const DEMO_PROGRESS_EVENT = "signaldesk:enterprise-demo-progress";
export const DEMO_COMPLETE_EVENT = "signaldesk:enterprise-demo-complete";
export const DEMO_ERROR_EVENT = "signaldesk:enterprise-demo-error";

const SEED_MARKER = "__enterprise_demo__";

function randomId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deleteAllForWorkspace(table, workspaceId) {
  let cursor = null;
  let deleted = 0;
  while (true) {
    let res;
    const opts = { limit: 100, filter: [{ field: "workspaceId", op: "eq", value: workspaceId }] };
    if (cursor) opts.cursor = cursor;
    try {
      res = await client.records.list(table, opts);
    } catch {
      break;
    }
    const items = res.items || res.data || [];
    if (items.length === 0) break;
    for (const r of items) {
      try { await client.records.delete(table, r.id); deleted++; } catch { /* skip */ }
    }
    cursor = res.cursor || res.next_cursor;
    if (!cursor) break;
  }
  return deleted;
}

async function createTicket(t, workspaceId, wsName) {
  try {
    const record = await client.records.create("tickets", {
      title: t.title,
      body: t.body,
      customer_email: t.customer.email,
      customer_name: t.customer.name,
      channel: "email",
      priority: t.priority,
      category: t.category,
      status: t.status || "new",
      received_at: t.created_at,
      workspaceId,
      workspaceName: wsName,
    });
    return record.id;
  } catch (err) {
    console.warn("[demo] ticket create failed:", t.title, err?.message);
    return null;
  }
}

async function createSignal(signal, workspaceId, wsName) {
  try {
    const result = await client.functions.run("create_signal", {
      input: {
        name: signal.name,
        summary: signal.summary,
        category: signal.category,
        proposed_priority: signal.priority,
        evidence_count: signal.ticketCount,
        analysis_confidence: signal.confidence,
        root_cause: signal.root_cause,
        workspaceId,
        workspaceName: wsName,
      },
    });
    const signalId = result.output_data?.signal_id || result.signal_id || result.id;
    if (signalId) {
      await client.records.update("signals", signalId, {
        priority_score: signal.risk_score,
        affected_customer_count: signal.affectedCustomers?.length || 3,
        status: signal.status || "approved",
        workspaceId,
        workspaceName: wsName,
      });
    }
    return signalId;
  } catch (err) {
    console.warn("[demo] signal create failed:", signal.name, err?.message);
    try {
      // Fallback: direct record creation
      const id = randomId();
      await client.records.create("signals", {
        id,
        name: signal.name,
        summary: signal.summary,
        category: signal.category,
        proposed_priority: signal.priority,
        priority_score: signal.risk_score,
        analysis_confidence: signal.confidence,
        evidence_count: signal.ticketCount,
        affected_customer_count: signal.affectedCustomers?.length || 3,
        root_cause: signal.root_cause,
        status: signal.status || "approved",
        workspaceId,
        workspaceName: wsName,
      });
      return id;
    } catch (e2) {
      console.warn("[demo] signal fallback also failed:", e2?.message);
      return null;
    }
  }
}

async function createIncident(incident, signalId, workspaceId, wsName) {
  try {
    const result = await client.functions.run("link_incident", {
      input: {
        signal_id: signalId,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        category: incident.category,
        affected_customer_count: incident.affectedCustomerCount || 3,
        root_cause: incident.rootCause || "",
        workspace_id: workspaceId,
        workspace_name: wsName,
      },
    });
    const incId = result.output_data?.incident_id || result.incident_id || result.id;
    if (incId) {
      await client.records.update("incidents", incId, {
        status: incident.status || "investigating",
        workspaceId,
        workspaceName: wsName,
        tags: [SEED_MARKER, `workspace:${workspaceId}`],
      });
    }
    return incId;
  } catch (err) {
    console.warn("[demo] incident create failed:", incident.title, err?.message);
    try {
      const id = randomId();
      await client.records.create("incidents", {
        id,
        signal_id: signalId,
        title: incident.title,
        summary: incident.summary,
        severity: incident.severity,
        status: incident.status || "investigating",
        category: incident.category,
        affected_customer_count: incident.affectedCustomerCount || 3,
        root_cause: incident.rootCause || "",
        workspaceId,
        workspaceName: wsName,
        tags: [SEED_MARKER, `workspace:${workspaceId}`],
      });
      return id;
    } catch (e2) {
      return null;
    }
  }
}

async function createKnowledgeArticle(article, workspaceId, wsName) {
  try {
    const result = await client.functions.run("create_memory_entry", {
      input: {
        title: article.title,
        summary: article.summary,
        body: article.body || article.summary,
        root_cause: article.root_cause || "",
        resolution: article.resolution || "",
        category: article.category,
        tags: article.tags || [],
        confidence: article.confidence || 85,
        workspaceId,
        workspaceName: wsName,
      },
    });
    const memId = result.output_data?.id || result.id;
    if (memId) {
      await client.records.update("memory_entries", memId, {
        status: "published",
        customers_affected: article.customers_affected || 3,
        severity: article.severity || "high",
        resolution_time_hours: article.resolution_time_hours || 4,
        preventive_actions: article.preventive_actions || "",
        symptoms: Array.isArray(article.symptoms) ? article.symptoms.join("; ") : (article.symptoms || ""),
        workspaceId,
        workspaceName: wsName,
        tags: [SEED_MARKER, `workspace:${workspaceId}`],
      });
    }
    return memId;
  } catch (err) {
    console.warn("[demo] knowledge create failed:", article.title, err?.message);
    try {
      const id = randomId();
      await client.records.create("memory_entries", {
        id,
        title: article.title,
        summary: article.summary,
        body: article.body || article.summary,
        root_cause: article.root_cause || "",
        resolution: article.resolution || "",
        category: article.category,
        tags: article.tags || [],
        confidence: article.confidence || 85,
        status: "published",
        customers_affected: article.customers_affected || 3,
        severity: article.severity || "high",
        resolution_time_hours: article.resolution_time_hours || 4,
        preventive_actions: article.preventive_actions || "",
        symptoms: Array.isArray(article.symptoms) ? article.symptoms.join("; ") : (article.symptoms || ""),
        workspaceId,
        workspaceName: wsName,
        tags: [SEED_MARKER, `workspace:${workspaceId}`],
      });
      return id;
    } catch (e2) {
      return null;
    }
  }
}

async function createHandoff(handoff, relatedIncidentId, workspaceId, wsName) {
  try {
    const id = randomId();
    await client.records.create("audit_logs", {
      id,
      action: "engineering.handoff",
      actor_agent_name: "Demo System",
      resource_type: "incident",
      resource_id: relatedIncidentId || "",
      details: {
        handoff_title: handoff.title,
        description: handoff.description,
        priority: handoff.priority,
        package_name: handoff.package_name,
        engineering_notes: handoff.engineering_notes || "",
        ticket_refs: handoff.ticketRefs || [],
      },
      workspaceId,
      workspaceName: wsName,
    });
    return id;
  } catch (err) {
    console.warn("[demo] handoff create failed:", handoff.title, err?.message);
    return null;
  }
}

async function createApproval(approval, workspaceId, wsName) {
  try {
    const id = randomId();
    await client.records.create("drafts", {
      id,
      body: approval.draftBody,
      confidence: approval.confidence || 85,
      status: approval.status || "pending",
      workspaceId,
      workspaceName: wsName,
    });
    return id;
  } catch (err) {
    console.warn("[demo] approval create failed:", err?.message);
    return null;
  }
}

async function createNotificationEntry(action, details, workspaceId, wsName) {
  try {
    await client.records.create("audit_logs", {
      id: randomId(),
      action,
      actor_agent_name: "Enterprise Demo System",
      resource_type: "system",
      details: details || {},
      workspaceId,
      workspaceName: wsName,
    });
  } catch { /* silent */ }
}

export async function loadEnterpriseWorkspace(workspaceId, onProgress) {
  const dataset = ENTERPRISE_DEMO[workspaceId];
  if (!dataset) throw new Error(`No enterprise demo dataset for workspace: ${workspaceId}`);

  const wsName = WORKSPACE_NAMES[workspaceId] || workspaceId;
  const totalSteps = dataset.tickets.length + dataset.signals.length + dataset.incidents.length
    + dataset.knowledge.length + dataset.handoffs.length + dataset.approvals.length + 5;
  let done = 0;

  const progress = (msg) => {
    done++;
    if (onProgress) onProgress(done, totalSteps, msg);
  };

  /* ── Audit: started ── */
  await createNotificationEntry("demo.enterprise.started", { workspace: workspaceId, name: wsName }, workspaceId, wsName);

  /* ── Clear workspace ── */
  const tables = ["tickets", "signals", "incidents", "drafts", "audit_logs", "approvals", "memory_entries", "ticket_incidents"];
  for (const table of tables) {
    await deleteAllForWorkspace(table, workspaceId);
  }
  progress("Cleared existing data");

  /* ── Create tickets ── */
  const ticketIds = [];
  for (let i = 0; i < dataset.tickets.length; i++) {
    const tid = await createTicket(dataset.tickets[i], workspaceId, wsName);
    if (tid) ticketIds.push(tid);
    progress(`Ticket ${i + 1}/${dataset.tickets.length}`);
    if (i > 0 && i % 5 === 0) await sleep(0);
  }
  progress("Tickets created");

  /* ── Create signals ── */
  const signalIds = [];
  for (let i = 0; i < dataset.signals.length; i++) {
    const sid = await createSignal(dataset.signals[i], workspaceId, wsName);
    if (sid) signalIds.push(sid);
    progress(`Signal ${i + 1}/${dataset.signals.length}`);
    await sleep(50);
  }
  progress("Signals created");

  /* ── Create incidents ── */
  const incidentIds = [];
  for (let i = 0; i < dataset.incidents.length; i++) {
    const incident = dataset.incidents[i];
    const signalId = incident.signalRef != null ? signalIds[incident.signalRef] : null;
    const iid = await createIncident(incident, signalId, workspaceId, wsName);
    if (iid) incidentIds.push(iid);
    progress(`Incident ${i + 1}/${dataset.incidents.length}`);
    await sleep(50);
  }
  progress("Incidents created");

  /* ── Knowledge articles ── */
  for (let i = 0; i < dataset.knowledge.length; i++) {
    await createKnowledgeArticle(dataset.knowledge[i], workspaceId, wsName);
    progress(`Knowledge ${i + 1}/${dataset.knowledge.length}`);
    await sleep(50);
  }
  progress("Knowledge articles created");

  /* ── Engineering handoffs ── */
  for (let i = 0; i < dataset.handoffs.length; i++) {
    const handoff = dataset.handoffs[i];
    const relatedInc = handoff.incidentRef != null ? incidentIds[handoff.incidentRef] : null;
    await createHandoff(handoff, relatedInc, workspaceId, wsName);
    progress(`Handoff ${i + 1}/${dataset.handoffs.length}`);
    await sleep(50);
  }
  progress("Engineering handoffs created");

  /* ── Approval queue ── */
  for (let i = 0; i < dataset.approvals.length; i++) {
    await createApproval(dataset.approvals[i], workspaceId, wsName);
    progress(`Approval ${i + 1}/${dataset.approvals.length}`);
    await sleep(50);
  }
  progress("Approval queue populated");

  /* ── Audit: completed ── */
  await createNotificationEntry("demo.enterprise.completed", {
    workspace: workspaceId,
    tickets: dataset.tickets.length,
    signals: dataset.signals.length,
    incidents: dataset.incidents.length,
    knowledge: dataset.knowledge.length,
    handoffs: dataset.handoffs.length,
    approvals: dataset.approvals.length,
  }, workspaceId, wsName);

  /* ── Refresh ── */
  emitRefresh();
  await sleep(300);
  emitRefresh();

  progress("Complete!");

  return {
    workspaceName: wsName,
    ticketsCreated: dataset.tickets.length,
    signalsGenerated: dataset.signals.length,
    incidentsGenerated: dataset.incidents.length,
    knowledgeGenerated: dataset.knowledge.length,
    handoffsGenerated: dataset.handoffs.length,
    approvalsGenerated: dataset.approvals.length,
  };
}

export async function launchEnterpriseDemo(onProgress) {
  const results = [];
  let totalDone = 0;
  const totalSteps = ENTERPRISE_DEMO_WORKSPACES.length;

  for (let wi = 0; wi < ENTERPRISE_DEMO_WORKSPACES.length; wi++) {
    const wsId = ENTERPRISE_DEMO_WORKSPACES[wi];
    const wsName = WORKSPACE_NAMES[wsId] || wsId;

    const wsProgress = (step, total, msg) => {
      const pct = Math.round((totalDone / totalSteps) * 100);
      if (onProgress) onProgress(wsId, wsName, step, total, msg, pct);
    };

    try {
      const r = await loadEnterpriseWorkspace(wsId, wsProgress);
      results.push(r);
      totalDone++;
    } catch (err) {
      console.error(`[demo] Failed to load workspace ${wsId}:`, err);
      results.push({ workspaceName: wsName, error: err.message });
      totalDone++;
    }
  }

  emitRefresh();
  await sleep(500);
  emitRefresh();

  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: results }));
  return results;
}
