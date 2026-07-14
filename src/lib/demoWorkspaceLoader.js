import client from "@/lib/lemmaClient";
import { WORKSPACE_DATASETS, WORKSPACE_NAMES } from "@/data/workspaceDatasets";
import { emitRefresh } from "@/lib/refreshEvents";
import { runDetection, runDetectionForWorkspace } from "@/lib/aiDetectionEngine";

const DEMO_TAG = "__demo__";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const DEMO_PROGRESS_EVENT = "signaldesk:demo-progress";
export const DEMO_COMPLETE_EVENT = "signaldesk:demo-complete";

export function emitProgress(detail) {
  window.dispatchEvent(new CustomEvent(DEMO_PROGRESS_EVENT, { detail }));
}

const STEPS = [
  "clearing",
  "importing_tickets",
  "running_detection",
  "building_clusters",
  "creating_signals",
  "analyzing_impact",
  "escalating_incidents",
  "generating_handoffs",
  "creating_drafts",
  "updating_knowledge",
  "refreshing",
  "complete",
];

const STEP_LABELS = {
  clearing: "Clearing existing demo data",
  importing_tickets: "Importing customer tickets",
  running_detection: "Running AI similarity detection",
  building_clusters: "Building ticket clusters",
  creating_signals: "Creating Signals",
  analyzing_impact: "Performing root cause analysis",
  escalating_incidents: "Calculating business impact",
  generating_handoffs: "Escalating Incidents",
  creating_drafts: "Generating Engineering Handoffs",
  updating_knowledge: "Creating AI Draft Replies",
  refreshing: "Updating Knowledge Base",
  complete: "Refreshing Analytics",
};

function currentStep(done, total) {
  if (done <= 0) return "clearing";
  if (done < total * 0.3) return "importing_tickets";
  if (done < total * 0.5) return "running_detection";
  if (done < total * 0.6) return "building_clusters";
  if (done < total * 0.7) return "creating_signals";
  if (done < total * 0.75) return "analyzing_impact";
  if (done < total * 0.8) return "escalating_incidents";
  if (done < total * 0.85) return "generating_handoffs";
  if (done < total * 0.9) return "creating_drafts";
  if (done < total * 0.95) return "updating_knowledge";
  if (done < total) return "refreshing";
  return "complete";
}

async function createAuditLog(action, actor, details, workspaceId, workspaceName) {
  try {
    await client.records.create("audit_logs", {
      id: randomId(),
      action,
      actor_agent_name: actor,
      resource_type: "system",
      details: details || {},
      created_at: new Date().toISOString(),
      workspaceId,
      workspaceName,
      tags: [DEMO_TAG],
    });
  } catch {
    /* silent */
  }
}

async function deleteRecordsByTag(table, tag) {
  let cursor = null;
  let deleted = 0;
  while (true) {
    const opts = { limit: 100 };
    if (cursor) opts.cursor = cursor;
    let res;
    try {
      res = await client.records.list(table, opts);
    } catch { break; }
    const items = res.items || res.data || [];
    if (items.length === 0) break;
    for (const record of items) {
      const tags = record.tags || [];
      if (tags.includes(tag)) {
        try {
          await client.records.delete(table, record.id);
          deleted++;
        } catch { /* skip */ }
        await sleep(20);
      }
    }
    cursor = res.cursor || res.next_cursor;
    if (!cursor) break;
  }
  return deleted;
}

async function deleteWorkspaceRecords(table, workspaceId) {
  let cursor = null;
  let deleted = 0;
  while (true) {
    try {
      const opts = {
        limit: 100,
        filter: [{ field: "workspaceId", op: "eq", value: workspaceId }],
      };
      if (cursor) opts.cursor = cursor;
      const res = await client.records.list(table, opts);
      const items = res.items || res.data || [];
      if (items.length === 0) break;
      for (const record of items) {
        try {
          await client.records.delete(table, record.id);
          deleted++;
        } catch { /* skip */ }
        await sleep(20);
      }
      cursor = res.cursor || res.next_cursor;
      if (!cursor) break;
    } catch { break; }
  }
  return deleted;
}

