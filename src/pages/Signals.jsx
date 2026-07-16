import { motion } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, Calendar, Paperclip, MessageSquare, List, Columns3, ExternalLink, Copy, Check, X, Code, FileText, ShieldAlert, Loader2, BookOpen, Lightbulb, CheckCircle2 } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useLinearSync, SYNC_STATUS } from "@/hooks/useLinearSync";
import { useRefreshListener, emitRefresh } from "@/lib/refreshEvents";
import { toast } from "sonner";
import client from "@/lib/lemmaClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import useRole from "@/hooks/useRole";
import { createNotification } from "@/lib/notifications";
import { runGmailAlert, syncToLinear } from "@/lib/incidentWorkflow";
import { deriveWorkflowStage } from "@/lib/workflowStage";
import KnowledgeDrawer from "@/components/knowledge/KnowledgeDrawer";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";

const TAG_STYLES = {
  billing: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400", refund: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", urgent: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  technical: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", account: "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400", security: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  streaming: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400", content: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", feature: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
  data: "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400", reporting: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400", delivery: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  merchant: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400", product: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-400", order: "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-400",
  consultation: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const PRIORITY_STYLES = {
  urgent: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400", high: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  normal: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", low: "bg-zinc-100 text-zinc-500 dark:bg-[#202024] dark:text-muted-dark",
};

const COLUMNS = [
  { id: "new", label: "New", workflowStage: "new", color: "bg-zinc-900" },
  { id: "review", label: "In Review", workflowStage: "review", color: "bg-amber-500" },
  { id: "approved", label: "Approved", workflowStage: "approved", color: "bg-emerald-500" },
  { id: "incident_created", label: "Incident Created", workflowStage: "incident_created", color: "bg-red-500" },
];

function getTagStyle(category) {
  return TAG_STYLES[(category || "").toLowerCase()] || "bg-zinc-100 text-zinc-600 dark:bg-[#202024] dark:text-muted-dark";
}

function getPriorityStyle(priority) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal;
}

function KanbanCard({ signal, index: cardIndex, isManager, onOpenHandoff, onDragStart, knownKnowledge, onViewKnowledge }) {
  const progress = useMemo(() => {
    const stage = deriveWorkflowStage(signal);
    if (stage === "incident_created") return 90;
    if (stage === "approved") return 80;
    if (stage === "review") return 50;
    return Math.min(25 + ((signal.analysis_confidence ?? signal.confidence ?? 0) * 0.3), 45);
  }, [signal]);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      draggable
      onDragStart={(e) => onDragStart?.(e, signal)}
      onClick={() => onOpenHandoff?.(signal)}
      className="group rounded-xl border border-border dark:border-border-dark bg-card p-4 transition-all duration-200 hover:border-zinc-300 hover:shadow-card cursor-pointer">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {signal.category && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${getTagStyle(signal.category)}`}>{signal.category}</span>
          )}
          {(signal.proposed_priority || signal.severity) && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${getPriorityStyle(signal.proposed_priority || signal.severity)}`}>
              {(signal.proposed_priority || signal.severity).charAt(0).toUpperCase() + (signal.proposed_priority || signal.severity).slice(1)}
            </span>
          )}
        </div>
        <button className="flex-shrink-0 rounded p-1 text-muted dark:text-muted-dark opacity-0 transition-all hover:bg-zinc-100 dark:hover:bg-[#202024] hover:text-secondary-body group-hover:opacity-100"><MoreHorizontal size={14} /></button>
      </div>
      <h3 className="mb-2.5 text-sm font-semibold leading-snug text-primary line-clamp-2">{signal.name || signal.summary || signal.id}</h3>
      {signal.detected_at && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted dark:text-muted-dark">
          <Calendar size={12} />{new Date(signal.detected_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted dark:text-muted-dark">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-[#202024]">
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }} />
        </div>
      </div>
      {knownKnowledge ? (
        <button onClick={(e) => { e.stopPropagation(); onViewKnowledge?.(knownKnowledge); }}
          className="mb-2 flex w-full items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 transition hover:bg-amber-100 dark:hover:bg-amber-950/40">
          <BookOpen size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300 truncate">Existing Knowledge</p>
            <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 truncate">{knownKnowledge.title}</p>
          </div>
          {knownKnowledge.confidence != null && (
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">{knownKnowledge.confidence}%</span>
          )}
        </button>
      ) : (
        <p className="mb-2 flex items-center gap-1.5 text-[10px] text-muted dark:text-muted-dark px-1">
          <Lightbulb size={11} /> No Knowledge Yet
        </p>
      )}
      {isManager && deriveWorkflowStage(signal) === "approved" && (
        <button onClick={(e) => { e.stopPropagation(); onOpenHandoff?.(signal); }}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 text-xs font-medium text-secondary-body transition hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#202024]">
          <ShieldAlert size={13} /> Engineering Handoff
        </button>
      )}

    </motion.div>
  );
}

