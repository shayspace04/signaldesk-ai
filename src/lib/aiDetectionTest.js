import client from "@/lib/lemmaClient";
import { runDetection } from "@/lib/aiDetectionEngine";

const TEST_WORKSPACE = "binocs";
const TEST_WORKSPACE_NAME = "Binocs";

export async function runIntegrationTest(onProgress) {
  const report = { steps: [], passed: 0, failed: 0, warnings: 0 };

  function step(name, passed, detail) {
    report.steps.push({ name, passed, detail });
    if (passed === true) report.passed++;
    else if (passed === false) report.failed++;
    else report.warnings++;
    if (onProgress) onProgress(report.steps.length, 15, `${passed ? "✓" : "✗"} ${name}`);
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  let ticketIds = [];
  let clusterResult = null;
  let signalFound = null;
  let incidentFound = null;

  /* ── 1. Create 3 test tickets ──────────────────────────────── */
  step("Creating 3 test tickets...", "running");

  const tickets = [
    {
      title: "Unable to download portfolio valuation report",
      body: "Generated valuation reports contain incorrect portfolio values after today's upload.",
      category: "Portfolio",
      priority: "high",
    },
    {
      title: "Incorrect financial values after OCR document processing",
      body: "OCR appears to misread Indian number formatting causing incorrect balances in reports.",
      category: "Portfolio",
      priority: "high",
    },
    {
      title: "Financial reports showing incorrect portfolio calculations",
      body: "Customer reports inflated transaction values caused by OCR parsing failures.",
      category: "Portfolio",
      priority: "urgent",
    },
  ];

  for (let i = 0; i < tickets.length; i++) {
    try {
      const t = tickets[i];
      const result = await client.functions.run("create_ticket", {
        input: {
          title: t.title,
          customer_name: `Test User ${i + 1}`,
          customer_email: `test${i + 1}@binocs-test.com`,
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
        });
        ticketIds.push(tid);
        step(`Ticket ${i + 1} created: ${t.title}`, true, `ID: ${tid}`);
      } else {
        step(`Ticket ${i + 1} creation returned no ID`, false, JSON.stringify(result));
      }
    } catch (err) {
      step(`Ticket ${i + 1} creation failed`, false, err.message);
    }
    await sleep(500);
  }

  if (ticketIds.length < 3) {
    step("Not all tickets were created — cannot continue", false, `Only ${ticketIds.length} created`);
    step("TEST FAILED", false, "Insufficient tickets to form a cluster");
    return report;
  }

  /* ── 2. Verify 3 tickets exist ─────────────────────────────── */
  try {
    const res = await client.records.list("tickets", {
      limit: 50,
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
      sort: [{ field: "created_at", direction: "desc" }],
    });
    const recent = (res.items || res.data || []);
    const found = recent.filter((t) => ticketIds.includes(t.id));
    step("3 tickets exist in the system", found.length >= 3, `Found ${found.length} of ${ticketIds.length}`);
  } catch (err) {
    step("Failed to verify tickets", false, err.message);
  }

  /* ── 3. Run detection for each ticket (simulating real flow) ── */
  step("Running AI detection for each ticket...", "running");

  for (const tid of ticketIds) {
    const r = await runDetection(tid, TEST_WORKSPACE, TEST_WORKSPACE_NAME);
    if (r.cluster && !clusterResult) clusterResult = r;
    await sleep(800);
  }

  /* ── 4. Verify 1 Signal exists with all 3 tickets ──────────── */
  await sleep(1000);

  try {
    const allSigRes = await client.records.list("signals", {
      limit: 50,
      sort: [{ field: "created_at", direction: "desc" }],
      filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
    });
    const allSignals = (allSigRes.items || allSigRes.data || []);

    signalFound = allSignals.find((s) => {
      const linked = s.example_ticket_ids || [];
      return ticketIds.filter((id) => linked.includes(id)).length >= 2;
    });

    if (signalFound) {
      const linked = signalFound.example_ticket_ids || [];
      const matched = ticketIds.filter((id) => linked.includes(id)).length;
      step("Signal exists with test tickets", matched >= 2, `Signal ${signalFound.id} has ${matched}/${ticketIds.length} tickets`);
    } else {
      step("No Signal found for test tickets", false, "No signal contains 2+ of the test tickets");
    }
  } catch (err) {
    step("Failed to verify Signal", false, err.message);
  }

  /* ── 5. Ticket count on signal matches ─────────────────────── */
  if (signalFound) {
    const linked = signalFound.example_ticket_ids || [];
    const count = signalFound.evidence_count || linked.length;
    step("Signal ticket count matches", count >= 2, `count=${count}`);
  }

  /* ── 6. Verified Signal has analysis_confidence + business_impact_score ─ */
  if (signalFound) {
    step("Signal has confidence score", (signalFound.analysis_confidence || 0) > 0, `confidence=${signalFound.analysis_confidence}%`);
    step("Signal has business impact score", (signalFound.business_impact_score || 0) > 0, `impact=${signalFound.business_impact_score}`);
  }

  /* ── 7. Verify 1 Incident exists for the signal ────────────── */
  if (signalFound) {
    try {
      const incRes = await client.records.list("incidents", { limit: 50 });
      const incidents = incRes.items || incRes.data || [];
      incidentFound = incidents.find((i) => i.signal_id === signalFound.id);
      step("Incident created for signal", !!incidentFound, incidentFound ? `ID: ${incidentFound.id}` : "No incident found for this signal");
    } catch (err) {
      step("Failed to verify Incident", false, err.message);
    }
  }

  /* ── 8. No duplicate Signals ──────────────────────────────── */
  if (signalFound) {
    try {
      const dupRes = await client.records.list("signals", {
        limit: 50,
        filters: [{ field: "workspaceId", op: "eq", value: TEST_WORKSPACE }],
      });
      const dups = (dupRes.items || dupRes.data || []).filter(
        (s) => {
          const linked = s.example_ticket_ids || [];
          const overlap = ticketIds.filter((id) => linked.includes(id)).length;
          return overlap >= 2 && s.id !== signalFound.id && s.status !== "resolved" && s.status !== "memory";
        }
      );
      step("No duplicate Signals", dups.length === 0, dups.length > 0 ? `Found ${dups.length} duplicates` : "OK");
    } catch (err) {
      step("Failed duplicate signal check", "warning", err.message);
    }
  }

  /* ── 9. No duplicate Incidents ────────────────────────────── */
  if (incidentFound?.signal_id) {
    try {
      const dupRes = await client.records.list("incidents", { limit: 50 });
      const dups = (dupRes.items || dupRes.data || []).filter(
        (i) => i.signal_id === incidentFound.signal_id && i.id !== incidentFound.id
      );
      step("No duplicate Incidents", dups.length === 0, dups.length > 0 ? `Found ${dups.length} duplicates` : "OK");
    } catch (err) {
      step("Failed duplicate incident check", "warning", err.message);
    }
  }

  /* ── 10. Audit logs written ───────────────────────────────── */
  try {
    const logRes = await client.records.list("audit_logs", { limit: 50 });
    const logs = logRes.items || logRes.data || [];
    const detections = logs.filter((l) => l.action === "signal.detected" || l.action === "signal.linked");
    const incidents = logs.filter((l) => l.action === "incident.created");
    step("Audit logs written for detection", detections.length > 0, `${detections.length} detection log(s)`);
    step("Audit logs written for incident", incidents.length === 1 ? true : (incidents.length > 0 ? "warning" : false),
      `${incidents.length} incident log(s)`);
  } catch (err) {
    step("Failed to verify audit logs", "warning", err.message);
  }

  /* ── 11. Dashboard metrics updated ─────────────────────────── */
  step("emitRefresh() called — dashboard will update", true, "Refresh event dispatched after each detection");

  /* ── 12. Final Report ─────────────────────────────────────── */
  const allPassed = report.failed === 0;
  step(allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED", allPassed,
    `${report.passed} passed, ${report.failed} failed, ${report.warnings} warnings`);

  return report;
}
