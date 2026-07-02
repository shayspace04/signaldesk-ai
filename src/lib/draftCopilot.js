import client from "@/lib/lemmaClient";

export const TONES = [
  { id: "professional", label: "Professional", description: "Clear, formal business language" },
  { id: "empathetic", label: "Empathetic", description: "Warm, understanding, apologetic" },
  { id: "technical", label: "Technical", description: "Detailed engineering explanation" },
  { id: "executive", label: "Executive", description: "Strategic, high-level overview" },
  { id: "friendly", label: "Friendly", description: "Casual, conversational tone" },
  { id: "customer_success", label: "Customer Success", description: "Proactive, solution-oriented" },
];

const PRIORITY_LABELS = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };

export async function gatherContext(ticket) {
  const steps = [];
  let signal = null, incident = null, knowledge = [], historical = [], engineeringNotes = null;

  steps.push({ icon: "search", label: "Reading ticket..." });

  try {
    const wsFilter = ticket.workspaceId && ticket.workspaceId !== "signaldesk"
      ? [{ field: "workspaceId", op: "eq", value: ticket.workspaceId }]
      : undefined;

    const allSignals = await client.records.list("signals", { limit: 100, filters: wsFilter });
    const signals = allSignals.items || allSignals.records || allSignals.data || [];
    signal = signals.find((s) => {
      const ids = s.example_ticket_ids || s.linked_ticket_ids || s.ticket_ids || [];
      return ids.includes(ticket.id);
    }) || null;
    steps.push({ icon: "check", label: signal ? "Linked signal found" : "No linked signal" });

    if (signal?.incident_id) {
      try {
        incident = await client.records.get("incidents", signal.incident_id);
      } catch { incident = null; }
      steps.push({ icon: "check", label: incident ? "Active incident found" : "No linked incident" });
    } else {
      steps.push({ icon: "check", label: "No linked incident" });
    }

    const allMemory = await client.records.list("memory_entries", { limit: 100, filters: wsFilter });
    const memoryEntries = allMemory.items || allMemory.records || allMemory.data || [];
    const ticketTokens = ((ticket.title || "") + " " + (ticket.body || "")).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    knowledge = memoryEntries.filter((k) => {
      const kText = ((k.title || "") + " " + (k.summary || "") + " " + (k.root_cause || "")).toLowerCase();
      const catMatch = k.category && ticket.category && k.category.toLowerCase() === ticket.category.toLowerCase();
      const tokenMatch = ticketTokens.some((t) => kText.includes(t));
      return catMatch || tokenMatch;
    }).slice(0, 5);
    steps.push({ icon: "check", label: `${knowledge.length} Knowledge Base article${knowledge.length !== 1 ? "s" : ""}` });

    const allTickets = await client.records.list("tickets", { limit: 200, sort: [{ field: "created_at", direction: "desc" }], filters: wsFilter });
    const recentTickets = allTickets.items || allTickets.records || allTickets.data || [];
    const myTokens = new Set(ticketTokens);
    historical = recentTickets.filter((t) => {
      if (t.id === ticket.id) return false;
      const tText = ((t.title || "") + " " + (t.body || "")).toLowerCase();
      const tTokens = tText.split(/\s+/).filter((w) => w.length > 2);
      return tTokens.some((w) => myTokens.has(w));
    }).slice(0, 10);
    steps.push({ icon: "check", label: `${historical.length} historical similar ticket${historical.length !== 1 ? "s" : ""}` });

    if (incident?.linearIssueId) {
      engineeringNotes = {
        acknowledged: true,
        issueId: incident.linearIssueId,
        status: incident.linearStatus || "In Progress",
      };
    }
    steps.push({ icon: "check", label: engineeringNotes ? "Engineering update found" : "No engineering updates" });

  } catch (err) {
    steps.push({ icon: "error", label: "Context gathering error" });
  }

  return { signal, incident, knowledge, historical, engineeringNotes, steps };
}