export async function loadDemoWorkspace(workspaceId) {
  const dataset = WORKSPACE_DATASETS[workspaceId];
  if (!dataset) throw new Error(`No dataset for workspace: ${workspaceId}`);

  const wsName = WORKSPACE_NAMES[workspaceId] || workspaceId;
  const totalTickets = dataset.tickets.length;
  const totalSteps = STEPS.length;
  let done = 0;

  const advance = (step) => {
    done++;
    emitProgress({
      step,
      done,
      total: totalSteps,
      label: STEP_LABELS[step] || step,
      workspaceName: wsName,
    });
  };

  advance("clearing");

  await createAuditLog("demo.workspace.started", "Demo Workspace System", { workspace: workspaceId, name: wsName }, workspaceId, wsName);

  const cleared = await deleteWorkspaceRecords("tickets", workspaceId);
  await deleteWorkspaceRecords("signals", workspaceId);
  await deleteWorkspaceRecords("incidents", workspaceId);
  await deleteWorkspaceRecords("drafts", workspaceId);
  await deleteWorkspaceRecords("audit_logs", workspaceId);
  await deleteWorkspaceRecords("approvals", workspaceId);
  await deleteWorkspaceRecords("memory_entries", workspaceId);
  await deleteWorkspaceRecords("ticket_incidents", workspaceId);

  advance("importing_tickets");

  const createdTicketIds = [];
  for (let i = 0; i < dataset.tickets.length; i++) {
    const t = dataset.tickets[i];
    try {
      const result = await client.functions.run("create_ticket", {
        input: {
          title: t.title,
          customer_name: t.customer.name,
          customer_email: t.customer.email,
          body: t.body,
          channel: "email",
        },
      });
      const ticketId = result.output_data?.ticket_id || result.ticket_id || result.id;
      if (ticketId) {
        await client.records.update("tickets", ticketId, {
          priority: t.priority,
          category: t.category,
          status: "open",
          created_at: t.created_at,
          workspaceId,
          workspaceName: wsName,
          tags: [DEMO_TAG, `workspace:${workspaceId}`],
        });
        createdTicketIds.push(ticketId);
      }
    } catch (err) {
      console.warn("Failed to create ticket:", t.title, err?.message);
    }

    if (i % 3 === 2) {
      await sleep(100);
      done++;
      emitProgress({
        step: currentStep(done, totalSteps),
        done: Math.min(done, totalSteps),
        total: totalSteps,
        label: `Importing tickets (${Math.min(i + 1, totalTickets)} of ${totalTickets})`,
        workspaceName: wsName,
      });
    }
  }

  await createAuditLog("demo.dataset.imported", "Demo Workspace System",
    { tickets: createdTicketIds.length, workspaceId }, workspaceId, wsName);

  advance("running_detection");

  const total = createdTicketIds.length;
  let processed = 0;

  const batchSize = Math.max(1, Math.floor(total / 8));
  for (let i = 0; i < createdTicketIds.length; i += batchSize) {
    const batch = createdTicketIds.slice(i, i + batchSize);
    for (const ticketId of batch) {
      try {
        await runDetection(ticketId, workspaceId, wsName);
      } catch { /* individual detection errors are non-fatal */ }
      processed++;
    }
    done++;
    const step = currentStep(done, totalSteps);
    const labelMap = {
      running_detection: `Processing tickets (${Math.min(processed, total)} of ${total})`,
      building_clusters: "Building ticket similarity clusters",
      creating_signals: "Creating detected Signals",
      analyzing_impact: "Analyzing business impact",
      escalating_incidents: "Escalating to Incidents",
      generating_handoffs: "Generating Engineering Handoffs",
      creating_drafts: "Creating AI Draft Replies",
    };
    emitProgress({
      step,
      done: Math.min(done, totalSteps),
      total: totalSteps,
      label: labelMap[step] || STEP_LABELS[step] || step,
      workspaceName: wsName,
    });
    if (i + batchSize < createdTicketIds.length) await sleep(150);
  }

  if (done < 10) {
    while (done < 10) {
      done++;
      emitProgress({
        step: currentStep(done, totalSteps),
        done: Math.min(done, totalSteps),
        total: totalSteps,
        label: "Finalizing analysis",
        workspaceName: wsName,
      });
      await sleep(200);
    }
  }

  advance("updating_knowledge");

  const memoryEntries = [];
  if (workspaceId === "binocs") {
    memoryEntries.push(
      {
        title: "Financial Report Generation Failure Resolution",
        summary: "Diagnosis and resolution guide for financial report generation failures including portfolio aggregation errors, IRR calculation issues, and PDF generation problems.",
        body: "Financial report generation failures at Binocs typically stem from portfolio aggregation pipeline timeouts, stale market data feeds, or report template rendering errors. Step-by-step: (1) Verify market data feed connectivity and check for stale pricing data, (2) Restart the aggregation pipeline service, (3) Clear the report generation queue backlog, (4) Validate IRR calculation inputs against manual computations, (5) Regenerate failed PDFs through the report retry endpoint.",
        root_cause: "The portfolio aggregation pipeline was consuming excessive memory due to a missing index on the holdings table, causing the report generation service to crash under load.",
        resolution: "Add composite index on holdings table (portfolio_id, date), increase aggregation pipeline memory limit from 512MB to 2GB, and implement retry logic with exponential backoff for transient failures.",
        category: "Financial Report",
        tags: ["financial-report", "aggregation", "irr", "pdf", "portfolio"],
        confidence: 93,
        customers_affected: 8,
        resolution_time_hours: 3.0,
        severity: "critical",
      },
      {
        title: "OCR Document Processing Pipeline Troubleshooting",
        summary: "Standard operating procedure for resolving OCR pipeline failures affecting scanned document processing and AI risk scoring.",
        body: "The OCR document processing pipeline at Binocs receives scanned due diligence documents and converts them to machine-readable text for AI risk analysis. When the pipeline fails, documents remain in pending state without progressing through the workflow. The failure typically occurs at the PDF parsing stage or the text extraction stage. Resolution: (1) Check PDF file integrity and format compatibility, (2) Restart the OCR worker service, (3) Verify Tesseract OCR engine is responsive, (4) Check disk space on the processing server, (5) Re-queue failed documents through the admin reprocessing endpoint.",
        root_cause: "The OCR worker service ran out of memory due to a memory leak in the PDF parsing library when processing large multi-page scanned documents.",
        resolution: "Update PDF parsing library to the latest version, implement page-level processing with memory limits, add monitoring alerts for worker memory usage above 80%.",
        category: "Document Review",
        tags: ["ocr", "document-processing", "pdf", "risk-scoring"],
        confidence: 90,
        customers_affected: 5,
        resolution_time_hours: 2.5,
        severity: "high",
      }
    );
  }

  for (const entry of memoryEntries) {
    try {
      const result = await client.functions.run("create_memory_entry", {
        input: {
          title: entry.title,
          summary: entry.summary,
          root_cause: entry.root_cause,
          source_signal_id: null,
          category: entry.category,
          tags: entry.tags,
          confidence: entry.confidence,
          workspaceId,
          workspaceName: wsName,
        },
      });
      const memId = result.output_data?.id || result.id;
      if (memId) {
        await client.records.update("memory_entries", memId, {
          body: entry.body,
          resolution: entry.resolution,
          customers_affected: entry.customers_affected,
          resolution_time_hours: entry.resolution_time_hours,
          severity: entry.severity,
          status: "published",
          workspaceId,
          workspaceName: wsName,
          tags: [DEMO_TAG, `workspace:${workspaceId}`],
        });
      }
    } catch { /* silent */ }
    await sleep(200);
  }

  advance("refreshing");

  emitRefresh();
  emitProgress({
    step: "complete",
    done: totalSteps,
    total: totalSteps,
    label: "Complete",
    workspaceName: wsName,
  });

  await sleep(300);
  emitRefresh();

  await createAuditLog("demo.workflow.completed", "Demo Workspace System", {
    workspace: workspaceId,
    name: wsName,
    tickets_created: createdTicketIds.length,
  }, workspaceId, wsName);

  const result = {
    workspaceName: wsName,
    ticketsCreated: createdTicketIds.length,
    signalsGenerated: dataset.expected.signals,
    incidentsGenerated: dataset.expected.incidents,
    knowledgeGenerated: memoryEntries.length,
    draftReplies: Math.min(createdTicketIds.length, 8),
    notifications: createdTicketIds.length + 5,
  };

  window.dispatchEvent(new CustomEvent(DEMO_COMPLETE_EVENT, { detail: result }));

  return result;
}
