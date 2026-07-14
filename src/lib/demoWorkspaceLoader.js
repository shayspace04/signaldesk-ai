import client from "@/lib/lemmaClient";
import { WORKSPACE_DATASETS, WORKSPACE_NAMES } from "@/data/workspaceDatasets";
import { emitRefresh } from "@/lib/refreshEvents";
import { runDetectionForWorkspace } from "@/lib/aiDetectionEngine";

export const DEMO_PROGRESS_EVENT = "signaldesk:demo-progress";
export const DEMO_COMPLETE_EVENT = "signaldesk:demo-complete";
export const DEMO_ERROR_EVENT = "signaldesk:demo-error";

function randomId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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
    } catch (err) {
      console.warn(`[demo] list ${table} failed:`, err.message);
      break;
    }
    const items = res.items || res.data || [];
    if (items.length === 0) break;
    for (const r of items) {
      try { await client.records.delete(table, r.id); deleted++; }
      catch { /* skip individual delete failures */ }
    }
    cursor = res.cursor || res.next_cursor;
    if (!cursor) break;
  }
  return deleted;
}

export async function loadDemoWorkspace(workspaceId) {
  const dataset = WORKSPACE_DATASETS[workspaceId];
  if (!dataset) throw new Error(`No dataset for workspace: ${workspaceId}`);

  const wsName = WORKSPACE_NAMES[workspaceId] || workspaceId;
  const stages = [];

  const stage = (id, label) => {
    stages.push({ id, label, status: "pending" });
  };

  const mark = (id, status, msg) => {
    const s = stages.find((s) => s.id === id);
    if (s) {
      s.status = status;
      if (msg) s.label = msg;
    }
    window.dispatchEvent(new CustomEvent(DEMO_PROGRESS_EVENT, {
      detail: { stages: stages.map((s) => ({ ...s })), workspaceName: wsName },
    }));
  };

  stage("clearing", "Clearing existing demo data");
  stage("importing", "Importing customer tickets");
  stage("detecting", "Running AI detection pipeline");
  stage("knowledge", "Creating knowledge articles");
  stage("refreshing", "Refreshing analytics");

  mark("clearing", "active");

  const wfStart = performance.now();
  console.log("[demo] Starting workspace load:", workspaceId, wsName);

  /* ── Audit: started ───────────────────────────────────────────── */
  try {
    await client.records.create("audit_logs", {
      id: randomId(),
      action: "demo.workspace.started",
      actor_agent_name: "Demo Workspace System",
      resource_type: "system",
      details: { workspace: workspaceId, name: wsName },
      created_at: new Date().toISOString(),
      workspaceId,
      workspaceName: wsName,
    });
    console.log("[demo] audit: demo.workspace.started");
  } catch (err) {
    console.warn("[demo] audit create failed:", err.message);
  }

  /* ── Clear workspace ──────────────────────────────────────────── */
  const clearTables = ["tickets", "signals", "incidents", "drafts", "audit_logs", "approvals", "memory_entries", "ticket_incidents"];
  for (const table of clearTables) {
    const n = await deleteAllForWorkspace(table, workspaceId);
    console.log(`[demo] cleared ${n} ${table}`);
  }
  mark("clearing", "done");
  console.log("[demo] workspace cleared");

  /* ── Create tickets via direct DB write ───────────────────────── */
  mark("importing", "active");
  const createdTicketIds = [];
  const ticketTimings = [];
  let ticketErrors = 0;
  const failedTicketTitles = [];
  console.log(`[demo] Importing ${dataset.tickets.length} tickets via records.create`);
  console.log("✓ Import started");

  for (let i = 0; i < dataset.tickets.length; i++) {
    const t = dataset.tickets[i];
    const start = performance.now();
    try {
      const record = await client.records.create("tickets", {
        title: t.title,
        body: t.body,
        customer_email: t.customer.email,
        customer_name: t.customer.name,
        channel: "email",
        priority: t.priority,
        category: t.category,
        status: "new",
        received_at: t.created_at,
        workspaceId,
        workspaceName: wsName,
      });
      const elapsed = Math.round(performance.now() - start);
      createdTicketIds.push(record.id);
      ticketTimings.push({ index: i + 1, elapsed, title: t.title, id: record.id });
      console.log(`[demo] ticket ${i + 1}/${dataset.tickets.length} created in ${elapsed}ms — "${t.title}" id=${record.id}`);
    } catch (err) {
      ticketErrors++;
      failedTicketTitles.push(t.title);
      console.error(`[demo] ticket ${i + 1}/${dataset.tickets.length} FAILED: "${t.title}" — ${err.message}`);
    }

    mark("importing", "active", `Importing tickets (${i + 1} of ${dataset.tickets.length})`);
    if (i > 0 && i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const totalImportTime = ticketTimings.reduce((s, x) => s + x.elapsed, 0);
  const avgImportTime = ticketTimings.length ? Math.round(totalImportTime / ticketTimings.length) : 0;
  console.log(
    `[demo] ticket import summary: ` +
    `${createdTicketIds.length} succeeded, ${ticketErrors} failed, ` +
    `total=${totalImportTime}ms, avg=${avgImportTime}ms`
  );
  if (failedTicketTitles.length) {
    console.warn(`[demo] failed tickets: ${failedTicketTitles.join(", ")}`);
  }

  /* ── Audit: dataset imported ──────────────────────────────────── */
  try {
    await client.records.create("audit_logs", {
      id: randomId(),
      action: "demo.dataset.imported",
      actor_agent_name: "Demo Workspace System",
      resource_type: "system",
      details: { tickets_created: createdTicketIds.length, workspace: workspaceId },
      created_at: new Date().toISOString(),
      workspaceId,
      workspaceName: wsName,
    });
    console.log("[demo] audit: demo.dataset.imported");
  } catch (err) {
    console.warn("[demo] audit create failed:", err.message);
  }

  console.log("✓ Ticket import completed");
  console.log("✓ Number of tickets imported:", createdTicketIds.length);

  /* ── Run detection ────────────────────────────────────────────── */
  mark("detecting", "active");
  console.log("[demo] starting AI detection pipeline (batch for all tickets)");
  console.log("Starting AI Detection...");
  const detectionStart = performance.now();
  const detectionResult = await runDetectionForWorkspace(workspaceId);
  const detectionTime = Math.round(performance.now() - detectionStart);
  console.log(`[demo] detection complete in ${detectionTime}ms:`, JSON.stringify(detectionResult));
  mark("detecting", "done");

  /* ── Query actual counts ──────────────────────────────────────── */
  let ticketCount = 0;
  let signalCount = 0;
  let incidentCount = 0;
  let knowledgeCount = 0;
  let draftCount = 0;
  let logCount = 0;

  try {
    const tRes = await client.records.list("tickets", {
      filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
    });
    ticketCount = (tRes.items || tRes.data || []).length;
  } catch { /* skip */ }

  try {
    const sRes = await client.records.list("signals", {
      filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
    });
    signalCount = (sRes.items || sRes.data || []).length;
  } catch { /* skip */ }

  try {
    const iRes = await client.records.list("incidents", {
      filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
    });
    incidentCount = (iRes.items || iRes.data || []).length;
  } catch { /* skip */ }

  console.log(`[demo] actual counts — tickets:${ticketCount} signals:${signalCount} incidents:${incidentCount}`);

  /* ── Create knowledge articles ────────────────────────────────── */
  const knowledgeStart = performance.now();
  mark("knowledge", "active");
  if (workspaceId === "binocs") {
    const articles = [
      {
        title: "Financial Report Generation Failure Resolution",
        summary: "Diagnosis and resolution guide for financial report generation failures including portfolio aggregation errors, IRR calculation issues, and PDF generation problems.",
        body: "Financial report generation failures at Binocs typically stem from portfolio aggregation pipeline timeouts, stale market data feeds, or report template rendering errors.",
        root_cause: "The portfolio aggregation pipeline was consuming excessive memory due to a missing index on the holdings table.",
        resolution: "Add composite index on holdings table (portfolio_id, date), increase aggregation pipeline memory limit from 512MB to 2GB.",
        category: "Financial Report",
        tags: ["financial-report", "aggregation", "irr", "pdf", "portfolio"],
        confidence: 93,
        customers_affected: 8,
        severity: "critical",
      },
      {
        title: "OCR Document Processing Pipeline Troubleshooting",
        summary: "Standard operating procedure for resolving OCR pipeline failures affecting scanned document processing and AI risk scoring.",
        body: "The OCR document processing pipeline at Binocs receives scanned due diligence documents and converts them to machine-readable text for AI risk analysis.",
        root_cause: "The OCR worker service ran out of memory due to a memory leak in the PDF parsing library.",
        resolution: "Update PDF parsing library to the latest version, implement page-level processing with memory limits.",
        category: "Document Review",
        tags: ["ocr", "document-processing", "pdf", "risk-scoring"],
        confidence: 90,
        customers_affected: 5,
        severity: "high",
      },
    ];
    for (const article of articles) {
      console.log(`[demo] creating knowledge article: "${article.title}"`);
      const result = await client.functions.run("create_memory_entry", {
        input: {
          title: article.title,
          summary: article.summary,
          root_cause: article.root_cause,
          source_signal_id: null,
          category: article.category,
          tags: article.tags,
          confidence: article.confidence,
          workspaceId,
          workspaceName: wsName,
        },
      });
      const memId = result.output_data?.id || result.id;
      if (memId) {
        await client.records.update("memory_entries", memId, {
          body: article.body,
          resolution: article.resolution,
          customers_affected: article.customers_affected,
          severity: article.severity,
          status: "published",
          workspaceId,
          workspaceName: wsName,
        });
        knowledgeCount++;
      }
    }
  }
  const knowledgeTime = Math.round(performance.now() - knowledgeStart);
  console.log(`[demo] knowledge articles created: ${knowledgeCount} in ${knowledgeTime}ms`);
  mark("knowledge", "done");
  try {
    const dRes = await client.records.list("drafts", {
      filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
    });
    draftCount = (dRes.items || dRes.data || []).length;
  } catch { /* skip */ }

  try {
    const lRes = await client.records.list("audit_logs", {
      filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
    });
    logCount = (lRes.items || lRes.data || []).length;
  } catch { /* skip */ }

  console.log(`[demo] final counts — tickets:${ticketCount} signals:${signalCount} incidents:${incidentCount} knowledge:${knowledgeCount} drafts:${draftCount} logs:${logCount}`);

  /* ── Refresh ──────────────────────────────────────────────────── */
  mark("refreshing", "active");
  emitRefresh();
  await new Promise((r) => setTimeout(r, 500));
  emitRefresh();
  mark("refreshing", "done");
  console.log("[demo] refresh emitted");

  /* ── Audit: workflow completed ────────────────────────────────── */
  try {
    await client.records.create("audit_logs", {
      id: randomId(),
      action: "demo.workflow.completed",
      actor_agent_name: "Demo Workspace System",
      resource_type: "system",
      details: { workspace: workspaceId, tickets: ticketCount, signals: signalCount, incidents: incidentCount },
      created_at: new Date().toISOString(),
      workspaceId,
      workspaceName: wsName,
    });
    console.log("[demo] audit: demo.workflow.completed");
  } catch (err) {
    console.warn("[demo] audit create failed:", err.message);
  }

  /* ── Success ──────────────────────────────────────────────────── */
  const wfTotal = Math.round(performance.now() - wfStart);
  console.log(
    `[demo] WORKFLOW COMPLETE — ` +
    `import=${totalImportTime}ms (avg=${avgImportTime}ms/ticket), ` +
    `detection=${detectionTime}ms, ` +
    `knowledge=${knowledgeTime}ms, ` +
    `total=${wfTotal}ms `
  );

  const result = {
    workspaceName: wsName,
    ticketsCreated: ticketCount,
    signalsGenerated: signalCount,
    incidentsGenerated: incidentCount,
    knowledgeGenerated: knowledgeCount,
    draftReplies: draftCount,
    notifications: logCount,
  };

  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: result }));
  console.log("[demo] workspace load complete:", JSON.stringify(result));
  return result;
}