export function buildFacts(ticket, context) {
  const { signal, incident, knowledge, historical, engineeringNotes } = context;

  const hasIncident = !!incident;
  const hasSignal = !!signal;
  const hasKnowledge = knowledge.length > 0;
  const hasEngineeringAck = !!engineeringNotes;
  const hasHistorical = historical.length > 0;
  const isHighPriority = ticket.priority === "urgent" || ticket.priority === "high";

  let bestKnowledge = null;
  if (knowledge.length > 0) {
    bestKnowledge = knowledge.reduce((best, k) => {
      const score = (k.confidence || 0);
      return score > (best?.confidence || 0) ? k : best;
    }, null);
  }

  return {
    customerName: ticket.customer_name || ticket.customer_email || "Valued Customer",
    customerEmail: ticket.customer_email,
    issueTitle: ticket.title || "",
    issueDescription: ticket.body || ticket.description || "",
    category: ticket.category || "",
    priority: ticket.priority || "normal",
    priorityLabel: PRIORITY_LABELS[ticket.priority] || "Normal",
    workspace: ticket.workspaceName || ticket.workspaceId || "",

    hasSignal,
    signalName: signal?.name || signal?.summary || "",
    signalId: signal?.id || null,
    signalCategory: signal?.category || "",
    signalRootCause: signal?.root_cause || "",
    signalConfidence: signal?.analysis_confidence || null,

    hasIncident,
    incidentTitle: incident?.title || "",
    incidentId: incident?.id || null,
    incidentStatus: incident?.status || "",
    incidentSeverity: incident?.severity || "",
    incidentSummary: incident?.summary || incident?.description || "",

    hasKnowledge,
    bestKnowledgeTitle: bestKnowledge?.title || "",
    bestKnowledgeSummary: bestKnowledge?.summary || "",
    bestKnowledgeResolution: bestKnowledge?.resolution || bestKnowledge?.body || "",
    bestKnowledgeRootCause: bestKnowledge?.root_cause || "",
    bestKnowledgeConfidence: bestKnowledge?.confidence || null,
    knowledgeCount: knowledge.length,

    hasEngineeringAck,
    engineeringStatus: engineeringNotes?.status || "",
    engineeringIssueId: engineeringNotes?.issueId || null,

    hasHistorical,
    historicalCount: historical.length,

    isHighPriority,
  };
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function openingLine(facts, tone) {
  const name = facts.customerName;
  const greetings = {
    professional: `Dear ${name},`,
    empathetic: `Dear ${name},`,
    technical: `Hi ${name},`,
    executive: `Dear ${name},`,
    friendly: `Hi ${name},`,
    customer_success: `Hello ${name},`,
  };
  return greetings[tone] || greetings.professional;
}

function closingLine(facts, tone) {
  const signoffs = {
    professional: `Best regards,\n${capitalize(facts.workspace) || "Support"} Team`,
    empathetic: `Warm regards,\n${capitalize(facts.workspace) || "Support"} Team`,
    technical: `Best regards,\n${capitalize(facts.workspace) || "Support"} Engineering`,
    executive: `Sincerely,\n${capitalize(facts.workspace) || "Support"} Management`,
    friendly: `Cheers,\nThe ${capitalize(facts.workspace) || "Support"} Team`,
    customer_success: `Best regards,\n${capitalize(facts.workspace) || "Support"} Team`,
  };
  return signoffs[tone] || signoffs.professional;
}

function acknowledgementSection(facts, tone) {
  const title = facts.issueTitle;
  const cat = facts.category;
  const priorityContext = facts.isHighPriority ? " I understand this is a high-priority matter." : "";

  const templates = {
    professional: `Thank you for reaching out regarding "${title}". I have reviewed your request and I am happy to assist you with this matter.${priorityContext}`,
    empathetic: `Thank you for contacting us about "${title}". I completely understand how important this is to you, and I want to assure you that we are taking it seriously.${priorityContext}`,
    technical: `I have reviewed your report concerning "${title}". Based on the information provided, I have initiated an analysis of the issue.${priorityContext}`,
    executive: `Thank you for bringing "${title}" to our attention. I have reviewed the details and want to provide you with a comprehensive update on the situation.${priorityContext}`,
    friendly: `Thanks for reaching out about "${title}"! I've looked into this and I'm here to help get things sorted for you.${priorityContext}`,
    customer_success: `Thanks for letting us know about "${title}". I've taken a close look at what's going on and I'm committed to getting this resolved for you.${priorityContext}`,
  };
  return templates[tone] || templates.professional;
}

function incidentSection(facts, tone) {
  if (!facts.hasIncident) return null;

  const incRef = facts.incidentId ? ` (${facts.incidentId.substring(0, 8).toUpperCase()})` : "";

  const templates = {
    professional: `This issue is related to an active incident${incRef} that our engineering team is already addressing. The incident involves ${facts.incidentSummary || facts.incidentTitle || "the reported problem"}.`,
    empathetic: `The good news is that we've already identified this as a known issue and it is being actively investigated as Incident ${incRef}. Please know that our team is fully focused on resolving this.`,
    technical: `This matches an open incident${incRef} in our tracking system. ${facts.incidentSummary ? `Current findings indicate: ${facts.incidentSummary}` : "Our engineering team is actively debugging the root cause."}`,
    executive: `I can confirm that this is a known issue and we have opened Incident ${incRef} to track it. ${facts.incidentSummary || "Our teams are working on it at the highest priority."}`,
    friendly: `Great news — we've actually already spotted this one! It's being tracked as Incident ${incRef} and our team is on it.`,
    customer_success: `I've confirmed that this is a known issue and it is being actively managed under Incident ${incRef}. Rest assured, we have a team working on a resolution.`,
  };
  return templates[tone] || templates.professional;
}

function knowledgeSection(facts, tone) {
  if (!facts.hasKnowledge) return null;

  const kbRef = facts.bestKnowledgeTitle ? ` "${facts.bestKnowledgeTitle}"` : "";

  const templates = {
    professional: `Our knowledge base contains a relevant article${kbRef} that may be helpful. ${facts.bestKnowledgeResolution ? facts.bestKnowledgeResolution.substring(0, 200) : facts.bestKnowledgeSummary || ""}`,
    empathetic: `We do have some information that might help in the meantime. Our knowledge base includes${kbRef} which addresses similar situations.`,
    technical: `This matches a documented pattern in our knowledge base${kbRef}. ${facts.bestKnowledgeRootCause ? `The known root cause is: ${facts.bestKnowledgeRootCause}` : ""}`,
    executive: `Our knowledge base contains relevant documentation${kbRef} that provides context on this type of issue.`,
    friendly: `I found something useful in our knowledge base${kbRef} that relates to what you're experiencing.`,
    customer_success: `We have a knowledge article${kbRef} that directly relates to this issue. I'd recommend reviewing it for additional context.`,
  };
  return templates[tone] || templates.professional;
}

function engineeringSection(facts, tone) {
  if (!facts.hasEngineeringAck) return null;

  const templates = {
    professional: `Our engineering team has acknowledged this issue and it is currently ${facts.engineeringStatus || "under investigation"}.`,
    empathetic: `I want you to know that our engineering team has been alerted and is actively ${facts.engineeringStatus || "working on a fix"}. You are a priority for us.`,
    technical: `Engineering has acknowledged the issue (${facts.engineeringIssueId ? `tracking ID: ${facts.engineeringIssueId}` : ""}) and is currently ${facts.engineeringStatus || "investigating"}.`,
    executive: `Engineering has confirmed they are working on this. The current status is: ${facts.engineeringStatus || "In Progress"}. We will provide updates as they become available.`,
    friendly: `Our engineering team is already on the case! They're currently ${facts.engineeringStatus || "investigating"} and working on a fix.`,
    customer_success: `I've confirmed with our engineering team that this is being actively worked on. Current status: ${facts.engineeringStatus || "In Progress"}. We will keep you posted.`,
  };
  return templates[tone] || templates.professional;
}

function expectationsSection(facts, tone) {
  if (facts.hasIncident && facts.hasEngineeringAck) {
    const templates = {
      professional: `We do not have an estimated resolution time at this point, but we will notify you as soon as the fix has been deployed. No additional action is required from your end at this time.`,
      empathetic: `While I don't have a specific timeline to share just yet, please know that we will notify you the moment the fix is in place. There is nothing you need to do on your end right now.`,
      technical: `We will provide an update once engineering has completed the root cause analysis. Affected systems will be monitored continuously. No action needed from you.`,
      executive: `We will keep you informed of progress. Our team is committed to resolving this as quickly as possible and we will provide a timeline once we have more clarity.`,
      friendly: `We'll let you know as soon as things are back to normal. Hang tight — our team is on it!`,
      customer_success: `You don't need to take any action at this time. We will reach out with a full update once the fix has been deployed.`,
    };
    return templates[tone] || templates.professional;
  }

  if (facts.hasIncident) {
    const templates = {
      professional: `Our team is actively investigating this as a known issue. We will follow up with you once we have more information.`,
      empathetic: `We are doing everything we can to resolve this quickly. I will personally follow up with you as soon as we have an update.`,
      technical: `The investigation is ongoing. We will update this ticket once the root cause has been identified and a fix is in progress.`,
      executive: `We are prioritizing this issue and will provide a detailed update shortly.`,
      friendly: `We're looking into it and will get back to you ASAP!`,
      customer_success: `We're on it. Expect an update from us soon.`,
    };
    return templates[tone] || templates.professional;
  }

  const templates = {
    professional: `Our team is reviewing your request and will provide a detailed response as soon as possible. If you have any additional information that might help us assist you, please feel free to share it.`,
    empathetic: `We appreciate your patience while we look into this. If there is anything else you can share about what you're experiencing, it will help us get to the bottom of it faster.`,
    technical: `We are gathering additional diagnostics and will follow up with our findings. In the meantime, if you can provide any reproduction steps or error logs, that would be helpful.`,
    executive: `We are analyzing the situation and will provide a comprehensive update shortly. We appreciate your patience.`,
    friendly: `We're on the case and will get back to you soon! If you think of anything else that might help, just reply here.`,
    customer_success: `I'm personally ensuring this gets the attention it deserves. You'll hear from us soon with concrete next steps.`,
  };
  return templates[tone] || templates.professional;
}

function buildSections(facts, tone) {
  const sections = [];

  sections.push({ type: "opening", text: openingLine(facts, tone) });
  sections.push({ type: "acknowledgement", text: acknowledgementSection(facts, tone) });

  const incSection = incidentSection(facts, tone);
  if (incSection) sections.push({ type: "incident", text: incSection });

  const engSection = engineeringSection(facts, tone);
  if (engSection) sections.push({ type: "engineering", text: engSection });

  const kbSection = knowledgeSection(facts, tone);
  if (kbSection) sections.push({ type: "knowledge", text: kbSection });

  sections.push({ type: "expectations", text: expectationsSection(facts, tone) });

  sections.push({ type: "closing", text: closingLine(facts, tone) });

  return sections;
}

export function buildDraft(ticket, facts, tone = "professional") {
  const sections = buildSections(facts, tone);
  const body = sections.map((s) => s.text).filter(Boolean).join("\n\n");
  const confidence = calculateConfidence(facts);

  return { body, sections, confidence, facts };
}

export function calculateConfidence(facts) {
  let scores = {};

  scores.knowledge = facts.hasKnowledge ? Math.min(70 + facts.knowledgeCount * 5 + (facts.bestKnowledgeConfidence || 0) * 0.2, 98) : 0;
  scores.incident = facts.hasIncident ? Math.min(65 + (facts.incidentSeverity === "critical" ? 20 : facts.incidentSeverity === "high" ? 15 : 10), 95) : 0;
  scores.historical = facts.hasHistorical ? Math.min(50 + facts.historicalCount * 3, 85) : 0;
  scores.engineering = facts.hasEngineeringAck ? 85 : 0;

  const activeScores = Object.values(scores).filter((s) => s > 0);
  const overall = activeScores.length > 0
    ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
    : Math.round(30 + (facts.isHighPriority ? 15 : 0));

  const reasons = [];
  if (facts.hasKnowledge) reasons.push(`${facts.knowledgeCount} knowledge article${facts.knowledgeCount > 1 ? "s" : ""} matched`);
  if (facts.hasIncident) reasons.push(`Active incident ${facts.incidentId?.substring(0, 8).toUpperCase() || ""}`);
  if (facts.hasHistorical) reasons.push(`${facts.historicalCount} historical tickets`);
  if (facts.hasEngineeringAck) reasons.push("Engineering acknowledged");
  if (!facts.hasKnowledge && !facts.hasIncident) reasons.push("No prior related issues found — draft based on ticket details");

  return {
    overall,
    knowledge: scores.knowledge,
    incident: scores.incident,
    historical: scores.historical,
    engineering: scores.engineering,
    reasoning: reasons.length > 0 ? reasons : ["Limited context available"],
  };
}

export function adaptTone(existingDraft, facts, newTone) {
  return buildDraft(facts, newTone);
}
