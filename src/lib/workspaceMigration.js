import client from "@/lib/lemmaClient";
import { EMAIL_TO_WORKSPACE, WORKSPACE_NAMES } from "@/data/seedData";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function inferWorkspace(email, name, title, category) {
  if (!email) {
    if (title && title.toLowerCase().includes("partner")) return "corally";
    if (title && (title.toLowerCase().includes("patient") || title.toLowerCase().includes("doctor") || title.toLowerCase().includes("lab"))) return "foxo";
    if (title && (title.toLowerCase().includes("portfolio") || title.toLowerCase().includes("fund") || title.toLowerCase().includes("due diligence"))) return "binocs";
    if (title && (title.toLowerCase().includes("crm") || title.toLowerCase().includes("webhook") || title.toLowerCase().includes("segment"))) return "zap";
    if (title && (title.toLowerCase().includes("beaut") || title.toLowerCase().includes("booking") || title.toLowerCase().includes("refund"))) return "yesmadam";
    if (category) {
      if (["CRM Sync", "Partner Onboarding", "API", "Contract"].includes(category)) return "corally";
      if (["Appointment", "Prescription", "Patient", "Lab Reports", "Doctor", "Insurance"].includes(category)) return "foxo";
      if (["Financial Report", "Document Review", "Portfolio", "Client", "Risk Assessment", "Login"].includes(category)) return "binocs";
      if (["CRM", "Webhook", "Data Import", "Analytics", "Integrations"].includes(category)) return "zap";
      if (["Booking", "Beautician", "Refund", "Payment", "Wallet", "Cancellation"].includes(category)) return "yesmadam";
    }
    return "signaldesk";
  }
  const lower = email.toLowerCase();
  if (EMAIL_TO_WORKSPACE[lower]) return EMAIL_TO_WORKSPACE[lower];

  const domain = lower.split("@")[1] || "";
  if (domain.includes("gmail") || domain.includes("yahoo") || domain.includes("outlook") || domain.includes("icloud") || domain.includes("hotmail")) return "yesmadam";
  if (domain.includes("acmepartners") || domain.includes("nexusconnect") || domain.includes("databridge") || domain.includes("pinnaclecrm") || domain.includes("synergycloud") || domain.includes("velocitypartners") || domain.includes("omnichannel") || domain.includes("fusionlayer") || domain.includes("atlaspartners") || domain.includes("cortexintegrations")) return "corally";
  if (domain.includes("citygeneral") || domain.includes("wellcareclinics") || domain.includes("mediconnect") || domain.includes("healthfirstmed") || domain.includes("primepathlabs") || domain.includes("apollohs") || domain.includes("redwoodmed") || domain.includes("sunrisecardio") || domain.includes("mercyhealth") || domain.includes("peakdiagnostics")) return "foxo";
  if (domain.includes("silverpointcap") || domain.includes("atlas-equity") || domain.includes("meridian") || domain.includes("pinebrookadvisory") || domain.includes("summitpe") || domain.includes("horizonfo") || domain.includes("crestviewinv") || domain.includes("northstaram") || domain.includes("bayfrontcap") || domain.includes("ridgelinefin")) return "binocs";
  if (domain.includes("retailmax") || domain.includes("datadriven") || domain.includes("customerfirst") || domain.includes("omniretail") || domain.includes("insighthub") || domain.includes("marketpulse") || domain.includes("brandwise") || domain.includes("ecommetrics") || domain.includes("segmentflow") || domain.includes("claritydata")) return "zap";

  return "signaldesk";
}

async function migrateTable(table, idField, inferFn) {
  let migrated = 0;
  let cursor = null;

  while (true) {
    const opts = { limit: 100 };
    if (cursor) opts.cursor = cursor;

    let res;
    try {
      res = await client.records.list(table, opts);
    } catch {
      console.warn(`Cannot list ${table} — skipping`);
      break;
    }

    const items = res.items || res.data || [];
    if (items.length === 0) break;

    for (const record of items) {
      if (record.workspaceId) continue;

      const wsId = await inferFn(record);
      if (wsId && wsId !== "signaldesk") {
        const wsName = WORKSPACE_NAMES[wsId] || wsId;
        try {
          await client.records.update(table, record[idField], {
            workspaceId: wsId,
            workspaceName: wsName,
          });
          migrated++;
        } catch (err) {
          console.warn(`Failed to update ${table} ${record[idField]}:`, err?.message);
        }
        await sleep(50);
      }
    }

    cursor = res.cursor || res.next_cursor;
    if (!cursor) break;
  }

  return migrated;
}

