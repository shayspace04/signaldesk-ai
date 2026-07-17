import client, { ORG_ID, GMAIL_AUTH_CONFIG, ALERT_RECIPIENT } from "@/lib/lemmaClient";

export async function runGmailAlert(incident) {
  const sev = incident.severity || "";
  if (sev !== "high" && sev !== "urgent") return { status: "skipped", reason: `severity ${sev} does not require alert` };
  if (incident.email_sent) return { status: "skipped", reason: "email already sent" };

  const workspaceId = incident.workspaceId || "signaldesk";
  const workspaceName = incident.workspaceName || "SignalDesk";

  console.log(`[gmail] connector invoked for incident ${incident.id} (severity=${sev})`);

  try {
    const body = [
      `🚨 ${sev.toUpperCase()} INCIDENT ALERT`,
      ``,
      `Incident: ${incident.title || "Untitled"}`,
      `Severity: ${sev}`,
      `Workspace: ${workspaceName} (${workspaceId})`,
      `Dashboard: ${window.location.origin}/incidents`,
      incident.description ? `\nDescription: ${incident.description}` : "",
    ].filter(Boolean).join("\n");

    const raw = await client.connectors.operations.execute(
      { organizationId: ORG_ID, authConfigName: GMAIL_AUTH_CONFIG },
      "GMAIL_SEND_EMAIL",
      { recipient_email: ALERT_RECIPIENT, subject: `[${sev.toUpperCase()}] ${incident.title || "Incident Alert"}`, body },
    );

    const opResult = raw?.result || {};
    const sent = opResult.successful !== false;

    console.log(`[gmail] connector result for ${incident.id}:`, JSON.stringify(opResult).slice(0, 200));

    if (sent) {
      await client.records.update("incidents", incident.id, { email_sent: true }).catch(e => console.error(`[gmail] persist failed for ${incident.id}:`, e?.message || e));
    }

    await client.records.create("audit_logs", {
      id: crypto.randomUUID(),
      action: "email.alert_sent",
      actor_type: "system",
      resource_type: "incident",
      resource_id: incident.id,
      details: {
        name: incident.title, severity: sev,
        note: sent ? "Gmail alert sent via connector" : "Gmail connector op returned unsuccessful",
        recipient: ALERT_RECIPIENT,
        subject: `[${sev.toUpperCase()}] ${incident.title || "Incident Alert"}`,
      },
      workspaceId,
      workspaceName,
    }).catch(() => {});

    return { status: sent ? "sent" : "error", details: { recipient: ALERT_RECIPIENT } };
  } catch (err) {
    console.error(`[gmail] connector FAILED for ${incident.id}:`, err?.message || err);
    return { status: "error", error: err?.message || String(err) };
  }
}

const LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628";

async function tryCreateLinearViaConnector(incidentId, incident) {
  const priorityMap = { urgent: 1, high: 2, normal: 3, low: 4 };
  const priority = priorityMap[incident.severity] || 0;
  const raw = await client.connectors.operations.execute(
    { organizationId: "019ef98f-e90b-74df-9116-d0df1a4baeff", authConfigName: "linear" },
    "LINEAR_CREATE_LINEAR_ISSUE",
    {
      team_id: LINEAR_TEAM_ID,
      title: incident.title || `Incident ${incidentId}`,
      description: incident.description || incident.summary || `Incident ${incidentId}`,
      priority,
    },
  );
  const opResult = raw?.result || {};
  const issueId = opResult.id;
  if (!issueId) throw new Error(opResult.error || 'Connector returned no issue ID');
  return {
    issueId,
    issueUrl: opResult.ticket_url || opResult.url || '',
    identifier: opResult.identifier || '',
  };
}

export async function syncToLinear(incidentId) {
  console.log(`[linear] sync invoked for incident ${incidentId}`);
  try {
    const incident = await client.records.get("incidents", incidentId).catch(() => null);
    if (!incident) return { status: "error", error: "Incident not found" };

    if (incident.linearIssueId) {
      console.log(`[linear] already synced for ${incidentId}: ${incident.linearIssueIdentifier}`);
      return {
        status: "synced",
        issueId: incident.linearIssueId,
        issueUrl: incident.linearIssueUrl || "",
        identifier: incident.linearIssueIdentifier || "",
      };
    }

    let result;
    try {
      const raw = await client.functions.run("create_linear_issue", {
        input: { incident_id: incidentId },
      });
      const output = raw?.output_data || raw?.output || raw || {};
      if (output.success && output.linearIssueId) {
        result = {
          issueId: output.linearIssueId,
          issueUrl: output.linearIssueUrl || "",
          identifier: output.linearIssueIdentifier || "",
        };
      } else {
        const errMsg = output.message || output.error || "";
        if (errMsg.toLowerCase().includes("already exists")) {
          const refetched = await client.records.get("incidents", incidentId).catch(() => null);
          if (refetched?.linearIssueId) {
            return { status: "synced", issueId: refetched.linearIssueId, issueUrl: refetched.linearIssueUrl || "", identifier: refetched.linearIssueIdentifier || "" };
          }
        }
        throw new Error(errMsg || "Server function returned unsuccessful");
      }
    } catch (serverErr) {
      console.log(`[linear] server function failed, trying connector fallback:`, serverErr?.message);
      result = await tryCreateLinearViaConnector(incidentId, incident);
    }

    console.log(`[linear] success for ${incidentId}: ${result.identifier} (${result.issueUrl})`);

    const updates = {
      linearIssueId: result.issueId,
      linearIssueUrl: result.issueUrl,
      linearIssueIdentifier: result.identifier,
      linearSyncedAt: new Date().toISOString(),
      linearStatus: "Todo",
    };
    await client.records.update("incidents", incidentId, updates).catch(e => console.error(`[linear] persist failed for ${incidentId}:`, e?.message || e));

    return { status: "synced", ...result };
  } catch (err) {
    console.error(`[linear] ERROR for ${incidentId}:`, err?.message || err);
    return { status: "error", error: err?.message || "Unable to create Linear issue" };
  }
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
  const emailSentByServer = result.email_sent || result.gmail_message_id;

  if (emailSentByServer) {
    updates.email_sent = true;
  }

  await client.records.update("incidents", incident.id, updates);

  let gmailResult;
  if (newSeverity === "urgent" || newSeverity === "high") {
    gmailResult = await runGmailAlert({ ...incident, severity: newSeverity, email_sent: !!updates.email_sent });
  }

  if (newSeverity === "urgent") {
    await client.records.create("audit_logs", {
      id: crypto.randomUUID(),
      action: "email.alert_sent",
      actor_type: "system",
      resource_type: "incident",
      resource_id: incident.id,
      details: { name: incident.title, severity: newSeverity, note: "Triggered by severity escalation" },
      workspaceId: incident.workspaceId || "",
      workspaceName: incident.workspaceName || "",
    }).catch(() => {});
  }

  const linearPromise = syncToLinear(incident.id);

  return { status: "escalated", emailConfirmed: !!(updates.email_sent || gmailResult?.status === "sent"), updates, linear: linearPromise };
}