function EngineeringHandoffModal({ signal, onClose }) {
  const { workspace } = useWorkspace();
  const { canCreateIncidentFromSignal } = useRole();
  const [copied, setCopied] = useState(null);
  const [creating, setCreating] = useState(false);
  const [linkedTickets, setLinkedTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [successState, setSuccessState] = useState(null);
  const { syncStatus, syncLoading, syncResult, syncError, syncLinearIssue, resetSync } = useLinearSync();

  const [persistedLinear, setPersistedLinear] = useState(null);

  useEffect(() => {
    if (!successState?.incidentId) return;
    setPersistedLinear(null);
    client.records.get("incidents", successState.incidentId).then((inc) => {
      if (inc?.linearIssueId) {
        setPersistedLinear({
          issueId: inc.linearIssueId,
          issueUrl: inc.linearIssueUrl || "",
          identifier: inc.linearIssueIdentifier || "",
          syncedAt: inc.linearSyncedAt || "",
        });
      }
    }).catch(() => {});
  }, [successState?.incidentId]);

  const handleSyncToLinear = useCallback(async () => {
    if (!successState?.incidentId) return;
    resetSync();
    const result = await syncLinearIssue(successState.incidentId);
    if (result.status === SYNC_STATUS.SYNCED) {
      emitRefresh();
    }
  }, [successState, syncLinearIssue, resetSync]);

  useEffect(() => {
    const ticketIds = signal.example_ticket_ids || signal.ticket_ids || [];
    if (ticketIds.length === 0) {
      setLoadingTickets(false);
      return;
    }
    Promise.all(ticketIds.map((id) =>
      client.records.get("tickets", id).catch(() => null)
    )).then((tickets) => {
      setLinkedTickets(tickets.filter(Boolean));
      setLoadingTickets(false);
    });
  }, [signal]);

  const handoffData = useMemo(() => {
    const tickets = linkedTickets;
    const customerNames = [...new Set(tickets.map((t) => t.customer_name).filter(Boolean))];
    const customerEmails = [...new Set(tickets.map((t) => t.customer_email).filter(Boolean))];
    const categories = [...new Set(tickets.map((t) => t.category).filter(Boolean))];
    const priorities = tickets.map((t) => t.priority).filter(Boolean);
    const maxPriority = priorities.includes("urgent") ? "urgent" : priorities.includes("high") ? "high" : "normal";
    const bodies = tickets.map((t) => t.body || "").filter(Boolean);
    const allText = [...bodies, signal.summary || "", signal.root_cause || ""].join(" ");
    const terms = allText.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const freq = {};
    terms.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const keyTerms = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    const timestamps = tickets.map((t) => new Date(t.created_at || t.createdAt || 0).getTime()).filter((t) => !isNaN(t));
    const firstSeen = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
    const lastSeen = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
    const duration = firstSeen && lastSeen ? Math.round((new Date(lastSeen) - new Date(firstSeen)) / 3600000 * 10) / 10 : 0;

    return {
      title: signal.name || signal.summary || "Signal",
      summary: signal.summary || tickets.map((t) => t.title || "").filter(Boolean).join("; ").slice(0, 500) || "",
      rootCause: signal.root_cause || (tickets.length > 0 ? `Systemic issue identified across ${tickets.length} ticket(s) in ${categories[0] || "multiple"} categories. Common keywords: ${keyTerms.slice(0, 4).join(", ")}.` : ""),
      confidence: signal.analysis_confidence ?? signal.confidence ?? signal.confidence_score ?? 0,
      priority: signal.proposed_priority || maxPriority || "normal",
      severity: signal.proposed_priority || maxPriority || "normal",
      affectedTicketCount: tickets.length || signal.ticket_count || signal.evidence_count || 0,
      affectedCustomerCount: Math.max(customerNames.length, customerEmails.length) || signal.affected_customer_count || 0,
      customerNames,
      customerEmails,
      ticketIds: tickets.map((t) => t.id),
      ticketTitles: tickets.map((t) => t.title || t.customer_name || t.id),
      categories: categories.length > 0 ? categories.join(", ") : signal.category || (tickets.length > 0 ? "General" : "N/A"),
      businessImpact: (() => {
        const catSet = new Set(categories);
        const highValue = catSet.has("billing") || catSet.has("payment") || catSet.has("financial") || catSet.has("portfolio");
        const customerScale = customerNames.length > 3 ? "multiple customers" : customerNames.length > 1 ? "several customers" : "customer";
        const financial = bodies.some((b) => /amount|balance|value|price|charge|cost|revenue|dollar|rupee|inflated|incorrect/i.test(b));
        if (highValue && financial) return `Direct financial impact affecting ${customerNames.length} ${customerScale}. Potential revenue loss due to ${keyTerms.slice(0, 3).join(", ")}. Requires urgent remediation to prevent further ${financial ? "monetary" : "operational"} damage.`;
        if (customerNames.length > 2) return `Service degradation affecting ${customerNames.length} ${customerScale}. Issue severity indicates escalation to engineering for root cause analysis and resolution.`;
        return `Operational impact affecting ${customerNames.length} ${customerScale}. Technical investigation recommended to determine full blast radius.`;
      })(),
      technicalImpact: (() => {
        const hasOcr = bodies.some((b) => /ocr|pars|extract|document|upload/i.test(b));
        const hasData = bodies.some((b) => /data|import|sync|batch|process|pipeline|integrat/i.test(b));
        const hasCalc = bodies.some((b) => /calculat|comput|formula|valuat|report|aggregat/i.test(b));
        if (hasOcr) return `OCR processing pipeline affected — document parsing errors propagating incorrect values to downstream systems. Data integrity compromised across ${tickets.length} records.`;
        if (hasData) return `Data processing pipeline error — imported or synchronized data contains systematic errors affecting ${tickets.length} operations. Recovery requires data validation and reprocessing.`;
        if (hasCalc) return `Calculation engine producing incorrect outputs — formula or aggregation logic error affecting ${tickets.length} transactions. Financial and operational reports impacted.`;
        return `System behavior anomaly detected across ${tickets.length} operation(s). Technical investigation required to identify root cause and affected components.`;
      })(),
      suggestedActions: (() => [
        "Verify the affected systems and identify the blast radius",
        "Review recent deployments or configuration changes",
        `Engage the ${signal.recommended_team || "Engineering"} team for root cause analysis`,
        customerNames.length > 0 ? `Notify affected customers: ${customerNames.slice(0, 3).join(", ")}${customerNames.length > 3 ? ` and ${customerNames.length - 3} more` : ""}` : "",
        tickets.length >= 3 ? `Prioritize resolution — ${tickets.length} tickets indicate systemic issue` : "Investigate the reported issue and resolve per incident response playbook",
        "Document root cause and resolution for knowledge base",
      ].filter(Boolean))(),
      rolloutPlan: tickets.length > 1
        ? "1. Isolate affected systems to prevent further impact\n2. Implement hotfix or configuration change\n3. Deploy to staging for validation\n4. Roll out to production with monitoring\n5. Verify resolution across all affected accounts\n6. Post-mortem and knowledge documentation"
        : "1. Investigate and reproduce the reported issue\n2. Implement fix in development environment\n3. Deploy to production after validation\n4. Verify resolution with reporter\n5. Document findings in knowledge base",
      recommendedTeam: signal.recommended_team || "Engineering",
      timeline: signal.detected_at || firstSeen || null,
      firstSeen,
      lastSeen,
      durationHours: duration,
      riskAssessment: (() => {
        const ticketRisk = tickets.length >= 5 ? "Critical" : tickets.length >= 3 ? "High" : tickets.length >= 2 ? "Medium" : "Low";
        const customerRisk = customerNames.length >= 5 ? "Critical" : customerNames.length >= 3 ? "High" : customerNames.length >= 2 ? "Medium" : "Low";
        const severityRisk = maxPriority === "urgent" ? "Critical" : maxPriority === "high" ? "High" : "Medium";
        const overall = [ticketRisk, customerRisk, severityRisk].sort((a, b) => ({ Critical: 3, High: 2, Medium: 1, Low: 0 }[b] - { Critical: 3, High: 2, Medium: 1, Low: 0 }[a]))[0];
        return `Overall Risk: ${overall}\nTicket Volume Risk: ${ticketRisk}\nCustomer Impact Risk: ${customerRisk}\nSeverity Risk: ${severityRisk}`;
      })(),
      reproductionSummary: tickets.length > 0
        ? `Reproduced across ${tickets.length} independent ticket(s).\nCommon symptoms: ${keyTerms.slice(0, 5).join(", ")}.\nFirst occurrence: ${firstSeen ? new Date(firstSeen).toISOString().split("T")[0] : "N/A"}\nDuration: ${duration > 0 ? `${durationHours} hours` : "Ongoing"}`
        : "Awaiting linked ticket data for reproduction analysis.",
      clusterConfidence: signal.analysis_confidence ?? signal.confidence ?? signal.confidence_score ?? 0,
    };
  }, [signal, linkedTickets]);

  const markdown = useMemo(() => {
    const d = handoffData;
    const lines = [
      `# Engineering Handoff: ${d.title}`,
      ``,
      `## Executive Summary`,
      d.summary || "N/A",
      ``,
      `## Detailed Root Cause`,
      d.rootCause || "N/A",
      ``,
      `## Cluster Analysis`,
      `- **Confidence**: ${d.clusterConfidence}%`,
      `- **Affected Tickets**: ${d.affectedTicketCount}`,
      `- **Affected Customers**: ${d.affectedCustomerCount}`,
      d.customerNames.length > 0 ? `- **Customer Names**: ${d.customerNames.join(", ")}` : "",
      `- **Categories**: ${d.categories}`,
      `- **Priority**: ${d.priority.charAt(0).toUpperCase() + d.priority.slice(1)}`,
      `- **Severity**: ${d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}`,
      ``,
      `## Affected Ticket IDs`,
      d.ticketIds.length > 0 ? d.ticketIds.map((id) => `- ${id}`).join("\n") : "N/A",
      ``,
      `## Business Impact`,
      d.businessImpact,
      ``,
      `## Technical Impact`,
      d.technicalImpact,
      ``,
      `## Suggested Engineering Actions`,
      d.suggestedActions.map((a, i) => `${i + 1}. ${a}`).join("\n"),
      ``,
      `## Recommended Rollout Plan`,
      d.rolloutPlan,
      ``,
      `## Suggested Owner / Team`,
      d.recommendedTeam,
      ``,
      `## Timeline`,
      d.timeline ? `- **Detected**: ${new Date(d.timeline).toISOString().split("T")[0]}` : "",
      d.firstSeen ? `- **First Occurrence**: ${new Date(d.firstSeen).toISOString().split("T")[0]}` : "",
      d.lastSeen ? `- **Last Occurrence**: ${new Date(d.lastSeen).toISOString().split("T")[0]}` : "",
      d.durationHours > 0 ? `- **Duration**: ${d.durationHours} hours` : "",
      ``,
      `## Risk Assessment`,
      d.riskAssessment,
      ``,
      `## Reproduction Summary`,
      d.reproductionSummary,
      ``,
      `---`,
      `*Generated by SignalDesk · Engineering Handoff Package*`,
    ];
    return lines.filter(Boolean).join("\n");
  }, [handoffData]);

  const json = useMemo(() => JSON.stringify(handoffData, null, 2), [handoffData]);

  const handleCopy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); toast.success(`${label} copied`); setTimeout(() => setCopied(null), 2000); }
    catch { toast.error("Failed to copy"); }
  };

  const handleCreateIncident = async () => {
    setCreating(true);
    const toastId = toast.loading("Creating incident...");
    const d = handoffData;
    try {
      const description = [
        `**Executive Summary**: ${d.summary || "N/A"}`,
        `**Root Cause**: ${d.rootCause || "N/A"}`,
        `**Confidence**: ${d.clusterConfidence}%`,
        `**Priority**: ${d.priority}`,
        `**Severity**: ${d.severity}`,
        `**Categories**: ${d.categories}`,
        `**Affected Tickets**: ${d.affectedTicketCount}`,
        `**Affected Customers**: ${d.affectedCustomerCount}${d.customerNames.length > 0 ? ` (${d.customerNames.join(", ")})` : ""}`,
        ``,
        `**Business Impact**: ${d.businessImpact}`,
        `**Technical Impact**: ${d.technicalImpact}`,
        ``,
        `**Suggested Actions**:`,
        ...d.suggestedActions.map((a) => `- ${a}`),
        ``,
        `**Rollout Plan**:`,
        d.rolloutPlan,
        ``,
        `**Risk Assessment**:`,
        d.riskAssessment,
        ``,
        `**Reproduction Summary**:`,
        d.reproductionSummary,
        ``,
        `**Timeline**:`,
        d.timeline ? `Detected: ${new Date(d.timeline).toISOString().split("T")[0]}` : "",
        d.firstSeen ? `First occurrence: ${new Date(d.firstSeen).toISOString().split("T")[0]}` : "",
        d.durationHours > 0 ? `Duration: ${d.durationHours} hours` : "",
      ].filter(Boolean).join("\n");

      let incId;
      let raw;
      if (signal.workspaceId) {
        const incPayload = {
          signal_id: signal.id,
          title: `Incident: ${d.title}`,
          summary: d.summary,
          severity: d.severity,
          description,
          workspace_id: signal.workspaceId,
          workspace_name: signal.workspaceName,
          affected_customer_count: d.affectedCustomerCount || 0,
          root_cause: d.rootCause || d.summary,
          category: d.categories?.split(", ")[0] || signal.category || "general",
        };

        raw = await client.functions.run("link_incident", { input: incPayload });
        const output = raw.output_data || raw || {};
        incId = output.incident_id || output.id || output;
      } else {
        raw = await client.records.create("incidents", {
          title: `Incident: ${d.title}`,
          summary: d.summary,
          status: "open",
          severity: d.severity,
          description,
          signal_id: signal.id,
          affected_ticket_count: d.affectedTicketCount,
          affected_customer_count: d.affectedCustomerCount || 0,
          root_cause: d.rootCause || d.summary,
          category: d.categories?.split(", ")[0] || signal.category || "general",
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        });
        incId = raw.id || raw;
      }


      if (!incId || typeof incId !== "string") throw new Error("Incident creation returned no ID");

      // Fire Gmail + Linear connectors for urgent incidents via shared workflow
      if (d.severity === "urgent" || d.severity === "high") {
        runGmailAlert({
          id: incId, severity: d.severity, title: d.title,
          workspaceId: workspace.id, workspaceName: workspace.name,
          email_sent: false,
        });
      }
      if (d.severity === "urgent") {
        syncToLinear(incId);
      }

      /* Link signal to incident */
      await client.records.update("signals", signal.id, {
        incident_id: incId, workflowStage: "incident_created", status: "approved",
      });

      /* Link ALL clustered tickets */
      for (const ticketId of d.ticketIds) {
        await client.records.create("ticket_incidents", {
          id: crypto.randomUUID(), incident_id: incId,
          ticket_id: ticketId, linked_at: new Date().toISOString(),
          workspaceId: signal.workspaceId || workspace.id,
          workspaceName: signal.workspaceName || workspace.name,
        }).catch(() => {});
      }

      /* Audit log */
      await client.records.create("audit_logs", {
        action: "engineering.handoff",
        actor_type: "user",
        resource_type: "incident",
        resource_id: incId,
        signal_id: signal.id,
        details: { title: d.title, severity: d.severity, ticketCount: d.affectedTicketCount, customerCount: d.affectedCustomerCount },
      }).catch(() => {});

      /* Notification */
      await createNotification({
        action: "engineering.handoff",
        actor: "Support Manager",
        resourceType: "incident",
        resourceId: incId,
        details: { name: d.title, severity: d.severity, ticketCount: d.affectedTicketCount },
        workspaceId: signal.workspaceId || workspace.id,
        workspaceName: signal.workspaceName || workspace.name,
      });

      toast.dismiss(toastId);
      toast.success("Incident created");
      emitRefresh();

      resetSync();
      setSuccessState({
        incidentId: incId,
        title: d.title, ticketCount: d.affectedTicketCount, customerCount: d.affectedCustomerCount,
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to create incident");
    } finally {
      setCreating(false);
    }
  };

  if (successState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Incident Created</h2>
              <p className="text-sm text-muted dark:text-muted-dark">{successState.title}</p>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-[#202024] px-4 py-2.5">
              <span className="text-sm text-muted dark:text-muted-dark">Incident ID</span>
              <span className="text-sm font-mono text-primary">{successState.incidentId.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-[#202024] px-4 py-2.5">
              <span className="text-sm text-muted dark:text-muted-dark">Affected Tickets</span>
              <span className="text-sm font-medium text-primary">{successState.ticketCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-[#202024] px-4 py-2.5">
              <span className="text-sm text-muted dark:text-muted-dark">Affected Customers</span>
              <span className="text-sm font-medium text-primary">{successState.customerCount}</span>
            </div>
            {/* Sync Section */}
            {(() => {
              const syncedData = syncStatus === SYNC_STATUS.SYNCED ? syncResult : persistedLinear;
              if (syncedData) {
                return (<div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Synced</span>
                  </div>
                  {syncedData.identifier && (
                    <div className="flex items-center justify-between rounded-lg bg-white dark:bg-[#202024] px-3 py-2 mb-2">
                      <span className="text-xs text-muted dark:text-muted-dark">Issue Key</span>
                      <span className="text-xs font-mono font-medium text-primary">{syncedData.identifier}</span>
                    </div>
                  )}
                  {syncedData.issueUrl && (
                    <div className="flex items-center justify-between rounded-lg bg-white dark:bg-[#202024] px-3 py-2 mb-2">
                      <span className="text-xs text-muted dark:text-muted-dark">Issue URL</span>
                      <a href={syncedData.issueUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[200px]">{syncedData.issueUrl}</a>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-lg bg-white dark:bg-[#202024] px-3 py-2">
                    <span className="text-xs text-muted dark:text-muted-dark">Last Synced</span>
                    <span className="text-xs font-medium text-primary">{syncedData.syncedAt ? new Date(syncedData.syncedAt).toLocaleTimeString() : "—"}</span>
                  </div>
                </div>);
              }
              if (syncStatus === SYNC_STATUS.CONNECTOR_UNAVAILABLE) {
                return (<div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Ready to Sync</span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Linear connector is not configured.</p>
                </div>);
              }
              if (syncStatus === SYNC_STATUS.ERROR) {
                return (<div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">Sync Failed</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mb-3">{syncError || "Unknown error"}</p>
                  <button onClick={handleSyncToLinear} disabled={syncLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-all disabled:opacity-50">
                    {syncLoading ? <Loader2 size={12} className="animate-spin" /> : null} Retry
                  </button>
                </div>);
              }
              if (syncStatus === SYNC_STATUS.CONNECTING) {
                return (<div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Syncing with Linear...</span>
                  </div>
                </div>);
              }
              return (
                <button onClick={handleSyncToLinear} disabled={syncLoading}
                  className="w-full rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all disabled:opacity-50">
                  {syncLoading ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                  Ready to Sync
                </button>
              );
            })()}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 transition-all">Done</button>
            {(() => {
              const url = syncStatus === SYNC_STATUS.SYNCED ? syncResult?.issueUrl : persistedLinear?.issueUrl;
              return url ? (
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-body hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all flex-1">
                  <ExternalLink size={14} /> Open in Linear
                </a>
              ) : null;
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-indigo-500" />
            <h2 className="text-xl font-bold text-primary">Engineering Handoff</h2>
            {loadingTickets && <Loader2 size={14} className="animate-spin text-muted" />}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted dark:text-muted-dark hover:text-body hover:bg-zinc-100 dark:hover:bg-[#202024] transition-all"><X size={20} /></button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Confidence</p>
            <p className="mt-1 text-sm font-semibold text-primary">{handoffData.clusterConfidence}%</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Affected Tickets</p>
            <p className="mt-1 text-sm font-semibold text-primary">{handoffData.affectedTicketCount}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Affected Customers</p>
            <p className="mt-1 text-sm font-semibold text-primary">{handoffData.affectedCustomerCount}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Priority</p>
            <p className="mt-1 text-sm font-semibold text-primary">{handoffData.priority.charAt(0).toUpperCase() + handoffData.priority.slice(1)}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Severity</p>
            <p className="mt-1 text-sm font-semibold text-primary">{handoffData.severity.charAt(0).toUpperCase() + handoffData.severity.slice(1)}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Categories</p>
            <p className="mt-1 text-sm font-semibold text-primary truncate">{handoffData.categories}</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Executive Summary</p>
          <p className="text-sm text-body">{handoffData.summary || "N/A"}</p>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Detailed Root Cause</p>
          <p className="text-sm text-body">{handoffData.rootCause || "N/A"}</p>
        </div>

        {handoffData.customerNames.length > 0 && (
          <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark mb-1">Customer Names</p>
            <p className="text-sm text-body">{handoffData.customerNames.join(", ")}</p>
          </div>
        )}

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Business Impact</p>
          <p className="text-sm text-body">{handoffData.businessImpact}</p>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Technical Impact</p>
          <p className="text-sm text-body">{handoffData.technicalImpact}</p>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Suggested Engineering Actions</p>
          <ol className="list-decimal list-inside text-sm text-body space-y-0.5">
            {handoffData.suggestedActions.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Recommended Rollout Plan</p>
          <pre className="text-sm text-body whitespace-pre-wrap font-sans">{handoffData.rolloutPlan}</pre>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Risk Assessment</p>
          <pre className="text-sm text-body whitespace-pre-wrap font-sans">{handoffData.riskAssessment}</pre>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Reproduction Summary</p>
          <pre className="text-sm text-body whitespace-pre-wrap font-sans">{handoffData.reproductionSummary}</pre>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Timeline</p>
          <div className="text-sm text-body space-y-0.5">
            {handoffData.timeline && <p>Detected: {new Date(handoffData.timeline).toISOString().split("T")[0]}</p>}
            {handoffData.firstSeen && <p>First occurrence: {new Date(handoffData.firstSeen).toISOString().split("T")[0]}</p>}
            {handoffData.durationHours > 0 && <p>Duration: {handoffData.durationHours} hours</p>}
            {!handoffData.timeline && !handoffData.firstSeen && <p>Awaiting timeline data from linked tickets</p>}
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
          <p className="text-xs text-muted dark:text-muted-dark mb-1">Recommended Owner / Team</p>
          <p className="text-sm font-medium text-primary">{handoffData.recommendedTeam}</p>
        </div>

        {handoffData.ticketIds.length > 0 && (
          <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark mb-1">Affected Ticket IDs</p>
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {handoffData.ticketIds.map((id, i) => (
                <p key={id} className="text-xs font-mono text-body">{i + 1}. {id} — {handoffData.ticketTitles[i] || id}</p>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-border bg-zinc-50 dark:bg-[#202024] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><FileText size={15} className="text-muted-base" /><span className="text-xs font-semibold text-muted-base uppercase tracking-wide">Markdown Preview</span></div>
            <button onClick={() => handleCopy(markdown, "Markdown")} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-base hover:text-body transition-colors">
              {copied === "Markdown" ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-card p-3 text-xs leading-relaxed text-body whitespace-pre-wrap font-mono max-h-48">{markdown}</pre>
        </div>

        <div className="mb-5 rounded-xl border border-border bg-zinc-50 dark:bg-[#202024] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Code size={15} className="text-muted-base" /><span className="text-xs font-semibold text-muted-base uppercase tracking-wide">JSON Preview</span></div>
            <button onClick={() => handleCopy(json, "JSON")} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-base hover:text-body transition-colors">
              {copied === "JSON" ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-card p-3 text-xs leading-relaxed text-body whitespace-pre-wrap font-mono max-h-48">{json}</pre>
        </div>

        <div className="flex gap-3">
          {canCreateIncidentFromSignal && (
            <button onClick={handleCreateIncident} disabled={creating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
              {creating ? "Creating Incident..." : "Create Incident"}
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-secondary-body hover:bg-zinc-50 dark:hover:bg-[#202024] transition-all">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CreateSignalForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", summary: "", category: "" });
  const [submitting, setSubmitting] = useState(false);
  const { workspace } = useWorkspace();

  const handleCreate = async () => {
    if (!form.name) return;
    setSubmitting(true);
    try {
      const result = await client.functions.run("create_signal", { input: { title: form.name, summary: form.summary, category: form.category || "general" } });
      const signalId = result.output_data?.signal_id || result.signal_id || result.id;
      if (signalId && workspace.id && workspace.id !== "signaldesk") {
        await client.records.update("signals", signalId, { workspaceId: workspace.id, workspaceName: workspace.name });
      }
      if (signalId) {
        onCreated({
          id: signalId,
          name: form.name,
          summary: form.summary,
          category: form.category || "general",
          status: "pending",
          workflowStage: "new",
          proposed_priority: "normal",
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          detected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      } else {
        onCreated();
      }
      onClose();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <input placeholder="Signal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-xl border border-border bg-card p-2.5 text-sm text-primary outline-none transition-all focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200" />
      <textarea placeholder="Summary" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
        className="w-full rounded-xl border border-border bg-card p-2.5 text-sm text-primary outline-none transition-all focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200 resize-none" />
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
        className="w-full rounded-xl border border-border bg-card p-2.5 text-sm text-primary outline-none transition-all focus:border-zinc-300">
        <option value="">Select category</option>
        {workspace.signalCategories.map((cat) => (<option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>))}
      </select>
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={submitting || !form.name}
          className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
          {submitting ? "Creating..." : "Create"}
        </button>
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-base hover:text-primary transition-all">Cancel</button>
      </div>
    </div>
  );
}

export default function Signals() {
  const { workspace } = useWorkspace();
  const { isManager } = useRole();
  const signalFilters = workspaceFilter(workspace.id);
  const { data: signals, loading, refresh } = useLemmaRecords("signals", { limit: 100, filters: signalFilters, sort: [{ field: "created_at", direction: "desc" }] });
  const refreshRef = useCallback(() => { refresh(); emitRefresh(); }, [refresh]);
  useRefreshListener(refreshRef);
  const [creatingIn, setCreatingIn] = useState(null);
  const [handoffSignal, setHandoffSignal] = useState(null);
  const [view, setView] = useState("kanban");
  const [optimisticSignals, setOptimisticSignals] = useState([]);

  const [dragId, setDragId] = useState(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);

  const knowledgeFilters = useMemo(() => workspaceFilter(workspace.id), [workspace.id]);
  const { data: allKnowledge } = useLemmaRecords("memory_entries", { limit: 200, filters: knowledgeFilters });

  const knownKnowledgeMap = useMemo(() => {
    const map = {};
    if (!allKnowledge) return map;
    signals.forEach((s) => {
      const title = (s.name || s.summary || "").toLowerCase();
      const cat = (s.category || "").toLowerCase();
      const match = allKnowledge.find((k) => {
        const kt = (k.title || "").toLowerCase();
        const ks = (k.summary || "").toLowerCase();
        const krc = (k.root_cause || "").toLowerCase();
        return kt.includes(title) || title.includes(kt) || ks.includes(title) || krc.includes(title) || (cat && (k.category || "").toLowerCase().includes(cat));
      });
      if (match) map[s.id] = match;
    });
    return map;
  }, [allKnowledge, signals]);

  const allSignals = useMemo(() => {
    if (optimisticSignals.length === 0) return signals;
    const existingIds = new Set(signals.map((s) => s.id));
    const newOnes = optimisticSignals.filter((o) => !existingIds.has(o.id));
    if (newOnes.length === 0) return signals;
    return [...newOnes, ...signals];
  }, [signals, optimisticSignals]);

  const columns = useMemo(() => COLUMNS.map((col) => ({
    ...col,
    cards: allSignals.filter((s) => s.status !== "rejected" && s.status !== "memory" && deriveWorkflowStage(s) === col.workflowStage),
  })), [allSignals]);

  const navigate = useNavigate();

  const handleSignalClick = useCallback((signal) => {
    if (signal.incident_id) {
      navigate("/incidents");
    } else {
      setHandoffSignal(signal);
    }
  }, [navigate]);

  const handleCreated = useCallback((optimisticSignal) => {
    if (optimisticSignal) setOptimisticSignals((prev) => [...prev, optimisticSignal]);
    refreshRef();
  }, [refreshRef]);

  const handleDragStart = useCallback((e, signal) => {
    setDragId(signal.id);
    e.dataTransfer.setData("text/plain", signal.id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(async (e, targetStage) => {
    e.preventDefault();
    const signalId = e.dataTransfer.getData("text/plain");
    if (!signalId) return;
    const signal = signals.find((s) => s.id === signalId);
    if (!signal) return;
    const currentStage = deriveWorkflowStage(signal);
    if (currentStage === targetStage) return;
    const col = COLUMNS.find((c) => c.workflowStage === targetStage);
    const label = col?.label || targetStage;
    try {
      if (targetStage === "incident_created") {
        /* Create incident first (do NOT move signal until incident succeeds) */
        const sections = [
          `**Summary**: ${signal.summary || "N/A"}`,
          `**Root Cause**: ${signal.root_cause || "N/A"}`,
          `**Priority**: ${signal.proposed_priority || "normal"}`,
          `**Confidence**: ${signal.analysis_confidence ?? signal.confidence ?? 0}%`,
          `**Affected Customers**: ${signal.affected_customer_count || 0}`,
          `**Category**: ${signal.category || "N/A"}`,
        ];
        let raw;
        if (signal.workspaceId) {
          const incPayload = {
            signal_id: signalId,
            title: `Incident: ${signal.name || signal.summary}`,
            summary: signal.summary,
            severity: signal.proposed_priority || "normal",
            description: sections.join("\n"),
            workspace_id: signal.workspaceId,
            workspace_name: signal.workspaceName,
            affected_customer_count: signal.affected_customer_count || 0,
            root_cause: signal.root_cause || signal.summary,
            category: signal.category || "general",
          };

          raw = await client.functions.run("link_incident", { input: incPayload });
        } else {
          raw = await client.records.create("incidents", {
            title: `Incident: ${signal.name || signal.summary}`,
            summary: signal.summary,
            status: "open",
            severity: signal.proposed_priority || "normal",
            description: sections.join("\n"),
            affected_customer_count: signal.affected_customer_count || 0,
            root_cause: signal.root_cause || signal.summary,
            category: signal.category || "general",
          });
        }
        const output = raw.output_data || raw || {};
        const incId = output.incident_id || output.id || output;
        if (!incId || typeof incId !== "string") throw new Error("Incident creation returned no ID");
        const severity = signal.proposed_priority || "normal";
        if (severity === "urgent" || severity === "high") {
          runGmailAlert({
            id: incId, severity, title: signal.name || signal.summary,
            workspaceId: signal.workspaceId || workspace.id,
            workspaceName: signal.workspaceName || workspace.name,
            email_sent: false,
          });
        }
        if (severity === "urgent") {
          syncToLinear(incId);
        }
        await client.records.update("signals", signalId, { incident_id: incId, workflowStage: "incident_created", status: "approved" });
        await createNotification({
          action: "incident.created",
          actor: "Support Manager",
          resourceType: "incident",
          resourceId: incId,
          details: { name: signal.name || signal.summary },
          workspaceId: signal.workspaceId || workspace.id,
          workspaceName: signal.workspaceName || workspace.name,
        });
        await createNotification({
          action: "signal.workflow_changed",
          actor: "Support Manager",
          resourceType: "signal",
          resourceId: signalId,
          details: { name: signal.name || signal.summary, from: currentStage, to: targetStage },
          workspaceId: signal.workspaceId || workspace.id,
          workspaceName: signal.workspaceName || workspace.name,
        });
        toast.success(`Signal moved to ${label}, incident auto-created`);
      } else {
        /* Non-incident stages: update workflowStage directly */
        const updates = { workflowStage: targetStage };
        await client.records.update("signals", signalId, updates);
        await createNotification({
          action: "signal.workflow_changed",
          actor: "Support Manager",
          resourceType: "signal",
          resourceId: signalId,
          details: { name: signal.name || signal.summary, from: currentStage, to: targetStage },
          workspaceId: signal.workspaceId || workspace.id,
          workspaceName: signal.workspaceName || workspace.name,
        });
        if (targetStage === "memory") {
          try {
            const memRaw = await client.functions.run("create_memory_entry", {
              input: {
                title: signal.name || signal.summary || "Signal Knowledge",
                summary: signal.summary || "",
                root_cause: signal.root_cause || "",
                source_signal_id: signalId,
                related_incident_id: signal.incident_id || null,
                category: signal.category || "general",
                tags: [signal.category].filter(Boolean),
                confidence: signal.analysis_confidence ?? signal.confidence ?? 80,
                workspaceId: signal.workspaceId || workspace.id,
                workspaceName: signal.workspaceName || workspace.name,
              },
            });
            const memResult = memRaw.output_data || memRaw || {};
            const memId = memResult.id || memResult.memory_entry_id;
            if (memId) {
              await client.records.update("signals", signalId, { memory_entry_id: memId, status: "memory" });
            }
            toast.success(`Signal converted to Knowledge`);
          } catch (memErr) {
            console.warn("Memory creation failed:", memErr);
            toast.error("Failed to convert signal to Knowledge");
          }
        } else {
          toast.success(`Signal moved to ${label}`);
        }
      }
      refreshRef();
    } catch (err) {
      toast.error(err?.message || "Failed to update signal");
    }
    setDragId(null);
  }, [signals, refreshRef, workspace]);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Signals</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{allSignals.length} signal{allSignals.length !== 1 ? "s" : ""} detected</p>
        </div>
        <div className="flex items-center rounded-xl border border-border overflow-hidden shadow-sm">
          <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-150 ${view === "kanban" ? "bg-zinc-900 text-white" : "text-muted-base hover:bg-zinc-50 dark:hover:bg-[#202024]"}`}>
            <Columns3 size={14} /> Kanban
          </button>
          <div className="w-px h-4 bg-border" />
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all duration-150 ${view === "list" ? "bg-zinc-900 text-white" : "text-muted-base hover:bg-zinc-50 dark:hover:bg-[#202024]"}`}>
            <List size={14} /> List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-6 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 space-y-3"><div className="h-6 w-24 animate-pulse rounded bg-zinc-100 dark:bg-[#202024]" />{[1, 2, 3].map((j) => <div key={j} className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}</div>
          ))}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {allSignals.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-card">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary truncate">{s.name || s.summary || s.id}</p>
                <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{s.category || ""}</p>
              </div>
              <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                {s.category && <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${getTagStyle(s.category)}`}>{s.category}</span>}
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${getPriorityStyle(s.proposed_priority)}`}>
                  {(s.proposed_priority || "normal").charAt(0).toUpperCase() + (s.proposed_priority || "normal").slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="flex-1 min-w-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <h2 className="text-sm font-semibold text-body">{col.label}</h2>
                  <span className="text-xs font-medium text-muted dark:text-muted-dark bg-zinc-100 dark:bg-[#202024] rounded-full px-2 py-0.5">{col.cards.length}</span>
                </div>
                <button className="text-muted dark:text-muted-dark hover:text-body p-1 rounded hover:bg-zinc-100 dark:hover:bg-[#202024] transition-all"><MoreHorizontal size={14} /></button>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.workflowStage)}
                className={`space-y-3 flex-1 overflow-y-auto min-h-[200px] transition-colors duration-150 ${dragId ? "rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/30" : ""}`}>
                {col.cards.length === 0 ? (
                  <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 dark:bg-[#202024]/50"><p className="text-xs text-muted dark:text-muted-dark">No signals</p></div>
                ) : (
                  col.cards.map((s, i) => <KanbanCard key={s.id} signal={s} index={i} isManager={isManager} onOpenHandoff={handleSignalClick} onDragStart={handleDragStart} knownKnowledge={knownKnowledgeMap[s.id]} onViewKnowledge={setSelectedKnowledge} />)
                )}
              </div>
              <button onClick={() => setCreatingIn(creatingIn === col.id ? null : col.id)}
                className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs font-medium text-muted dark:text-muted-dark hover:text-body hover:bg-zinc-50 dark:hover:bg-[#202024] border border-transparent hover:border-border transition-all">
                <Plus size={13} /> Create Signal
              </button>
              {creatingIn === col.id && <CreateSignalForm onClose={() => setCreatingIn(null)} onCreated={handleCreated} />}
            </div>
          ))}
        </div>
      )}

      {handoffSignal && <EngineeringHandoffModal signal={handoffSignal} onClose={() => setHandoffSignal(null)} />}

      {selectedKnowledge && (
        <KnowledgeDrawer entry={selectedKnowledge} onClose={() => setSelectedKnowledge(null)} />
      )}
    </motion.div>
  );
}
