import client from "@/lib/lemmaClient";

export async function runGmailAlert(incident) {
  const sev = incident.severity || "";
  if (sev !== "high" && sev !== "urgent") return { status: "skipped", reason: `severity ${sev} does not require alert` };
  if (incident.email_sent) return { status: "skipped", reason: "email already sent" };

  const workspaceId = incident.workspaceId || "signaldesk";
  const workspaceName = incident.workspaceName || "SignalDesk";

  console.log(`[gmail] connector invoked for incident ${incident.id} (severity=${sev})`);

  try {
    const raw = await client.functions.run("escalate_incident", {
      input: {
        incident_id: incident.id,
        new_severity: sev,
        workspace_name: workspaceName,
        dashboard_link: `${window.location.origin}/incidents`,
      },
    });
    const result = raw.output_data || raw.output || raw;

    console.log(`[gmail] connector result for ${incident.id}:`, JSON.stringify(result).slice(0, 200));

    await client.records.update("incidents", incident.id, { email_sent: true });

    const details = {
      name: incident.title,
      severity: sev,
      note: "Gmail alert sent via incident workflow",
      recipient: result.recipient || result.to || result.email || "unknown",
      subject: result.subject || `[${sev.toUpperCase()}] ${incident.title || "Incident Alert"}`,
    };
    await client.records.create("audit_logs", {
      id: crypto.randomUUID(),
      action: "email.alert_sent",
      actor_type: "system",
      resource_type: "incident",
      resource_id: incident.id,
      details,
      workspaceId,
      workspaceName,
    }).catch(() => {});

    return { status: "sent", result, details };
  } catch (err) {
    console.error(`[gmail] connector FAILED for ${incident.id}:`, err?.message || err);
    return { status: "error", error: err?.message || String(err) };
  }
}

export function syncToLinear(incidentId) {
  return (async () => {
    console.log(`[linear] connector invoked for incident ${incidentId}`);
    try {
      const raw = await client.functions.run("create_linear_issue", {
        input: { incident_id: incidentId },
      });
      const result = raw.output_data || raw.output || raw;

      const success = result.success || result.linearIssueId || result.linearIssueIdentifier;
      if (success) {
        const issueId = result.linearIssueId || result.issueId;
        const issueUrl = result.linearIssueUrl || result.issueUrl;
        const identifier = result.linearIssueIdentifier || result.identifier;

        console.log(`[linear] connector success for ${incidentId}: ${identifier} (${issueUrl})`);

        const updates = {
          linearIssueId: issueId,
          linearIssueUrl: issueUrl || "",
          linearIssueIdentifier: identifier || "",
          linearKey: identifier || "",
          linearUrl: issueUrl || "",
          linearSyncedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          linearStatus: "Todo",
          syncStatus: "Todo",
        };
        await client.records.update("incidents", incidentId, updates).catch(() => {});

        return { status: "synced", issueId, issueUrl, identifier };
      }

      const msg = result.message || "";
      const isConnectorError = /connector/i.test(msg) || /not configured/i.test(msg);
      console.warn(`[linear] connector failed for ${incidentId}: ${msg || "unknown error"}`);
      return { status: isConnectorError ? "connector_unavailable" : "error", error: msg || "Failed to create Linear issue" };
    } catch (err) {
      console.error(`[linear] connector ERROR for ${incidentId}:`, err?.message || err);
      return { status: "error", error: err?.message || "Unable to create Linear issue" };
    }
  })();
}

export async function runFullWorkflow(incident) {
  const gmailResult = await runGmailAlert(incident);
  const linearPromise = syncToLinear(incident.id);
  const linearResult = await linearPromise;
  return { gmail: gmailResult, linear: linearResult };
}

export async function escalateIncident(incident, newSeverity) {
  if (!incident || newSeverity === incident.severity) return { status: "skipped", reason: "already at this severity" };

  const raw = await client.functions.run("escalate_incident", {
    input: {
      incident_id: incident.id,
      new_severity: newSeverity,
      workspace_name: incident.workspaceName || incident.workspaceId || "",
      dashboard_link: `${window.location.origin}/incidents`,
    },
  });
  const result = raw.output_data || raw.output || raw;

  const updates = { severity: newSeverity };
  const emailConfirmed = result.email_sent || result.gmail_message_id;

  if (newSeverity === "urgent" || emailConfirmed) {
    updates.email_sent = true;
  }

  await client.records.update("incidents", incident.id, updates);

  if (newSeverity === "urgent") {
    await client.records.create("audit_logs", {
      id: crypto.randomUUID(),
      action: "email.alert_sent",
      actor_type: "system",
      resource_type: "incident",
      resource_id: incident.id,
      details: { name: incident.title, severity: newSeverity, note: "Triggered by severity escalation to urgent" },
      workspaceId: incident.workspaceId || "",
      workspaceName: incident.workspaceName || "",
    }).catch(() => {});
  }

  const linearPromise = syncToLinear(incident.id);

  return { status: "escalated", emailConfirmed, updates, linear: linearPromise };
}