export async function migrateWorkspaces(onProgress) {
  const total = 6;
  let done = 0;

  const report = (msg) => {
    done++;
    if (onProgress) onProgress(done, total, msg);
  };

  const ticketCount = await migrateTable("tickets", "id", (r) => inferWorkspace(r.customer_email, r.customer_name, r.title, r.category));
  report(`Tickets: ${ticketCount} migrated`);

  const signalCount = await migrateTable("signals", "id", (r) => inferWorkspace(null, null, r.name, r.category));
  report(`Signals: ${signalCount} migrated`);

  const incidentCount = await migrateTable("incidents", "id", (r) => inferWorkspace(null, null, r.title, null));
  report(`Incidents: ${incidentCount} migrated`);

  const draftCount = await migrateTable("drafts", "id", async (r) => {
    if (r.ticket_id) {
      try {
        const ticket = await client.records.get("tickets", r.ticket_id);
        if (ticket && ticket.workspaceId) {
          await client.records.update("drafts", r.id, {
            workspaceId: ticket.workspaceId,
            workspaceName: ticket.workspaceName || WORKSPACE_NAMES[ticket.workspaceId],
          });
          return ticket.workspaceId;
        }
      } catch {}
    }
    return null;
  });
  report(`Drafts: ${draftCount} migrated`);

  const auditCount = await migrateTable("audit_logs", "id", async (r) => {
    let wsId = "signaldesk";
    if (r.ticket_id) {
      try {
        const ticket = await client.records.get("tickets", r.ticket_id);
        if (ticket && ticket.workspaceId) wsId = ticket.workspaceId;
      } catch {}
    } else if (r.signal_id) {
      try {
        const signal = await client.records.get("signals", r.signal_id);
        if (signal && signal.workspaceId) wsId = signal.workspaceId;
      } catch {}
    }
    if (wsId && wsId !== "signaldesk") {
      await client.records.update("audit_logs", r.id, {
        workspaceId: wsId,
        workspaceName: WORKSPACE_NAMES[wsId] || wsId,
      });
    }
    return wsId;
  });
  report(`Audit logs: ${auditCount || 0} migrated`);

  const approvalCount = await migrateTable("approvals", "id", async (r) => {
    if (r.ticket_id) {
      try {
        const ticket = await client.records.get("tickets", r.ticket_id);
        if (ticket && ticket.workspaceId) {
          await client.records.update("approvals", r.id, {
            workspaceId: ticket.workspaceId,
            workspaceName: ticket.workspaceName || WORKSPACE_NAMES[ticket.workspaceId],
          });
          return ticket.workspaceId;
        }
      } catch {}
    }
    return null;
  });
  report(`Approvals: ${approvalCount} migrated`);

  report("Workspace migration complete!");
  return { tickets: ticketCount, signals: signalCount, incidents: incidentCount, drafts: draftCount, auditLogs: auditCount || 0, approvals: approvalCount };
}

export async function validateWorkspaces() {
  const results = {};
  const workspaces = ["signaldesk", "corally", "foxo", "binocs", "zap", "yesmadam"];
  const tables = ["tickets", "signals", "incidents", "drafts", "audit_logs", "approvals", "memory_entries"];

  for (const ws of workspaces) {
    const counts = {};
    for (const table of tables) {
      const filters = ws === "signaldesk" ? undefined : [{ field: "workspaceId", op: "eq", value: ws }];
      try {
        const res = await client.records.list(table, { filters, limit: 1000 });
        const items = res.items || res.data || [];
        counts[table] = items.length;
      } catch {
        counts[table] = 0;
      }
    }
    results[ws] = counts;
  }

  return results;
}
