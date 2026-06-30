import client from "@/lib/lemmaClient";
import { WORKSPACE_SEEDS } from "@/data/seedData";

const SEED_MARKER = "__seed_v1__";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createTicket(scenario, created_at) {
  try {
    const result = await client.functions.run("create_ticket", {
      input: {
        title: scenario.title,
        customer_name: scenario.customer_name,
        customer_email: scenario.customer_email,
        body: scenario.body,
        channel: scenario.channel || "email",
      },
    });
    const ticketId = result.output_data?.ticket_id || result.ticket_id || result.id;
    if (!ticketId) return null;

    const updates = {};
    if (scenario.priority) updates.priority = scenario.priority;
    if (scenario.category) updates.category = scenario.category;
    if (scenario.status) updates.status = scenario.status;
    if (created_at) updates.created_at = created_at;
    updates.tags = [SEED_MARKER, scenario.category?.toLowerCase().replace(/\s+/g, "_") || "general"];

    await client.records.update("tickets", ticketId, updates);
    return ticketId;
  } catch (err) {
    console.warn("Failed to create ticket:", scenario.title, err?.message);
    return null;
  }
}

async function createSignal(signalDef) {
  try {
    const result = await client.functions.run("create_signal", {
      input: {
        title: signalDef.name,
        summary: signalDef.summary,
        category: signalDef.category,
      },
    });
    const signalId = result.output_data?.signal_id || result.signal_id || result.id;
    if (signalId) {
      await client.records.update("signals", signalId, { tags: [SEED_MARKER] });
    }
    return signalId;
  } catch (err) {
    console.warn("Failed to create signal:", signalDef.name, err?.message);
    return null;
  }
}

async function createDraft(ticketId, body, confidence) {
  try {
    const draftId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.records.create("drafts", {
      id: draftId,
      ticket_id: ticketId,
      body,
      confidence: confidence || Math.floor(Math.random() * 15) + 80,
      status: "pending",
      tags: [SEED_MARKER],
    });
    return draftId;
  } catch (err) {
    console.warn("Failed to create draft:", err?.message);
    return null;
  }
}

async function createAuditLog(entry) {
  try {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.records.create("audit_logs", {
      id,
      action: entry.action,
      actor_agent_name: entry.actor,
      resource_type: entry.resource_type || "ticket",
      details: entry.details || {},
      created_at: entry.created_at,
      tags: [SEED_MARKER],
    });
  } catch {
    /* silent */
  }
}

export async function seedWorkspace(workspaceId, onProgress) {
  const seed = WORKSPACE_SEEDS[workspaceId];
  if (!seed) throw new Error(`No seed data for workspace: ${workspaceId}`);

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
    const daysAgo = Math.floor(Math.random() * 28) + 1;
    const created = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 3600000)).toISOString();
    const id = await createTicket(scenario, created);
    if (id) ticketIds.push(id);
    report(`Ticket: ${scenario.title.slice(0, 50)}`);
    if (i % 5 === 4) await sleep(200);
  }

  /* --- detect & link signals --- */
  report("Running signal detection...");
  for (const id of ticketIds) {
    try {
      await client.functions.run("detect_and_link_signal", { input: { ticket_id: id } });
    } catch {
      /* signal detection may not find matches */
    }
    await sleep(100);
  }

  /* --- signals --- */
  report("Creating signals...");
  for (const sig of seed.signals) {
    await createSignal(sig);
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
    });
    report(`Audit log entry ${i + 1}`);
  }

  /* --- drafts --- */
  report("Generating AI draft replies...");
  const draftTicketIds = ticketIds.filter((_, i) => i < seed.drafts.length);
  for (let i = 0; i < draftTicketIds.length; i++) {
    const tid = draftTicketIds[i];
    const body = seed.drafts[i % seed.drafts.length];
    if (tid && body) {
      try {
        await client.functions.run("generate_draft_reply", { input: { ticket_id: tid } });
      } catch {
        await createDraft(tid, body, Math.floor(Math.random() * 15) + 80);
      }
    }
    report(`Draft ${i + 1}/${draftTicketIds.length}`);
    await sleep(200);
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

export async function checkSeedExists(workspaceId) {
  try {
    const res = await client.records.list("tickets", { limit: 5, filter: { tags: { $contains: SEED_MARKER } } });
    return (res.items || res.data || []).length > 0;
  } catch {
    return false;
  }
}
