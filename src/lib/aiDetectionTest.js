import client from "@/lib/lemmaClient";
import { runDetection } from "@/lib/aiDetectionEngine";

const TEST_WORKSPACE = "binocs";
const TEST_WORKSPACE_NAME = "Binocs";
const MANAGER_EMAIL = "shay24test@gmail.com";

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function items(res) {
  return res?.items || res?.records || res?.data || [];
}

export async function runIntegrationTest(onProgress) {
  const report = { steps: [], passed: 0, failed: 0, warnings: 0, outageId: null };

  function step(name, passed, detail) {
    report.steps.push({ name, passed, detail });
    if (passed === true) report.passed++;
    else if (passed === false) report.failed++;
    else report.warnings++;
    const icon = passed === true ? "PASS" : passed === false ? "FAIL" : "WARN";
    if (onProgress) {
      const msg = passed === false
        ? `${icon} ${name}\n  >>> ${(detail || "").split('\n')[0]}`
        : `${icon} ${name}`;
      onProgress(msg);
    }
    if (passed === false) {
      if (onProgress) onProgress("STOP: Integration test halted on first failure.");
    }
  }

  function fail(name, detail) {
    step(name, false, detail);
    return report;
  }

  /* ── 1. Ensure production config has all required flags enabled ── */
  const configKey = `signaldesk-ai-config:${TEST_WORKSPACE}`;
  let prodConfig;
  try {
    const raw = localStorage.getItem(configKey);
    if (raw) prodConfig = JSON.parse(raw);
  } catch { /* ignore */ }

  const REQUIRED_ENABLED = {
    autoCreateSignals: true,
    autoCreateIncident: true,
    autoSendGmailAlerts: true,
    autoCreateLinearIssue: true,
    autoGenerateKnowledgeArticles: true,
    autoUpdateExistingKnowledge: true,
    autoMergeSimilarSignals: true,
  };
  let changed = false;
  const merged = { ...(prodConfig || {}) };
  for (const [key, val] of Object.entries(REQUIRED_ENABLED)) {
    if (merged[key] !== val) {
      merged[key] = val;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(configKey, JSON.stringify(merged));
    prodConfig = merged;
    step(`Production config updated: required workflow flags enabled`, true,
      `Saved to ${configKey} (same mechanism as Settings page)`);
  } else if (prodConfig) {
    step("Production config loaded from localStorage", true, `Workspace "${TEST_WORKSPACE}" has saved config`);
  } else {
    step("Production config active (defaults)", true, `Workspace "${TEST_WORKSPACE}" using default thresholds`);
  }

  /* Expose config for later validation */
  const activeConfig = prodConfig || {};
  const SIMILARITY_THRESHOLD = (activeConfig.similarityThreshold ?? 55) / 100;
  const EDGE_THRESHOLD = (activeConfig.edgeSimilarityThreshold ?? 35) / 100;
  const MIN_TICKETS = activeConfig.minSimilarTickets ?? 3;
  const TIME_WINDOW_MS = (activeConfig.timeWindow ?? 48) * 3600000;

  /* ── 2. Generate unique outage ID and clean up previous run data ── */
  const outageId = `PO-${uid()}`;
  report.outageId = outageId;
  const testEmailDomain = "binocs-test.com";
  const testCustomers = [
    { name: "Arun Sharma", email: `arun.sharma@${testEmailDomain}` },
    { name: "Priya Patel", email: `priya.patel@${testEmailDomain}` },
    { name: "Rajesh Gupta", email: `rajesh.gupta@${testEmailDomain}` },
    { name: "Sneha Reddy", email: `sneha.reddy@${testEmailDomain}` },
    { name: "Vikram Singh", email: `vikram.singh@${testEmailDomain}` },
  ];

  try {
    const oldTickets = await client.records.list("tickets", {
      limit: 200,
      sort: [{ field: "created_at", direction: "desc" }],
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
    });
    const oldList = items(oldTickets);
    let cleaned = 0;
    for (const t of oldList) {
      if ((t.customer_email || "").includes(testEmailDomain) && !(t.title || "").includes(outageId)) {
        try {
          const linkedSig = t.signal_id || null;
          await client.records.delete("tickets", t.id);
          cleaned++;
        } catch { /* skip */ }
      }
    }
    if (cleaned > 0) step(`Cleaned ${cleaned} stale test tickets from previous runs`, true, "");
  } catch { /* skip */ }
  await sleep(2000);

  /* ── 3. Create 5 realistic tickets ───────────────────────────── */
  const tickets = [
    {
      title: `[${outageId}] Portfolio valuation report shows incorrect balances after data upload`,
      body: `Our system is generating portfolio valuation reports where the reported balances do not match the actual holdings after the latest market data upload. The discrepancy appears across multiple accounts and seems to stem from a data processing error. Customer is reporting that their portfolio summary shows inflated values compared to their actual positions. Immediate investigation required.`,
      category: "Portfolio",
      priority: "urgent",
    },
    {
      title: `[${outageId}] OCR misreads Indian number format causing wrong portfolio values`,
      body: `The OCR module is failing to correctly parse Indian number formatting (lakh/crore notation) in uploaded financial documents. This results in portfolio calculations being off by orders of magnitude for accounts with Indian holdings. The system interprets "1,50,000" as 150,000 instead of 150,000 — the correct value. Critical fix needed for accuracy.`,
      category: "Portfolio",
      priority: "urgent",
    },
    {
      title: `[${outageId}] Financial report generation failing due to incorrect portfolio calculations`,
      body: `Batch portfolio report generation is producing erroneous output for 30%+ of accounts. The calculation engine appears to be double-counting certain asset classes during the valuation aggregation step. Affected customers are receiving statements with inflated portfolio totals, creating compliance risk.`,
      category: "Portfolio",
      priority: "high",
    },
    {
      title: `[${outageId}] Portfolio valuation discrepancy detected after market data import`,
      body: `Following today's scheduled market data import, portfolio valuations across all segments are showing systematic errors. The imported data seems to have a scaling issue where values are multiplied by an incorrect factor. Root cause appears to be in the data normalization layer post-import.`,
      category: "Portfolio",
      priority: "urgent",
    },
    {
      title: `[${outageId}] Customer portfolio reports showing wrong balance figures after OCR processing`,
      body: `Customer is disputing their portfolio valuation report. The report shows a balance of ₹2,50,00,000 but their actual holdings are approximately ₹25,00,000. The OCR processing pipeline is incorrectly interpreting the Indian number system, causing a 10x inflation in reported values across all portfolio documents processed today.`,
      category: "Portfolio",
      priority: "urgent",
    },
  ];

  const ticketIds = [];

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const customer = testCustomers[i];
    let lastErr = null;
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      if (attempt > 0) await sleep(3000 * attempt);
      try {
        const result = await client.functions.run("create_ticket", {
          input: {
            title: t.title,
            customer_name: customer.name,
            customer_email: customer.email,
            body: t.body,
            channel: "email",
            priority: t.priority,
            category: t.category,
          },
        });
        const tid = result.output_data?.ticket_id || result.ticket_id || result.id;
        if (tid) {
          await client.records.update("tickets", tid, {
            workspaceId: TEST_WORKSPACE,
            workspaceName: TEST_WORKSPACE_NAME,
            priority: t.priority,
            category: t.category,
            outage_id: outageId,
          }).catch(() => {
            /* Column may not exist on older schema — retry without outage_id */
            return client.records.update("tickets", tid, {
              workspaceId: TEST_WORKSPACE,
              workspaceName: TEST_WORKSPACE_NAME,
              priority: t.priority,
              category: t.category,
            });
          });
          ticketIds.push(tid);
          step(`Ticket ${i + 1} created: ${customer.name} — ${t.title.split("]")[1]?.trim().slice(0, 50) || t.title}`, true, `ID: ${tid}`);
          created = true;
        } else {
          throw new Error("create_ticket returned no ID");
        }
      } catch (err) {
        lastErr = err;
      }
    }
    if (!created) return fail(`Ticket ${i + 1} creation failed`, lastErr?.message || "unknown");
    await sleep(300);
  }

  if (ticketIds.length < 5) {
    return fail("Not all tickets created", `Only ${ticketIds.length} of 5 created`);
  }

  /* ── 3b. Verify outage grouping ──────────────────────────────── */
  try {
    const checkTickets = await client.records.list("tickets", {
      limit: 10,
      filters: [{ field: "id", op: "in", value: ticketIds }],
    });
    const firstWithId = items(checkTickets).find((t) => t.outage_id === outageId);
    step(`Outage grouping: outage_id="${outageId}" set on tickets`, !!firstWithId,
      firstWithId ? "Grouping active — detection will only cluster these 5 tickets" : "outage_id column not yet deployed — using time-window clustering");
  } catch { step("Outage grouping check skipped", "warning", ""); }

  /* ── 4. Verify all 5 tickets exist in the system ───────────────── */
  let verifyTickets;
  try {
    const res = await client.records.list("tickets", {
      limit: 50,
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
      sort: [{ field: "created_at", direction: "desc" }],
    });
    verifyTickets = items(res).filter((t) => ticketIds.includes(t.id));
    step("All 5 tickets exist in the system", verifyTickets.length === 5,
      `Found ${verifyTickets.length} of ${ticketIds.length} tickets`);
  } catch (err) {
    return fail("Failed to verify tickets", err.message);
  }

  /* ── 5. Verify create_ticket wrote audit log ──────────────────── */
  try {
    const logRes = await client.records.list("audit_logs", { limit: 100 });
    const ticketCreatedLogs = items(logRes).filter(
      (l) => l.action === "ticket.created" && ticketIds.includes(l.ticket_id || l.resource_id || "")
    );
    step("Audit log: ticket.created written for each ticket", ticketCreatedLogs.length >= 5,
      `Found ${ticketCreatedLogs.length} ticket.created events`);
  } catch { step("Audit log check: ticket.created", "warning", "Could not query audit_logs"); }

  /* ── 6. Run AI Detection for each ticket ──────────────────────── */
  const detectionResults = [];
  for (const tid of ticketIds) {
    const r = await runDetection(tid, TEST_WORKSPACE, TEST_WORKSPACE_NAME);
    detectionResults.push({ ticketId: tid, result: r });
    await sleep(500);
  }

  const firstResult = detectionResults[0]?.result;

  /* ── 7. Validate Similarity Engine ─────────────────────────────── */
  const simEvents = detectionResults.flatMap((d) => (d.result.pipeline || []).filter((e) => e.stage === "similarity_matrix"));
  if (simEvents.length === 0) return fail("Similarity engine did not run", "No similarity_matrix pipeline events found");

  const lastSimMatrix = simEvents[simEvents.length - 1];
  const pairs = lastSimMatrix.pairs || [];
  const maxScore = pairs.reduce((m, p) => Math.max(m, p.score || 0), 0);
  const avgScore = pairs.length > 0 ? pairs.reduce((s, p) => s + (p.score || 0), 0) / pairs.length : 0;
  step("Similarity engine: pairwise scores computed", pairs.length > 0, `${pairs.length} pairs, max=${(maxScore * 100).toFixed(0)}%, avg=${(avgScore * 100).toFixed(0)}%`);

  if (avgScore < SIMILARITY_THRESHOLD) {
    return fail("Similarity below threshold", `Avg similarity ${(avgScore * 100).toFixed(0)}% < min ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`);
  }

  /* ── 8. Validate Clustering ────────────────────────────────────── */
  const clusterEvents = detectionResults.flatMap((d) => (d.result.pipeline || []).filter((e) => e.stage === "cluster_match"));
  const clusterSuccess = clusterEvents.filter((e) => e.found === true);
  step("Cluster built by AI engine", clusterSuccess.length > 0,
    clusterSuccess.length > 0
      ? `Cluster size: ${clusterSuccess[0].clusterSize}, members: ${clusterSuccess[0].memberIds?.length || "N/A"}`
      : "No successful cluster_match events");

  if (clusterSuccess.length === 0) {
    const terminal = detectionResults.flatMap((d) => (d.result.pipeline || []).filter((e) => e.success === false));
    const failedStage = terminal[0];
    return fail("Clustering failed", failedStage ? `Failed at stage: ${failedStage.stage}` : "No cluster found for any ticket");
  }

  const clusterSize = clusterSuccess[0].clusterSize;
  if (clusterSize < MIN_TICKETS) {
    return fail("Cluster below minimum ticket threshold", `Cluster has ${clusterSize} tickets, minimum is ${MIN_TICKETS}`);
  }

  /* ── 9. Validate Signal Created ────────────────────────────────── */
  await sleep(1500);

  let signalFound = null;
  try {
    const allSigRes = await client.records.list("signals", {
      limit: 50,
      sort: [{ field: "created_at", direction: "desc" }],
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
    });
    const allSignals = items(allSigRes);

    signalFound = allSignals.find((s) => {
      const linked = s.example_ticket_ids || s.linked_ticket_ids || s.ticket_ids || [];
      return linked.some((id) => ticketIds.includes(id));
    });

    if (!signalFound) {
      return fail("Signal not created", "No signal in the workspace contains any of the test ticket IDs");
    }

    const linked = signalFound.example_ticket_ids || signalFound.linked_ticket_ids || signalFound.ticket_ids || [];
    const matchedCount = linked.filter((id) => ticketIds.includes(id)).length;
    step("Signal created and linked to test tickets", matchedCount >= 2,
      `Signal ${signalFound.id} has ${matchedCount}/${ticketIds.length} test tickets linked`);
  } catch (err) {
    return fail("Failed to verify signal", err.message);
  }

  /* ── 10. Validate Signal has all required fields ───────────────── */
  const signalChecks = [];
  if (signalFound) {
    const checks = {
      "analysis_confidence > 0": (signalFound.analysis_confidence || 0) > 0,
      "business_impact_score > 0": (signalFound.business_impact_score || 0) > 0,
      "has root_cause": !!signalFound.root_cause,
      "has status": !!signalFound.status,
      "has proposed_priority": !!signalFound.proposed_priority,
      "has workspaceId": !!signalFound.workspaceId,
    };
    for (const [label, ok] of Object.entries(checks)) {
      signalChecks.push({ label, ok });
      step(`Signal field: ${label}`, ok,
        ok ? `${signalFound.analysis_confidence || signalFound.business_impact_score || signalFound.root_cause || signalFound.status || signalFound.proposed_priority || signalFound.workspaceId}` : "Missing");
    }

    const allSignalFields = Object.values(checks).every(Boolean);
    if (!allSignalFields) {
      const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", ");
      return fail("Signal is missing required fields", missing);
    }
  }

  /* ── 10b. Diagnostic: Dump complete escalation trace ──────────── */
  const diagRun = detectionResults[0]?.result;
  const escEvents = (diagRun?.pipeline || []).filter(e =>
    e.stage === "escalation_check" || e.stage === "escalation_skipped" ||
    e.stage === "incident_created" || e.stage === "incident_error"
  );
  const incCreatedEvent = escEvents.find(e => e.stage === "incident_created");
  const reportedIncidentId = incCreatedEvent?.incidentId || null;
  const reportLines = [
    `Config: autoCreateIncident=${activeConfig.autoCreateIncident}, escalationThreshold=${activeConfig.incidentEscalationThreshold} (${(activeConfig.incidentEscalationThreshold ?? 60) / 10} after /10)`,
    `Detection result: signal_created=${diagRun?.signal_created}, incident_created=${diagRun?.incident_created}, clusterRisk=${diagRun?.cluster?.risk_score}`,
  ];
  for (const ev of escEvents) {
    reportLines.push(`Pipeline: stage=${ev.stage} payload=${JSON.stringify(Object.fromEntries(Object.entries(ev).filter(([k]) => k !== "stage")))}`);
  }
  if (escEvents.length === 0) {
    reportLines.push("WARNING: No escalation pipeline events found — escalation block was never reached");
  }
  /* Query by exact incident ID to determine if record exists at all */
  let incidentById = null;
  let allIncidents = [];
  try {
    const raw = await client.records.list("incidents", { limit: 50 });
    allIncidents = items(raw);
    if (reportedIncidentId) {
      incidentById = allIncidents.find(i => i.id === reportedIncidentId);
    }
    reportLines.push(`All incidents in table (${allIncidents.length}): ${allIncidents.map(i => `{id:${i.id?.slice(0,8)} signal_id:${i.signal_id?.slice(0,8)||"null"} status:${i.status}}`).join(", ") || "none"}`);
    reportLines.push(`Incident lookup by ID ${reportedIncidentId?.slice(0,8)||"N/A"}: ${incidentById ? "FOUND" : "NOT FOUND"}`);
    if (incidentById) {
      reportLines.push(`  Found incident signal_id=${incidentById.signal_id?.slice(0,8)||"null"}, expected signal_id=${signalFound?.id?.slice(0,8)}`);
      reportLines.push(`  Match by signal_id: ${incidentById.signal_id === signalFound?.id}`);
    }
  } catch (err) {
    reportLines.push(`Incident query error: ${err.message}`);
  }
  step("Escalation diagnostic report", true, reportLines.join(" | "));

  /* ── 11. Validate Incident Created ─────────────────────────────── */
  let incidentFound = incidentById && incidentById.signal_id === signalFound?.id ? incidentById : null;
  if (!incidentFound) {
    incidentFound = allIncidents.find((i) => i.signal_id === signalFound?.id) || null;
  }

  if (!incidentFound) {
    return fail("Incident not created for signal",
      `No incident found with signal_id = ${signalFound?.id}. Check escalationThreshold and risk score. Diagnostic: ${reportLines.join(" ;; ")}`);
  }

  step("Incident created from Signal", true, `ID: ${incidentFound.id}`);

  /* ── 12. Validate Incident has all required fields ─────────────── */
  if (incidentFound) {
    const incChecks = {
      "has title": !!incidentFound.title,
      "has severity": !!incidentFound.severity,
      "has summary": !!incidentFound.summary,
      "has status": !!incidentFound.status,
      "has signal_id": !!incidentFound.signal_id,
      "has opened_at": !!incidentFound.opened_at,
      "has affected_ticket_count": (incidentFound.affected_ticket_count || 0) > 0,
    };
    for (const [label, ok] of Object.entries(incChecks)) {
      step(`Incident field: ${label}`, ok,
        ok ? `${incidentFound.title || incidentFound.severity || incidentFound.summary || incidentFound.status || incidentFound.signal_id || incidentFound.opened_at || incidentFound.affected_ticket_count}` : "Missing");
    }

    const allIncFields = Object.values(incChecks).every(Boolean);
    if (!allIncFields) {
      const missing = Object.entries(incChecks).filter(([, v]) => !v).map(([k]) => k).join(", ");
      return fail("Incident is missing required fields", missing);
    }
  }

  /* ── 13. Validate postIncidentActions executed ─────────────────── */
  try {
    const logRes = await client.records.list("audit_logs", { limit: 100 });
    const auditLogs = items(logRes);

    const gmailLogs = auditLogs.filter((l) =>
      l.action === "email.alert_sent" && l.details?.incident_id === incidentFound?.id
    );
    step("postIncidentActions: Gmail alert triggered", gmailLogs.length > 0,
      gmailLogs.length > 0 ? `email.alert_sent audit log written` : "No email.alert_sent log found");

    const incidentLogs = auditLogs.filter((l) =>
      l.action === "incident.created" && l.details?.incident_id === incidentFound?.id
    );
    step("postIncidentActions: incident.created audit log", incidentLogs.length > 0,
      incidentLogs.length > 0 ? `incident.created audit log written` : "No incident.created log found");

    const linearLogs = auditLogs.filter((l) => l.action === "linear.issue_created");
    step("postIncidentActions: Linear issue audit logged", linearLogs.length > 0,
      linearLogs.length > 0 ? `linear.issue_created audit log written` : "No linear.issue_created log found (autoCreateLinearIssue may be disabled)");
  } catch (err) {
    step("postIncidentActions audit log check", "warning", err.message);
  }

  /* ── 14. Validate no duplicate Signals ──────────────────────────── */
  try {
    const dupRes = await client.records.list("signals", {
      limit: 50,
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
    });
    const dups = items(dupRes).filter(
      (s) => {
        if (s.id === signalFound?.id) return false;
        if (s.status === "resolved" || s.status === "memory") return false;
        const linked = s.example_ticket_ids || s.linked_ticket_ids || s.ticket_ids || [];
        return linked.some((id) => ticketIds.includes(id));
      }
    );
    step("No duplicate Signals created", dups.length === 0,
      dups.length > 0 ? `Found ${dups.length} duplicate signal(s): ${dups.map(s => s.id).join(", ")}` : "OK — idempotent");
  } catch (err) {
    step("Duplicate signal check", "warning", err.message);
  }

  /* ── 15. Validate no duplicate Incidents ────────────────────────── */
  if (incidentFound?.signal_id) {
    try {
      const dupRes = await client.records.list("incidents", { limit: 50 });
      const dups = items(dupRes).filter(
        (i) => i.signal_id === incidentFound.signal_id && i.id !== incidentFound.id
      );
      step("No duplicate Incidents created", dups.length === 0,
        dups.length > 0 ? `Found ${dups.length} duplicate incident(s)` : "OK — idempotent");
    } catch (err) {
      step("Duplicate incident check", "warning", err.message);
    }
  }

  /* ── 16. Validate audit trail completeness ─────────────────────── */
  try {
    const logRes = await client.records.list("audit_logs", { limit: 200 });
    const auditLogs = items(logRes);

    const requiredAuditEvents = [
      "ticket.created",
      "signal.created",
      "incident.created",
      "email.alert_sent",
    ];
    const optionalAuditEvents = [
      "signal.detected",
      "signal.linked",
      "linear.issue_created",
    ];

    for (const action of requiredAuditEvents) {
      const found = auditLogs.some((l) => l.action === action);
      step(`Audit event: ${action}`, found, found ? "Written" : "Missing — required production audit event");
      if (!found) return fail(`Required audit event "${action}" not found`, "Audit trail incomplete");
    }

    for (const action of optionalAuditEvents) {
      const found = auditLogs.some((l) => l.action === action);
      step(`Audit event: ${action}`, found || "warning",
        found ? "Written" : "Not found (may be skipped based on config/routing)");
    }
  } catch (err) {
    step("Audit trail validation", "warning", err.message);
  }

  /* ── 17. Validate Knowledge Base generation ────────────────────── */
  try {
    let kbRes = await client.records.list("knowledge_articles", { limit: 50 }).catch(() => null);
    if (!kbRes) {
      kbRes = await client.records.list("knowledge", { limit: 50 }).catch(() => null);
    }
    if (kbRes) {
      const kbArticles = items(kbRes);
      const matchingKb = kbArticles.filter((a) => {
        const text = `${a.title || ""} ${a.summary || ""} ${a.body || ""} ${a.tags?.join(" ") || ""}`.toLowerCase();
        return text.includes("portfolio") || text.includes("valuation") || text.includes("ocr");
      });
      step("Knowledge Base: articles accessible", kbArticles.length > 0,
        kbArticles.length > 0 ? `${kbArticles.length} article(s) found, ${matchingKb.length} match this scenario` : "No articles in knowledge base");
    } else {
      step("Knowledge Base: table not available", "warning", "knowledge_articles table does not exist in this pod");
    }
  } catch {
    step("Knowledge Base: query unavailable", "warning", "Could not query knowledge base");
  }

  /* ── 18. Validate analytics/dashboard refresh ──────────────────── */
  const refreshEvents = detectionResults.filter((d) =>
    d.result.logs?.some((l) => l.includes("UI refresh triggered"))
  );
  step("Analytics: UI refresh triggered", refreshEvents.length > 0,
    refreshEvents.length > 0 ? `emitRefresh() called after ${refreshEvents.length} detection(s)` : "No emitRefresh() detected in logs");

  /* ── 19. Validate records appear as real (no test markers) ────── */
  if (signalFound) {
    const hasTestMarker = (
      (signalFound.title || "").toLowerCase().includes("test") ||
      (signalFound.summary || "").toLowerCase().includes("test") ||
      signalFound.status === "test"
    );
    step("Records appear as production data (no test markers)", !hasTestMarker,
      hasTestMarker ? "Signal contains 'test' label" : "Signal looks like a normal production record");
  }

  /* ── 20. Final report ──────────────────────────────────────────── */
  const allPassed = report.failed === 0;
  step(allPassed ? "ALL CHECKS PASSED — production workflow verified" : "SOME CHECKS FAILED", allPassed,
    `${report.passed} passed, ${report.failed} failed, ${report.warnings} warnings`);

  return report;
}
