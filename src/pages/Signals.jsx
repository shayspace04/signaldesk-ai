import { motion } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import { Plus, MoreHorizontal, Calendar, Paperclip, MessageSquare, List, Columns3, ExternalLink, Copy, Check, X, Code, FileText, ShieldAlert, Loader2, BookOpen, Lightbulb } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener, emitRefresh } from "@/lib/refreshEvents";
import { toast } from "sonner";
import client from "@/lib/lemmaClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import useRole from "@/hooks/useRole";
import { createNotification } from "@/lib/notifications";
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

const AVATARS = ["JD", "AK", "SM", "RP", "TL"];
const COMMENTS = [1, 2, 0, 3, 1, 0, 2, 4, 1, 0, 2, 1, 0, 3, 2];
const ATTACHMENTS = [2, 0, 1, 3, 0, 1, 2, 0, 1, 2, 0, 1, 3, 0, 1];

function getTagStyle(category) {
  return TAG_STYLES[(category || "").toLowerCase()] || "bg-zinc-100 text-zinc-600 dark:bg-[#202024] dark:text-muted-dark";
}

function getPriorityStyle(priority) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal;
}

function KanbanCard({ signal, index: cardIndex, isManager, onOpenHandoff, onDragStart, knownKnowledge, onViewKnowledge }) {
  const avatars = useMemo(() => AVATARS.slice(0, (cardIndex % 3) + 2), [cardIndex]);
  const commentCount = COMMENTS[cardIndex % COMMENTS.length];
  const attachmentCount = ATTACHMENTS[cardIndex % ATTACHMENTS.length];
  const progress = useMemo(() => {
    const stage = deriveWorkflowStage(signal);
    if (stage === "incident_created") return 90;
    if (stage === "approved") return 80;
    if (stage === "review") return 50;
    return Math.min(25 + (signal.analysis_confidence || 0) * 0.3, 45);
  }, [signal]);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      draggable
      onDragStart={(e) => onDragStart?.(e, signal)}
      className="group rounded-xl border border-border dark:border-border-dark bg-card p-4 transition-all duration-200 hover:border-zinc-300 hover:shadow-card cursor-grab active:cursor-grabbing">
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
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {avatars.map((a, i) => (
            <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-[#27272A] bg-zinc-200 dark:bg-[#202024] text-[8px] font-semibold text-secondary-body">{a}</div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {attachmentCount > 0 && <span className="flex items-center gap-1 text-[11px] text-muted dark:text-muted-dark"><Paperclip size={12} />{attachmentCount}</span>}
          {commentCount > 0 && <span className="flex items-center gap-1 text-[11px] text-muted dark:text-muted-dark"><MessageSquare size={12} />{commentCount}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function EngineeringHandoffModal({ signal, onClose }) {
  const { workspace } = useWorkspace();
  const { canCreateIncidentFromSignal } = useRole();
  const [copied, setCopied] = useState(null);
  const [creating, setCreating] = useState(false);

  const handoffData = useMemo(() => ({
    title: signal.name || signal.summary || signal.id,
    summary: signal.summary || "",
    rootCause: signal.root_cause || signal.ai_summary || "",
    priority: signal.proposed_priority || signal.severity || "normal",
    confidence: signal.analysis_confidence || 85,
    affectedCustomers: signal.affected_customer_count || 0,
    affectedTickets: signal.ticket_count || signal.related_ticket_count || 0,
    evidence: signal.evidence || [],
    timeline: signal.detected_at || null,
    category: signal.category || "N/A",
    churnRisk: signal.churn_risk || "N/A",
    recommendedTeam: signal.recommended_team || "Engineering",
    estimatedRevenueRisk: signal.estimated_revenue_risk || "N/A",
  }), [signal]);

  const markdown = useMemo(() => `# Engineering Handoff: ${handoffData.title}

## Summary
${handoffData.summary || "N/A"}

## Root Cause
${handoffData.rootCause || "N/A"}

## Priority
${handoffData.priority.charAt(0).toUpperCase() + handoffData.priority.slice(1)}

## Confidence
${handoffData.confidence}%

## Affected Customers
${handoffData.affectedCustomers}

## Affected Tickets
${handoffData.affectedTickets}

## Evidence
${Array.isArray(handoffData.evidence) && handoffData.evidence.length > 0 ? handoffData.evidence.map((e) => `- ${e}`).join("\n") : "N/A"}

## Timeline
${handoffData.timeline ? new Date(handoffData.timeline).toISOString().split("T")[0] : "N/A"}

---
Generated by SignalDesk · Engineering Handoff Package`, [handoffData]);

  const json = useMemo(() => JSON.stringify(handoffData, null, 2), [handoffData]);

  const handleCopy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); toast.success(`${label} copied`); setTimeout(() => setCopied(null), 2000); }
    catch { toast.error("Failed to copy"); }
  };

  const handleCreateIncident = async () => {
    setCreating(true);
    const toastId = toast.loading("Creating incident...");
    try {
      const sections = [
        `**Summary**: ${handoffData.summary || "N/A"}`,
        `**Root Cause**: ${handoffData.rootCause || "N/A"}`,
        `**Priority**: ${handoffData.priority}`,
        `**Confidence**: ${handoffData.confidence}%`,
        `**Affected Customers**: ${handoffData.affectedCustomers}`,
        `**Affected Tickets**: ${handoffData.affectedTickets}`,
        `**Category**: ${handoffData.category}`,
        `**Churn Risk**: ${handoffData.churnRisk}`,
        `**Recommended Team**: ${handoffData.recommendedTeam}`,
        `**Estimated Revenue Risk**: ${handoffData.estimatedRevenueRisk}`,
      ];
      let raw;
      if (signal.workspaceId) {
        raw = await client.functions.run("link_incident", {
          input: {
            signal_id: signal.id,
            title: `Incident: ${handoffData.title}`,
            summary: handoffData.summary,
            severity: handoffData.priority,
            description: sections.join("\n"),
            workspace_id: signal.workspaceId,
            workspace_name: signal.workspaceName,
          },
        });
      } else {
        raw = await client.records.create("incidents", {
          title: `Incident: ${handoffData.title}`,
          summary: handoffData.summary,
          status: "open",
          severity: handoffData.priority,
          description: sections.join("\n"),
          affected_ticket_count: handoffData.affectedTickets,
        });
      }
      const output = raw.output_data || raw || {};
      const incId = output.incident_id || output.id || output;
      if (incId) {
        await client.records.update("signals", signal.id, { incident_id: incId, workflowStage: "incident_created", status: "approved" });
        if (incId !== output) {
          await client.records.create("ticket_incidents", {
            id: crypto.randomUUID(), incident_id: incId,
            linked_at: new Date().toISOString(),
          });
        }
      }
      await createNotification({ action: "engineering.handoff", actor: "Support Manager", resourceType: "incident", resourceId: incId, details: { name: handoffData.title }, workspaceId: workspace.id, workspaceName: workspace.name });
      toast.dismiss(toastId);
      toast.success("Incident created from Engineering Handoff");
      emitRefresh();
      onClose();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to create incident");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-indigo-500" />
            <h2 className="text-xl font-bold text-primary">Engineering Handoff</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted dark:text-muted-dark hover:text-body hover:bg-zinc-100 dark:hover:bg-[#202024] transition-all"><X size={20} /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Summary</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.summary || "N/A"}</p></div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Root Cause</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.rootCause || "N/A"}</p></div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Priority</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.priority}</p></div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Confidence</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.confidence}%</p></div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Affected Customers</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.affectedCustomers}</p></div>
          <div className="rounded-xl bg-zinc-50 dark:bg-[#202024] p-3"><p className="text-xs text-muted dark:text-muted-dark">Affected Tickets</p><p className="mt-1 text-sm font-medium text-primary">{handoffData.affectedTickets}</p></div>
        </div>

        {Array.isArray(handoffData.evidence) && handoffData.evidence.length > 0 && (
          <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark mb-1">Evidence</p>
            {handoffData.evidence.map((e, i) => <p key={i} className="text-sm text-body">• {e}</p>)}
          </div>
        )}

        {handoffData.timeline && (
          <div className="mb-4 rounded-xl bg-zinc-50 dark:bg-[#202024] p-3">
            <p className="text-xs text-muted dark:text-muted-dark">Timeline</p>
            <p className="mt-1 text-sm text-body">Detected: {new Date(handoffData.timeline).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</p>
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
              {creating ? "Creating..." : "Create Incident"}
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
      onCreated(); onClose();
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
  const { data: signals, loading, refresh } = useLemmaRecords("signals", { limit: 100, filters: signalFilters });
  useRefreshListener(refresh);
  const [creatingIn, setCreatingIn] = useState(null);
  const [handoffSignal, setHandoffSignal] = useState(null);
  const [view, setView] = useState("kanban");

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

  const columns = useMemo(() => COLUMNS.map((col) => ({
    ...col,
    cards: signals.filter((s) => s.status !== "rejected" && s.status !== "memory" && deriveWorkflowStage(s) === col.workflowStage),
  })), [signals]);

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
          `**Confidence**: ${signal.analysis_confidence || 0}%`,
          `**Affected Customers**: ${signal.affected_customer_count || 0}`,
          `**Category**: ${signal.category || "N/A"}`,
        ];
        let raw;
        if (signal.workspaceId) {
          raw = await client.functions.run("link_incident", {
            input: {
              signal_id: signalId,
              title: `Incident: ${signal.name || signal.summary}`,
              summary: signal.summary,
              severity: signal.proposed_priority || "normal",
              description: sections.join("\n"),
              workspace_id: signal.workspaceId,
              workspace_name: signal.workspaceName,
            },
          });
        } else {
          raw = await client.records.create("incidents", {
            title: `Incident: ${signal.name || signal.summary}`,
            summary: signal.summary,
            status: "open",
            severity: signal.proposed_priority || "normal",
            description: sections.join("\n"),
          });
        }
        const output = raw.output_data || raw || {};
        const incId = output.incident_id || output.id || output;
        if (!incId || typeof incId !== "string") throw new Error("Incident creation returned no ID");
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
                confidence: signal.analysis_confidence || 80,
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
      refresh();
    } catch (err) {
      toast.error(err?.message || "Failed to update signal");
    }
    setDragId(null);
  }, [signals, refresh, workspace]);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Signals</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{signals.length} signal{signals.length !== 1 ? "s" : ""} detected</p>
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
          {signals.map((s, i) => (
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
                  col.cards.map((s, i) => <KanbanCard key={s.id} signal={s} index={i} isManager={isManager} onOpenHandoff={setHandoffSignal} onDragStart={handleDragStart} knownKnowledge={knownKnowledgeMap[s.id]} onViewKnowledge={setSelectedKnowledge} />)
                )}
              </div>
              <button onClick={() => setCreatingIn(creatingIn === col.id ? null : col.id)}
                className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs font-medium text-muted dark:text-muted-dark hover:text-body hover:bg-zinc-50 dark:hover:bg-[#202024] border border-transparent hover:border-border transition-all">
                <Plus size={13} /> Create Signal
              </button>
              {creatingIn === col.id && <CreateSignalForm onClose={() => setCreatingIn(null)} onCreated={refresh} />}
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
