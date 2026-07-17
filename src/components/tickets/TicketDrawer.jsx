import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Copy, RotateCcw,
  Bell, MessageSquare, Radio, ShieldAlert, FileText, Mail, Clock, AlertTriangle, Brain,
  ThumbsUp, Plus, ExternalLink, Save, Trash2, UserCheck, History, Lightbulb, Target,
  BarChart3, RefreshCw, User, Search, Check, SendHorizonal, AlertCircle, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { runGmailAlert, syncToLinear } from "@/lib/incidentWorkflow";
import { calculateChurnRisk } from "@/lib/churnRisk";
import useRole from "@/hooks/useRole";
import { useWorkspace } from "@/context/WorkspaceContext";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { workspaceFilter } from "@/lib/workspaceConfig";
import KnowledgeDrawer from "@/components/knowledge/KnowledgeDrawer";
import DraftCopilotPanel from "@/components/tickets/DraftCopilotPanel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];
const STATUS_OPTIONS = ["new", "triaged", "waiting_approval", "resolved"];

const NOTES_STORAGE_PREFIX = "signaldesk-notes-";

const AVATARS = ["AL", "JR", "MK", "SP", "TC", "AD", "KW", "CN"];
function avatarFor(id) {
  return AVATARS[Math.abs((id || "").length || 0) % AVATARS.length];
}

const AGENTS = [
  { id: "agent-alex", name: "Alex Rivera", role: "support_agent", avatar: "AR" },
  { id: "agent-jordan", name: "Jordan Chen", role: "support_agent", avatar: "JC" },
  { id: "agent-maya", name: "Maya Patel", role: "support_agent", avatar: "MP" },
  { id: "agent-sam", name: "Sam Torres", role: "support_manager", avatar: "ST" },
  { id: "agent-priya", name: "Priya Kumar", role: "support_agent", avatar: "PK" },
  { id: "agent-taylor", name: "Taylor Smith", role: "support_manager", avatar: "TS" },
  { id: "agent-casey", name: "Casey Wong", role: "support_agent", avatar: "CW" },
  { id: "agent-drew", name: "Drew Nelson", role: "support_agent", avatar: "DN" },
];

const ACTION_ICONS = {
  "ticket.created": { icon: FileText, color: "text-blue-500" },
  "ticket.updated": { icon: RefreshCw, color: "text-blue-500" },
  "ticket.resolved": { icon: CheckCircle2, color: "text-emerald-500 dark:text-emerald-400" },
  "ticket.escalated": { icon: AlertTriangle, color: "text-orange-500 dark:text-orange-400" },
  "ticket.assigned": { icon: UserCheck, color: "text-violet-500" },
  "ticket.priority_changed": { icon: BarChart3, color: "text-amber-500 dark:text-amber-400" },
  "ticket.status_changed": { icon: RefreshCw, color: "text-blue-500" },
  "draft.generated": { icon: Brain, color: "text-violet-500" },
  "draft.approved": { icon: CheckCircle2, color: "text-emerald-500 dark:text-emerald-400" },
  "draft.rejected": { icon: XCircle, color: "text-red-500 dark:text-red-400" },
  "draft.pending_approval": { icon: Clock, color: "text-amber-500 dark:text-amber-400" },
  "signal.detected": { icon: Radio, color: "text-green-500" },
  "signal.created": { icon: Radio, color: "text-green-500" },
  "incident.created": { icon: ShieldAlert, color: "text-red-500 dark:text-red-400" },
  "incident.linked": { icon: ShieldAlert, color: "text-red-500 dark:text-red-400" },
  "manager.notification_created": { icon: Bell, color: "text-cyan-500" },
  "email.sent": { icon: Mail, color: "text-emerald-500 dark:text-emerald-400" },
  "triage.completed": { icon: Brain, color: "text-purple-500" },
};

function getActionMeta(action) {
  return ACTION_ICONS[action] || { icon: Clock, color: "text-zinc-400 dark:text-zinc-500" };
}

// ---------------------------------------------------------------------------
// Audit log helper
// ---------------------------------------------------------------------------

async function addAuditLog(ticketId, action, details = {}, wsId, wsName) {
  try {
    await client.records.create("audit_logs", {
      id: crypto.randomUUID(),
      action,
      actor_type: "agent",
      actor_agent_name: "System",
      resource_type: "ticket",
      resource_id: ticketId,
      ticket_id: ticketId,
      details,
      workspaceId: wsId || "signaldesk",
      workspaceName: wsName || "SignalDesk",
      created_at: new Date().toISOString(),
    });
  } catch {}
}

function generateId() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EditableField({ label, value, onChange, onSave, type = "text", options, multiline }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  const commit = () => {
    if (draft !== (value ?? "")) {
      onSave({ [label.toLowerCase()]: draft });
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group cursor-pointer" onClick={() => setEditing(true)}>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">{label}</p>
        <p className="text-sm text-zinc-900 dark:text-zinc-50 group-hover:text-accent transition-colors">{value || "-"}</p>
      </div>
    );
  }

  if (multiline) {
    return (
      <div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{label}</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={4}
          className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{label}</p>
      {options ? (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
          autoFocus
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
          className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
          autoFocus
        />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-[#202024] transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-zinc-500 dark:text-zinc-400" />}
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-400 dark:text-zinc-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, destructive }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel}
            className="rounded-xl border border-border dark:border-border-dark px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${destructive ? "bg-red-600 hover:bg-red-500" : "bg-zinc-900 hover:bg-zinc-800"}`}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AssignDialog({ open, currentAssignee, onAssign, onCancel }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return AGENTS;
    const q = search.toLowerCase();
    return AGENTS.filter((a) => a.name.toLowerCase().includes(q));
  }, [search]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Assign Ticket</h3>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-0.5">
          <button
            onClick={() => onAssign(null)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A] ${!currentAssignee ? "bg-zinc-50 dark:bg-[#27272A]" : ""}`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#202024] text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <User size={14} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Unassigned</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Remove current assignee</p>
            </div>
            {!currentAssignee && <Check size={16} className="text-accent" />}
          </button>
          {filtered.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAssign(agent.name)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A] ${currentAssignee === agent.name ? "bg-zinc-50 dark:bg-[#27272A]" : ""}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#202024] text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {agent.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{agent.name}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">{agent.role.replace("_", " ")}</p>
              </div>
              {currentAssignee === agent.name && <Check size={16} className="text-accent" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">No agents found</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function IncidentSelectorDialog({ open, onLink, onCreateNew, onCancel, workspaceId }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const filters = workspaceId && workspaceId !== "signaldesk" ? { workspace: workspaceId } : undefined;
    client.records.list("incidents", { filters, sort: [{ field: "created_at", direction: "desc" }], limit: 50 })
      .then((res) => setIncidents(res.items || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter((i) => (i.title || "").toLowerCase().includes(q));
  }, [incidents, search]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Link Incident</h3>
            <button onClick={onCreateNew}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
              <Plus size={12} /> New
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-zinc-400 dark:text-zinc-500" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">No incidents found</p>
          ) : (
            filtered.map((inc) => (
              <button key={inc.id} onClick={() => onLink(inc)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{inc.title || inc.id}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    <PriorityBadge priority={inc.severity} /> <StatusBadge status={inc.status} />
                  </p>
                </div>
                <ExternalLink size={14} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0 ml-2" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CreateSignalDialog({ open, ticket, onCreate, onCancel }) {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState("normal");
  const [evidence, setEvidence] = useState("");
  const [impact, setImpact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && ticket) {
      setName(ticket.title || "");
      setSummary(ticket.body || "");
      setPriority(ticket.priority || "normal");
      setEvidence("");
      setImpact("");
    }
  }, [open, ticket]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await client.functions.run("create_signal", {
        input: { name, summary, category: ticket?.category || "general", proposed_priority: priority },
      });
      const signalId = result?.output_data?.signal_id || result?.signal_id || result?.id;
      if (!signalId) throw new Error("No signal ID returned");
      await client.records.update("tickets", ticket.id, { signal_id: signalId });
      await client.records.create("ticket_signals", {
        id: crypto.randomUUID(), ticket_id: ticket.id, signal_id: signalId,
        linked_at: new Date().toISOString(),
      });
      await addAuditLog(ticket.id, "signal.created", { name, signal_id: signalId }, ticket.workspaceId, ticket.workspaceName);
      toast.success("Signal created and linked");
      emitRefresh();
      onCreate(signalId);
    } catch (err) {
      toast.error(err?.message || "Failed to create signal");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create Signal</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Title</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Description</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Customer Impact</label>
              <select value={impact} onChange={(e) => setImpact(e.target.value)}
                className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none">
                <option value="">Select...</option>
                <option value="single">Single Customer</option>
                <option value="multiple">Multiple Customers</option>
                <option value="all">All Customers</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Evidence</label>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2}
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel}
            className="rounded-xl border border-border dark:border-border-dark px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create Signal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SignalSelectorDialog({ open, onLink, onCancel, workspaceId }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const filters = workspaceId && workspaceId !== "signaldesk" ? { workspace: workspaceId } : undefined;
    client.records.list("signals", { filters, sort: [{ field: "created_at", direction: "desc" }], limit: 50 })
      .then((res) => setSignals(res.items || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return signals;
    const q = search.toLowerCase();
    return signals.filter((s) => (s.name || "").toLowerCase().includes(q));
  }, [signals, search]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Link Existing Signal</h3>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signals..."
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-zinc-400 dark:text-zinc-500" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">No signals found</p>
          ) : (
            filtered.map((sig) => (
              <button key={sig.id} onClick={() => onLink(sig)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{sig.name || sig.id}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    <StatusBadge status={sig.status} /> <PriorityBadge priority={sig.proposed_priority} />
                  </p>
                </div>
                <ExternalLink size={14} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0 ml-2" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer Component
// ---------------------------------------------------------------------------

export default function TicketDrawer({ ticket: initialTicket, onClose, onRefresh }) {
  const {
    isManager,
    canResolveTicket,
    canCloseTicket,
    canDeleteTicket,
    canAssignTicket,
    canChangeStatus,
    canChangePriority,
    canChangeCategory,
    canGenerateDrafts,
    canEditDrafts,
    canSaveDrafts,
    canRegenerateDrafts,
    canCopyDrafts,
    canApproveDrafts,
    canRejectDrafts,
    canSendReplies,
    canAddNotes,
    canViewTimeline,
    canEditTicketDetails,
    canCreateSignal,
    canLinkIncident,
    canCreateIncident,
  } = useRole();
  const { workspace } = useWorkspace();
  const [ticket, setTicket] = useState(initialTicket);
  const [dirtyFields, setDirtyFields] = useState({});
  const [logs, setLogs] = useState([]);
  const [linkedSignals, setLinkedSignals] = useState([]);
  const [linkedIncidents, setLinkedIncidents] = useState([]);
  const [customerTickets, setCustomerTickets] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showLinkSignalDialog, setShowLinkSignalDialog] = useState(false);
  const [aiState, setAiState] = useState({ action: null, loading: false, result: null, history: [] });
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showIncidentSelector, setShowIncidentSelector] = useState(false);
  const [showCreateSignal, setShowCreateSignal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkingIncident, setLinkingIncident] = useState(false);
  const notesTimer = useRef(null);
  const drawerRef = useRef(null);
  const [ticketKey, setTicketKey] = useState(0);
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);

  const knowledgeFilters = useMemo(() => workspaceFilter(workspace.id), [workspace.id]);
  const { data: allKnowledge } = useLemmaRecords("memory_entries", { limit: 200, filters: knowledgeFilters });

  const knownSolutions = useMemo(() => {
    if (!allKnowledge || allKnowledge.length === 0 || !ticket) return [];
    const q = (ticket.title || "").toLowerCase();
    const cat = (ticket.category || "").toLowerCase();
    const body = (ticket.body || "").toLowerCase();
    const keywords = [...new Set([...q.split(/\s+/), ...body.split(/\s+/)].filter((w) => w.length > 3))];

    return allKnowledge
      .filter((e) => {
        const title = (e.title || "").toLowerCase();
        const summary = (e.summary || "").toLowerCase();
        const rc = (e.root_cause || "").toLowerCase();
        const res = (e.resolution || "").toLowerCase();
        const eCat = (e.category || "").toLowerCase();
        const tags = (e.tags || []).map((t) => String(t).toLowerCase());

        if (title.includes(q) || summary.includes(q)) return true;
        if (cat && eCat.includes(cat)) return true;
        if (rc.includes(q) || res.includes(q)) return true;
        if (keywords.some((kw) => title.includes(kw) || summary.includes(kw) || rc.includes(kw))) return true;
        if (tags.some((t) => keywords.includes(t) || q.includes(t))) return true;
        return false;
      })
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 3);
  }, [allKnowledge, ticket]);

  const fieldLabelMap = {
    title: "Subject",
    customer_name: "Customer",
    customer_email: "Email",
    priority: "Priority",
    status: "Status",
    category: "Category",
    body: "Description",
  };

  // Load initial data
  const loadTicketData = useCallback(async (ticketId, customerEmail) => {
    if (!ticketId) return;
    let mounted = true;
    setLoadingLogs(true);

    client.records.list("audit_logs", {
      filters: { ticket_id: ticketId },
      sort: [{ field: "created_at", direction: "desc" }],
      limit: 50,
    }).then((res) => { if (mounted) setLogs(res.items || res.data || []); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoadingLogs(false); });

    // Load linked signals from junction table
    client.records.list("ticket_signals", { filters: { ticket_id: ticketId }, limit: 20 })
      .then(async (res) => {
        const links = res.items || res.data || [];
        const signalPromises = links.map((l) =>
          client.records.get("signals", l.signal_id).catch(() => null)
        );
        const sigs = await Promise.all(signalPromises);
        if (mounted) setLinkedSignals(sigs.filter(Boolean));
      })
      .catch(() => { if (mounted) setLinkedSignals([]); });

    // Load linked incidents from junction table
    client.records.list("ticket_incidents", { filters: { ticket_id: ticketId }, limit: 20 })
      .then(async (res) => {
        const links = res.items || res.data || [];
        const incPromises = links.map((l) =>
          client.records.get("incidents", l.incident_id).catch(() => null)
        );
        const incs = await Promise.all(incPromises);
        if (mounted) setLinkedIncidents(incs.filter(Boolean));
      })
      .catch(() => { if (mounted) setLinkedIncidents([]); });

    if (customerEmail) {
      const filters = { customer_email: customerEmail };
      if (workspace.id !== "signaldesk") filters.workspace = workspace.id;
      client.records.list("tickets", { filters, limit: 50 })
        .then((res) => {
          if (mounted) setCustomerTickets((res.items || res.data || []).filter((t) => t.id !== ticketId));
        }).catch(() => {});
    }
  }, [workspace.id]);

  useEffect(() => {
    loadTicketData(ticket?.id, ticket?.customer_email);
  }, [ticket?.id, ticket?.customer_email, ticketKey]);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_PREFIX + ticket.id);
      if (saved) setNotes(saved);
    } catch {}
  }, [ticket.id]);

  // Auto-save notes
  const handleNotesChange = (text) => {
    setNotes(text);
    setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      try { localStorage.setItem(NOTES_STORAGE_PREFIX + ticket.id, text); } catch {}
      setNotesSaved(true);
    }, 2000);
  };

  // Refresh ticket data
  const refreshTicket = useCallback(async () => {
    try {
      const updated = await client.records.get("tickets", ticket.id);
      setTicket(updated);
      if (onRefresh) onRefresh();
    } catch {}
  }, [ticket.id, onRefresh]);

  // Field update: mark dirty instead of saving immediately
  const markDirty = (field, value) => {
    setDirtyFields((prev) => ({ ...prev, [field]: value }));
    setTicket((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldSave = (changes) => {
    Object.entries(changes).forEach(([field, value]) => markDirty(field, value));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !showAssign && !showIncidentSelector && !showCreateSignal && !showDeleteConfirm && !showCloseConfirm) {
        handleCloseDrawer();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, ticket, showAssign, showIncidentSelector, showCreateSignal, showDeleteConfirm]);

  // ==================== Save ====================
  const handleSave = async () => {
    const changes = { ...dirtyFields };
    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Saving changes...");
    try {
      await client.records.update("tickets", ticket.id, changes);
      setDirtyFields({});
      if (changes.status || changes.priority) {
        const action = changes.status ? "ticket.status_changed" : "ticket.priority_changed";
        await addAuditLog(ticket.id, action, { changes }, ticket.workspaceId, ticket.workspaceName);
      }
      toast.dismiss(toastId);
      toast.success("Changes saved");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ==================== Resolve ====================
  const handleResolve = async () => {
    setResolving(true);
    const toastId = toast.loading("Resolving ticket...");
    try {
      await client.records.update("tickets", ticket.id, { status: "resolved" });
      setTicket((prev) => ({ ...prev, status: "resolved" }));
      await addAuditLog(ticket.id, "ticket.resolved", { previous_status: ticket.status }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Ticket resolved");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to resolve");
    } finally {
      setResolving(false);
    }
  };

  // ==================== Close (drawer only) ====================
  const handleCloseDrawer = () => {
    if (hasDirtyFields || !notesSaved) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // ==================== Assign ====================
  const handleAssign = async (agentName) => {
    setAssigning(true);
    const toastId = toast.loading("Assigning ticket...");
    try {
      const updates = agentName ? { assigned_to: agentName } : { assigned_to: null };
      await client.records.update("tickets", ticket.id, updates);
      setTicket((prev) => ({ ...prev, ...updates }));
      await addAuditLog(ticket.id, "ticket.assigned", { assigned_to: agentName || "unassigned" }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success(agentName ? `Assigned to ${agentName}` : "Ticket unassigned");
      setShowAssign(false);
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to assign");
    } finally {
      setAssigning(false);
    }
  };

  // ==================== Delete ====================
  const handleDelete = async () => {
    setDeleting(true);
    const toastId = toast.loading("Deleting ticket...");
    try {
      await addAuditLog(ticket.id, "ticket.deleted", { title: ticket.title }, ticket.workspaceId, ticket.workspaceName);
      await client.records.delete("tickets", ticket.id);
      toast.dismiss(toastId);
      toast.success("Ticket deleted");
      setShowDeleteConfirm(false);
      emitRefresh();
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to delete");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // ==================== AI Actions ====================
  const handleAiAction = async (action) => {
    const labels = {
      summarize: "Summarizing ticket...",
      rootCause: "Analyzing root cause...",
      resolution: "Suggesting resolution...",
      sentiment: "Estimating sentiment...",
      churn: "Estimating churn risk...",
    };
    setAiState((prev) => ({ ...prev, action, loading: true, result: null }));
    const toastId = toast.loading(labels[action] || "Processing...");
    await new Promise((r) => setTimeout(r, 600));

    const body = ticket.body || "";
    const cat = ticket.category || "general";
    const sent = ticket.sentiment || "neutral";
    const tags = ticket.tags || [];
    const priority = ticket.priority || "normal";

    let result = "";
    if (action === "summarize") {
      const words = body.split(/\s+/).filter(Boolean);
      const sentences = body.split(/[.!?]+/).filter(Boolean);
      const shortSummary = sentences.length > 2
        ? sentences.slice(0, 2).join(". ") + "."
        : body || "No description provided.";
      const allText = (body + " " + (ticket.title || "")).toLowerCase();
      const intentPatterns = [
        { keywords: ["refund", "cancel", "unsubscribe", "chargeback", "return", "reimbursement"], label: "Requesting refund, cancellation, or financial remediation" },
        { keywords: ["error", "bug", "crash", "broken", "fail", "timeout", "exception", "500", "not loading"], label: "Reporting a technical issue or system bug" },
        { keywords: ["login", "password", "access", "permission", "account locked", "2fa", "mfa", "authentication"], label: "Account access or authentication issue" },
        { keywords: ["slow", "performance", "lag", "delay", "hang", "unresponsive"], label: "Performance degradation or slow response" },
        { keywords: ["billing", "invoice", "payment", "charge", "credit", "debit", "overcharge"], label: "Billing or payment discrepancy" },
        { keywords: ["how", "what is", "help with", "guide", "tutorial", "setup", "configure"], label: "How-to question or configuration assistance" },
      ];
      const matchedIntent = intentPatterns.find((p) => p.keywords.some((k) => allText.includes(k)));
      const intent = matchedIntent ? matchedIntent.label : "General inquiry or product feedback";
      const resolvedFromHistory = customerTickets.filter((t) => t.status === "resolved");
      const similarResolved = resolvedFromHistory.filter((t) => t.category === cat).length;
      const firstSeen = customerTickets.length > 0
        ? customerTickets.reduce((earliest, t) => !earliest || (t.created_at && t.created_at < earliest.created_at) ? t : earliest, null)
        : null;
      const timeTag = ticket.created_at ? format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a") : null;
      const escalationRec = priority === "urgent" || (customerTickets.length > 3 && similarResolved === 0)
        ? "Recommend escalation to senior support team due to urgent priority and unresolved history in this category."
        : customerTickets.length > 5
          ? "Customer has extensive history — consider account review to identify systemic issues."
          : "No escalation needed at this time.";
      result = [
        `**Summary**`,
        shortSummary,
        ``,
        `**Customer Intent**`,
        intent,
        ``,
        `**Issue Classification**`,
        `Category: ${cat} \u00B7 Priority: ${priority}${tags.length > 0 ? ` \u00B7 Tags: ${tags.join(", ")}` : ""}`,
        timeTag ? `Reported: ${timeTag}` : "",
        ``,
        `**Important Observations**`,
        `Customer has ${customerTickets.length} ticket(s) total, ${resolvedFromHistory.length} resolved.`,
        `${similarResolved} similar ${cat} case${similarResolved !== 1 ? "s" : ""} in history.`,
        firstSeen?.created_at ? `Customer active since ${format(new Date(firstSeen.created_at), "MMM yyyy")}.` : "First-time customer.",
        customerStats?.mostCommonCategory && customerStats.mostCommonCategory !== cat
          ? `Most common category for this customer is "${customerStats.mostCommonCategory}", not "${cat}" — this may represent a new issue type.`
          : null,
        ``,
        `**Escalation Recommendation**`,
        escalationRec,
      ].filter(Boolean).join("\n");
    } else if (action === "rootCause") {
      const bodyLower = body.toLowerCase();
      const causeClues = [];
      if (bodyLower.includes("csv") || bodyLower.includes("export") || bodyLower.includes("import") || bodyLower.includes("parse")) {
        causeClues.push("data serialization or format conversion pipeline");
      }
      if (bodyLower.includes("login") || bodyLower.includes("auth") || bodyLower.includes("token") || bodyLower.includes("session")) {
        causeClues.push("authentication token expiry or session management");
      }
      if (bodyLower.includes("api") || bodyLower.includes("timeout") || bodyLower.includes("gateway") || bodyLower.includes("503") || bodyLower.includes("500")) {
        causeClues.push("upstream API availability or gateway timeout");
      }
      if (bodyLower.includes("database") || bodyLower.includes("query") || bodyLower.includes("slow") || bodyLower.includes("index")) {
        causeClues.push("database query performance or missing index");
      }
      if (bodyLower.includes("memory") || bodyLower.includes("leak") || bodyLower.includes("oom") || bodyLower.includes("crash")) {
        causeClues.push("memory exhaustion or resource leak");
      }
      if (causeClues.length === 0) {
        const catCauses = {
          billing: "payment gateway integration or subscription state machine desynchronization",
          account: "identity provider configuration mismatch or credential rotation gap",
          technical: "service dependency chain failure under concurrent load",
          delivery: "message queue backpressure or delivery acknowledgment timeout",
          general: "unexpected edge case in request processing pipeline",
        };
        causeClues.push(catCauses[cat] || catCauses.general);
      }
      const similarCatCount = customerTickets.filter((t) => t.category === cat && t.id !== ticket.id).length;
      const similarResolved = customerTickets.filter((t) => t.category === cat && t.status === "resolved");
      const confidence = Math.min(65 + similarCatCount * 5, 95);
      const ageHours = ticket.created_at ? Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 3600000) : 0;
      const slaStatus = ticket.sla_due_at
        ? (new Date(ticket.sla_due_at) > new Date() ? `Within SLA (${Math.round((new Date(ticket.sla_due_at) - new Date()) / 3600000)}h remaining)` : "SLA breached")
        : "No SLA target configured";
      result = [
        `**Likely Root Cause**`,
        `The most probable cause is a ${causeClues.join(" or ")}.`,
        ``,
        `**Supporting Evidence**`,
        `- Category: ${cat} (${cat === "technical" || cat === "general" ? "consistent with infrastructure issues" : "customer-facing workflow disruption"})`,
        `- ${similarCatCount} previous ${cat} case${similarCatCount !== 1 ? "s" : ""} in this customer's history${similarResolved.length > 0 ? `, ${similarResolved.length} resolved` : ""}.`,
        `- Ticket has been open for ${ageHours}h with ${slaStatus}.`,
        tags.length > 0 ? `- Tags: ${tags.join(", ")} — ${tags.some((t) => ["urgent", "blocker", "p1", "p0"].includes(t.toLowerCase())) ? "indicates high-severity impact" : "provides additional context"}` : "",
        customerTickets.length > 2 ? `- Customer has ${customerTickets.length} total tickets, suggesting ${customerTickets.length > 5 ? "a systemic or recurring issue pattern" : "moderate engagement"}.` : "",
        ``,
        `**Confidence**`,
        `${confidence}% — based on category, historical patterns, and keyword analysis.`,
      ].filter(Boolean).join("\n");
    } else if (action === "resolution") {
      const sla = ticket.sla_due_at
        ? (new Date(ticket.sla_due_at) > new Date()
          ? `Within SLA — ${Math.round((new Date(ticket.sla_due_at) - new Date()) / 3600000)}h remaining`
          : `SLA breached by ${Math.round((new Date() - new Date(ticket.sla_due_at)) / 3600000)}h`)
        : "No SLA target configured for this ticket.";
      const avgResolveHours = customerStats?.avgResolutionHours
        ? `${customerStats.avgResolutionHours}h average across ${customerStats.resolvedCount} resolved ticket(s)`
        : "No resolved tickets in this customer's history to estimate resolution time.";
      const matchedSolutions = knownSolutions.length > 0
        ? `Found ${knownSolutions.length} knowledge article(s) matching this issue. Consider reviewing: ${knownSolutions.map((k) => k.title).join(", ")}.`
        : "No existing knowledge articles matched this ticket's content. Consider creating one after resolution.";
      const affectedSystems = cat === "technical" ? ["API Gateway", "Database Cluster", "Cache Layer"]
        : cat === "billing" ? ["Payment Processor", "Invoice Service", "Billing Database"]
        : cat === "account" ? ["Identity Provider", "User Directory", "Session Store"]
        : cat === "delivery" ? ["Message Queue", "Notification Service", "Delivery Tracker"]
        : ["Web Application", "API Layer", "Database"];
      result = [
        `**Suggested Resolution Steps**`,
        ``,
        `**Reproduce**`,
        `1. Review ticket description: "${(ticket.title || "").slice(0, 80)}${(ticket.title || "").length > 80 ? "..." : ""}"`,
        `2. Identify the affected workflow: ${cat}`,
        `3. Check if the issue is reproducible with the same inputs provided by the customer`,
        ``,
        `**Affected Services**`,
        affectedSystems.join(", "),
        ``,
        `**Probable Fix**`,
        `- Apply the standard ${cat} troubleshooting workflow`,
        `- Verify configuration integrity across ${affectedSystems[0]} and ${affectedSystems[1]}`,
        cat !== "general" ? `- Check for recent deployments or configuration changes in the ${cat} service` : "- Review application logs for error patterns around the reported timestamp",
        `- Validate data integrity for the affected customer record`,
        ``,
        `**Rollout Plan**`,
        `1. Apply fix to staging or canary environment first`,
        `2. Run existing test suite for ${cat} workflows`,
        `3. Deploy to production with monitoring`,
        `4. Verify fix with customer before closing ticket`,
        ``,
        `**Verification**`,
        `- Confirm the customer's reported scenario now works correctly`,
        `- Monitor error rates and latency for ${affectedSystems[0]} for 30 minutes post-deploy`,
        `- Update or create a knowledge article with the resolution details`,
        ``,
        `**Context**`,
        `Priority: ${priority} \u00B7 SLA: ${sla}`,
        `Customer history: ${customerTickets.length} previous tickets \u00B7 ${avgResolveHours}`,
        matchedSolutions,
      ].join("\n");
    } else if (action === "sentiment") {
      const negativeWordsList = body ? body.toLowerCase().split(/\s+/).filter((w) =>
        ["bad", "angry", "frustrated", "terrible", "awful", "disappointed", "cancel", "refund", "complaint", "horrible", "never", "worst", "unacceptable", "ridiculous", "useless", "scam", "outrageous", "pathetic", "fed up", "sick of"].includes(w)
      ).length : 0;
      const positiveWordsList = body ? body.toLowerCase().split(/\s+/).filter((w) =>
        ["good", "great", "thanks", "thank", "help", "please", "appreciate", "excellent", "amazing", "wonderful", "fantastic", "love", "best", "outstanding"].includes(w)
      ).length : 0;
      const urgencyWordsList = body ? body.toLowerCase().split(/\s+/).filter((w) =>
        ["urgent", "asap", "immediately", "emergency", "critical", "deadline", "blocking", "blocked", "stop", "halt"].includes(w)
      ).length : 0;
      const netScore = positiveWordsList - negativeWordsList;
      const score = Math.min(100, Math.max(0, 50 + netScore * 10));
      const baseConfidence = Math.min(75 + negativeWordsList * 3 + positiveWordsList * 2, 96);
      const level = score >= 65 ? "Positive" : score >= 35 ? "Neutral" : "Negative";
      const urgency = urgencyWordsList > 3 ? "Critical" : urgencyWordsList > 1 ? "High" : urgencyWordsList > 0 ? "Medium" : "Low";
      const escalationLikelihood = negativeWordsList > 3 && urgency === "Critical" ? "High"
        : negativeWordsList > 1 || urgency !== "Low" ? "Medium" : "Low";
      const toneLabels = {
        negative: ["Frustrated", "Disappointed", "Irritated", "Demanding", "Anxious"],
        neutral: ["Factual", "Inquisitive", "Descriptive", "Measured", "Neutral"],
        positive: ["Appreciative", "Patient", "Optimistic", "Collaborative", "Polite"],
      };
      const toneList = netScore < -1 ? toneLabels.negative : netScore > 1 ? toneLabels.positive : toneLabels.neutral;
      const tone = toneList[Math.abs(body.length) % toneList.length];
      const previousNegativeCount = customerTickets.filter((t) => t.sentiment === "angry" || t.sentiment === "frustrated").length;
      const reason = negativeWordsList > 0
        ? `Customer used ${negativeWordsList} negative word(s) in their description.`
        : positiveWordsList > 0
          ? `Customer used ${positiveWordsList} positive word(s), indicating a cooperative tone.`
          : "Customer communication is neutral and factual.";
      const urgencyReason = urgencyWordsList > 0
        ? `Urgency indicated by ${urgencyWordsList} urgency word(s) (${["urgent", "asap", "immediately", "emergency", "critical", "deadline", "blocking"].slice(0, urgencyWordsList).join(", ")}).`
        : "No explicit urgency markers detected.";
      result = [
        `**Customer Sentiment**`,
        `${tone}`,
        ``,
        `**Confidence**`,
        `${baseConfidence}%`,
        ``,
        `**Urgency**`,
        `${urgency}`,
        ``,
        `**Escalation Likelihood**`,
        `${escalationLikelihood}`,
        ``,
        `**Analysis**`,
        reason,
        urgencyReason,
        previousNegativeCount > 0 ? `Customer has ${previousNegativeCount} previous negative interaction(s) on record.` : "No prior negative interactions recorded for this customer.",
        ``,
        `**Recommended Action**`,
        level === "Negative" ? "Prioritize empathetic response and swift resolution. Consider assigning a senior agent due to elevated frustration and escalation risk."
        : level === "Neutral" ? "Acknowledge the issue clearly and set expectations for next steps."
        : "Maintain current engagement level. Ensure timely follow-through to preserve positive sentiment.",
      ].join("\n");
    } else if (action === "churn") {
      const risk = calculateChurnRisk(ticket, { customerTickets, incidents: linkedIncidents });
      if (risk && !risk.resolved) {
        const lines = [
          `**Churn Risk Score**`,
          `${risk.riskPercent}%`,
          ``,
          `**Risk Level**`,
          `${risk.riskLevel}`,
          ``,
          `**Breakdown**`,
        ];
        risk.breakdown.forEach((b) => {
          lines.push(`- ${b.evidence}`);
        });
        lines.push(``);
        lines.push(`**Contributing Factors**`);
        risk.factors.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).forEach((f) => {
          const sign = f.score > 0 ? "+" : "";
          lines.push(`- ${f.name}: ${sign}${f.score}`);
        });
        lines.push(``);
        lines.push(`**Recommended Actions**`);
        risk.recommendations.forEach((r, i) => {
          lines.push(`${i + 1}. ${r.action} (${r.priority}) \u2014 ${r.reason}`);
        });
        result = lines.join("\n");
      } else {
        const resolvedNote = ticket.status === "resolved" || ticket.status === "closed"
          ? "This ticket is already resolved — no churn risk assessment needed."
          : "No churn risk factors detected for this ticket.";
        result = `**Churn Risk Score**\n0%\n\n**Risk Level**\nNone\n\n${resolvedNote}`;
      }
    }

    setAiState((prev) => ({
      action,
      loading: false,
      result,
      history: prev.result ? [...prev.history, prev.result] : prev.history,
    }));
    toast.dismiss(toastId);
  };

  const regenerateAi = () => {
    const action = aiState.action;
    setAiState((prev) => ({
      action,
      loading: false,
      result: null,
      history: prev.result ? [...prev.history, prev.result] : prev.history,
    }));
    handleAiAction(action);
  };

  const verifyAnalysis = async () => {
    if (!aiState.action) {
      toast.info("Run an AI analysis first, then Verify to refresh it.");
      return;
    }
    toast.success("Analysis Updated");
    await new Promise((r) => setTimeout(r, 300));
    regenerateAi();
  };

  const copyAiResult = () => {
    if (aiState.result) {
      navigator.clipboard.writeText(aiState.result.replace(/\*\*/g, ""));
      toast.success("Copied to clipboard");
    }
  };

  // ==================== Link Incident ====================
  const handleLinkIncident = async (incident) => {
    setLinkingIncident(true);
    const toastId = toast.loading("Linking incident...");
    try {
      await client.records.create("ticket_incidents", {
        id: generateId(), ticket_id: ticket.id, incident_id: incident.id,
        linked_at: new Date().toISOString(),
      });
      await addAuditLog(ticket.id, "incident.linked", { incident_id: incident.id, incident_title: incident.title }, ticket.workspaceId, ticket.workspaceName);
      setShowIncidentSelector(false);
      toast.dismiss(toastId);
      toast.success(`Linked to incident: ${incident.title}`);
      setTicketKey((k) => k + 1);
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to link incident");
    } finally {
      setLinkingIncident(false);
    }
  };

  const handleUnlinkIncident = async (incidentId) => {
    const toastId = toast.loading("Removing link...");
    try {
      const existing = await client.records.list("ticket_incidents", {
        filters: { ticket_id: ticket.id, incident_id: incidentId }, limit: 1,
      });
      const items = existing.items || existing.data || [];
      if (items.length > 0) {
        await client.records.delete("ticket_incidents", items[0].id);
      }
      await addAuditLog(ticket.id, "incident.unlinked", { incident_id: incidentId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Incident unlinked");
      setTicketKey((k) => k + 1);
      emitRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to unlink incident");
    }
  };

  const handleCreateNewIncident = async () => {
    setLinkingIncident(true);
    const toastId = toast.loading("Creating incident...");
    try {
      let incId;
      if (ticket.signal_id) {
        const raw = await client.functions.run("link_incident", {
          input: {
            signal_id: ticket.signal_id,
            title: `Incident: ${ticket.title || "Related ticket"}`,
            summary: ticket.body || "",
            severity: ticket.priority || "high",
            description: `Linked from ticket ${ticket.number || ticket.id}: ${ticket.title}`,
            workspace_id: ticket.workspaceId,
            workspace_name: ticket.workspaceName,
          },
        });
        const output = raw.output_data || raw.output || raw;
        incId = output.incident_id;
      } else {
        const result = await client.records.create("incidents", {
          id: generateId(),
          title: `Incident: ${ticket.title || "Related ticket"}`,
          summary: ticket.body || "",
          status: "open",
          severity: ticket.priority || "high",
          description: `Linked from ticket ${ticket.number || ticket.id}: ${ticket.title}`,
          affected_ticket_count: 1,
          workspaceId: ticket.workspaceId,
          workspaceName: ticket.workspaceName,
        });
        incId = result.id || result;
      }
      const severity = ticket.priority || "high";
      if (severity === "urgent" || severity === "high") {
        runGmailAlert({
          id: incId, severity, title: ticket.title || "Related ticket",
          workspaceId: ticket.workspaceId,
          workspaceName: ticket.workspaceName,
          email_sent: false,
        });
      }
      if (severity === "urgent") {
        syncToLinear(incId);
      }
      await client.records.create("ticket_incidents", {
        id: generateId(), ticket_id: ticket.id, incident_id: incId,
        linked_at: new Date().toISOString(),
      });
      await addAuditLog(ticket.id, "incident.created", { incident_id: incId }, ticket.workspaceId, ticket.workspaceName);
      setShowIncidentSelector(false);
      toast.dismiss(toastId);
      toast.success("Incident created and linked");
      setTicketKey((k) => k + 1);
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to create incident");
    } finally {
      setLinkingIncident(false);
    }
  };

  // ==================== Create Signal ====================
  const handleCreateSignal = async (signalId) => {
    setShowCreateSignal(false);
    setTicket((prev) => ({ ...prev, signal_id: signalId }));
    setTicketKey((k) => k + 1);
  };

  const handleUnlinkSignal = async (signalId) => {
    const toastId = toast.loading("Removing signal link...");
    try {
      const existing = await client.records.list("ticket_signals", {
        filters: { ticket_id: ticket.id, signal_id: signalId }, limit: 1,
      });
      const items = existing.items || existing.data || [];
      if (items.length > 0) {
        await client.records.delete("ticket_signals", items[0].id);
      }
      await addAuditLog(ticket.id, "signal.unlinked", { signal_id: signalId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Signal unlinked");
      setTicketKey((k) => k + 1);
      emitRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to unlink signal");
    }
  };

  const handleLinkExistingSignal = async (selectedSignal) => {
    const toastId = toast.loading("Linking signal...");
    try {
      await client.records.create("ticket_signals", {
        id: generateId(), ticket_id: ticket.id, signal_id: selectedSignal.id,
        linked_at: new Date().toISOString(),
      });
      await addAuditLog(ticket.id, "signal.linked", { signal_id: selectedSignal.id, name: selectedSignal.name }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success(`Signal "${selectedSignal.name || selectedSignal.id}" linked`);
      setTicketKey((k) => k + 1);
      emitRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to link signal");
    }
  };

  // ==================== Customer History Click ====================
  const handleCustomerTicketClick = async (t) => {
    try {
      const updated = await client.records.get("tickets", t.id);
      setTicket(updated);
      setDirtyFields({});
      setAiState({ action: null, loading: false, result: null, history: [] });
      setDraftState({
        status: "idle",
        versions: [],
        currentVersion: 0,
        editorContent: "",
        error: null,
        draftId: null,
      });
      setUnsavedDraft(false);
      setTicketKey((k) => k + 1);
    } catch {
      toast.error("Failed to load ticket");
    }
  };

  // ==================== AI History Modal ====================
  const [showAiHistory, setShowAiHistory] = useState(false);

  // Customer stats
  const customerStats = useMemo(() => {
    if (customerTickets.length === 0) return null;
    const total = customerTickets.length;
    const resolved = customerTickets.filter((t) => t.status === "resolved");
    const open = customerTickets.filter((t) => t.status !== "resolved");
    const categories = {};
    customerTickets.forEach((t) => {
      if (t.category) categories[t.category] = (categories[t.category] || 0) + 1;
    });
    const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const mostCommonCategory = categoryEntries.length > 0 ? categoryEntries[0][0] : null;
    const totalResolved = resolved.length;
    const totalAgeHours = resolved.reduce((sum, t) => {
      if (t.created_at && t.updated_at) {
        return sum + (new Date(t.updated_at) - new Date(t.created_at)) / 3600000;
      }
      return sum;
    }, 0);
    const avgResolutionHours = totalResolved > 0 ? Math.round(totalAgeHours / totalResolved) : null;
    return { total, resolvedCount: resolved.length, openCount: open.length, mostCommonCategory, avgResolutionHours };
  }, [customerTickets]);

  const AI_STORAGE_PREFIX = "signaldesk-ai-";
  const loadAiResults = useCallback(() => {
    try {
      const saved = localStorage.getItem(AI_STORAGE_PREFIX + ticket.id);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  }, [ticket.id]);
  const saveAiResults = useCallback((state) => {
    try {
      localStorage.setItem(AI_STORAGE_PREFIX + ticket.id, JSON.stringify(state));
    } catch {}
  }, [ticket.id]);

  // Restore AI results from localStorage
  useEffect(() => {
    const saved = loadAiResults();
    if (saved) {
      setAiState(saved);
    }
  }, [loadAiResults]);

  // Persist AI results when they change
  const prevAiResultRef = useRef(aiState.result);
  useEffect(() => {
    if (aiState.result && aiState.result !== prevAiResultRef.current) {
      saveAiResults(aiState);
      prevAiResultRef.current = aiState.result;
    }
  }, [aiState, saveAiResults]);

  // Churn risk (with context)
  const churnRisk = useMemo(() => calculateChurnRisk(ticket, {
    customerTickets,
    incidents: linkedIncidents,
  }), [ticket, customerTickets, linkedIncidents]);
  const hasDirtyFields = Object.keys(dirtyFields).length > 0;

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleCloseDrawer}
      />

      {/* Drawer */}
      <motion.div
        ref={drawerRef}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="relative flex h-full w-full max-w-[560px] flex-col bg-white dark:bg-[#111113] border-l border-border dark:border-border-dark shadow-2xl"
      >
        {/* ===================== STICKY HEADER ===================== */}
        <div className="flex-shrink-0 border-b border-border dark:border-border-dark bg-white dark:bg-[#111113] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                  SD-{ticket.number || String(ticket.id).slice(-4).toUpperCase()}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {ticket.category && (
                  <span className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                    {ticket.category}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug truncate">
                {ticket.title || "Untitled Ticket"}
              </h2>
            </div>
            <button
              onClick={handleCloseDrawer}
              className="flex-shrink-0 rounded-lg p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#27272A] text-[7px] font-semibold text-zinc-600 dark:text-zinc-400">
                {avatarFor(ticket.id)}
              </span>
              <span className="truncate max-w-[120px]">{ticket.customer_name || ticket.customer_email || "Customer"}</span>
            </div>
            {ticket.created_at && (
              <span className="flex items-center gap-1"><Clock size={12} />{format(new Date(ticket.created_at), "MMM d, yyyy")}</span>
            )}
            {ticket.updated_at && (
              <span className="flex items-center gap-1">Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}</span>
            )}
            {ticket.assigned_to ? (
              <span className="flex items-center gap-1"><UserCheck size={12} />{ticket.assigned_to}</span>
            ) : (
              <span className="text-zinc-300 dark:text-zinc-600">Unassigned</span>
            )}
            {hasDirtyFields && <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-medium"><Clock size={12} /> Unsaved changes</span>}
          </div>
        </div>

        {/* ===================== SCROLLABLE CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* --- Section 1: Details --- */}
          <Section title="Details" icon={FileText}>
            <div className="space-y-3">
              <EditableField label="Subject" value={ticket.title} onSave={handleFieldSave} />
              <EditableField label="Description" value={ticket.body} onSave={handleFieldSave} multiline />
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="Priority" value={ticket.priority} onSave={handleFieldSave} options={PRIORITY_OPTIONS} />
                <EditableField label="Status" value={ticket.status} onSave={handleFieldSave} options={STATUS_OPTIONS} />
              </div>
              <EditableField label="Category" value={ticket.category} onSave={handleFieldSave} />
              {ticket.tags && Array.isArray(ticket.tags) && ticket.tags.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* --- Section 2: Customer --- */}
          <Section title="Customer" icon={User}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="Name" value={ticket.customer_name} onSave={handleFieldSave} />
                <EditableField label="Email" value={ticket.customer_email} onSave={handleFieldSave} />
              </div>
              {ticket.customer_email && (
                <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-3">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Contact</p>
                  <a href={`mailto:${ticket.customer_email}`} className="text-sm font-medium text-accent hover:underline">
                    {ticket.customer_email}
                  </a>
                </div>
              )}

              {/* Churn Risk inline */}
              {churnRisk && !churnRisk.resolved && (
                <div className={`rounded-lg border p-3 ${churnRisk.riskLevel === "Critical" ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20" : churnRisk.riskLevel === "High" ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20" : "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className={churnRisk.riskLevel === "Critical" ? "text-red-600 dark:text-red-400" : churnRisk.riskLevel === "High" ? "text-orange-600 dark:text-orange-400" : "text-yellow-600 dark:text-yellow-400"} />
                      <span className={`text-xs font-semibold ${churnRisk.riskLevel === "Critical" ? "text-red-700 dark:text-red-400" : churnRisk.riskLevel === "High" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                        {churnRisk.riskLevel} Churn Risk
                      </span>
                    </div>
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{churnRisk.riskPercent}%</span>
                  </div>
                </div>
              )}

              {/* Customer History */}
              {customerTickets.length > 0 && customerStats && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">History</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{customerStats.total}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Total</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{customerStats.resolvedCount}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Resolved</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{customerStats.openCount}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Open</p>
                    </div>
                  </div>
                  {customerStats.avgResolutionHours != null && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">Avg resolution: {customerStats.avgResolutionHours}h {customerStats.mostCommonCategory ? `\u00B7 Common: ${customerStats.mostCommonCategory}` : ""}</p>
                  )}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {customerTickets.slice(0, 10).map((t) => (
                      <div key={t.id} onClick={() => handleCustomerTicketClick(t)}
                        className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-[#27272A] cursor-pointer transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-900 dark:text-zinc-50 truncate">{t.title || t.customer_name || t.id}</p>
                        </div>
                        <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                          <PriorityBadge priority={t.priority} />
                          <StatusBadge status={t.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {customerTickets.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">No previous tickets from this customer.</p>
              )}
            </div>
          </Section>

          {/* --- Section 3: Timeline --- */}
          <Section title="Timeline" icon={Clock}>
            {loadingLogs ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-zinc-400 dark:text-zinc-500" /></div>
            ) : (
              <div className="space-y-0">
                {/* Always show ticket creation as the first event */}
                {ticket.created_at && (
                  <div className="flex gap-3 pb-4 relative">
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-[#2A2A2E]" />
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/30 flex-shrink-0 text-blue-500">
                      <FileText size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">Ticket Created</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">by {ticket.customer_name || ticket.customer_email || "System"}</p>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                  </div>
                )}
                {logs.length === 0 ? (
                  <div className="flex gap-3 pb-4">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#202024] flex-shrink-0 text-zinc-400">
                      <Clock size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Awaiting activity</p>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">No further events recorded yet.</span>
                    </div>
                  </div>
                ) : (
                  logs.map((log, idx) => {
                    const aMeta = getActionMeta(log.action);
                    const Icon = aMeta.icon;
                    const color = aMeta.color;
                    const isLast = idx === logs.length - 1;
                    return (
                      <div key={log.id || idx} className="flex gap-3 pb-4 last:pb-0 relative">
                        {!isLast && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-[#2A2A2E]" />
                        )}
                        <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#202024] flex-shrink-0 ${color}`}>
                          <Icon size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900 dark:text-zinc-50 capitalize">{log.action?.replace(/\./g, " ") || log.event || "Event"}</p>
                          {log.details?.name && <p className="text-xs text-zinc-500 dark:text-zinc-400">{log.details.name}</p>}
                          {log.action === "ticket.assigned" && log.details?.assigned_to && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Assigned to {log.details.assigned_to}</p>
                          )}
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a") : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Section>

          {/* --- Section 4: AI Assistant --- */}
          <Section title="AI Assistant" icon={Brain} defaultOpen={!!aiState.result}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleAiAction("summarize")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <FileText size={13} /> Summarize
                </button>
                <button onClick={() => handleAiAction("rootCause")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <Target size={13} /> Root Cause
                </button>
                <button onClick={() => handleAiAction("resolution")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <Lightbulb size={13} /> Resolution
                </button>
                <button onClick={() => handleAiAction("sentiment")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <ThumbsUp size={13} /> Sentiment
                </button>
                <button onClick={() => handleAiAction("churn")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <BarChart3 size={13} /> Churn Risk
                </button>
                <button onClick={verifyAnalysis} disabled={aiState.loading || !aiState.action}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors disabled:opacity-50">
                  <RefreshCw size={13} /> Verify
                </button>
              </div>

              {aiState.loading && (
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] p-3">
                  <Loader2 size={14} className="animate-spin text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Processing...</span>
                </div>
              )}

              {aiState.result && (
                <div className="rounded-lg border border-border dark:border-border-dark bg-zinc-50 dark:bg-[#202024] p-3">
                  <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {aiState.result}
                  </pre>
                  <div className="mt-2 flex items-center gap-2 pt-2 border-t border-border dark:border-border-dark">
                    <button onClick={copyAiResult} className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-50 transition-colors">
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={regenerateAi}
                      className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-50 transition-colors ml-auto">
                      <RotateCcw size={12} /> Regenerate
                    </button>
                  </div>
                  {aiState.history.length > 0 && (
                    <button onClick={() => setShowAiHistory(true)}
                      className="mt-2 flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
                      <History size={11} /> Previous versions ({aiState.history.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* --- Section 5: AI Response Copilot --- */}
          <Section title="AI Response Copilot" icon={MessageSquare}>
            <DraftCopilotPanel
              ticket={ticket}
              workspace={workspace}
              permissions={{
                canGenerate: canGenerateDrafts,
                canApprove: canApproveDrafts,
                canReject: canRejectDrafts,
                canSend: canSendReplies,
                canEdit: canEditDrafts,
              }}
              onRefresh={onRefresh}
            />
          </Section>

          {/* --- Section 6: Linked Signal --- */}
          <Section title={`Linked Signal${linkedSignals.length !== 1 ? "s" : ""} (${linkedSignals.length})`} icon={Radio}>
            {linkedSignals.length > 0 ? (
              <div className="space-y-2">
                {linkedSignals.map((sig) => (
                  <div key={sig.id} className="rounded-lg border border-border dark:border-border-dark p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{sig.name || "Signal"}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{sig.id.slice(0, 8)}...</p>
                      </div>
                      <button onClick={() => handleUnlinkSignal(sig.id)}
                        className="flex-shrink-0 rounded p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={sig.status} />
                      <PriorityBadge priority={sig.proposed_priority || sig.severity} />
                      {sig.analysis_confidence != null && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Confidence: {sig.analysis_confidence}%</span>
                      )}
                    </div>
                    {sig.summary && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{sig.summary}</p>}
                    <div className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                      {sig.created_at && <span>Created {format(new Date(sig.created_at), "MMM d, yyyy")}</span>}
                      {sig.detected_at && <span> \u00B7 Detected {format(new Date(sig.detected_at), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowCreateSignal(true)}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[10px] font-medium text-white hover:opacity-90 transition-opacity">
                    <Plus size={10} /> Create Signal
                  </button>
                  <button onClick={() => setShowLinkSignalDialog(true)}
                    className="flex items-center gap-1 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <Radio size={10} /> Link Existing
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <Radio size={20} className="text-zinc-300 dark:text-zinc-600" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No signals linked to this ticket</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateSignal(true)}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                    <Plus size={12} /> Create Signal
                  </button>
                  <button onClick={() => setShowLinkSignalDialog(true)}
                    className="flex items-center gap-1 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <Radio size={12} /> Link Existing
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* --- Section 7: Known Solutions --- */}
          <Section title={`Known Solutions (${knownSolutions.length})`} icon={BookOpen} defaultOpen={knownSolutions.length > 0}>
            {knownSolutions.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">No matching knowledge found.</p>
            ) : (
              <div className="space-y-2">
                {knownSolutions.map((k) => (
                  <div key={k.id} onClick={() => setSelectedKnowledge(k)}
                    className="rounded-lg border border-border dark:border-border-dark p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb size={13} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{k.title || "Knowledge"}</p>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{k.summary || k.resolution || ""}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {k.confidence != null && <ConfidenceBadge value={k.confidence} />}
                      {k.root_cause && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Root cause documented</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* --- Section 8: Linked Incident --- */}
          <Section title={`Linked Incident${linkedIncidents.length !== 1 ? "s" : ""} (${linkedIncidents.length})`} icon={ShieldAlert}>
            {linkedIncidents.length > 0 ? (
              <div className="space-y-2">
                {linkedIncidents.map((inc) => (
                  <div key={inc.id} className="rounded-lg border border-border dark:border-border-dark p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{inc.title || "Incident"}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{inc.id.slice(0, 8)}...</p>
                      </div>
                      <button onClick={() => handleUnlinkIncident(inc.id)}
                        className="flex-shrink-0 rounded p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={inc.status} />
                      <PriorityBadge priority={inc.severity} />
                      {inc.owner_user_id && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Owner: {inc.owner_user_id}</span>}
                    </div>
                    {inc.summary && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{inc.summary}</p>}
                    {inc.affected_ticket_count != null && (
                      <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{inc.affected_ticket_count} linked ticket(s)</p>
                    )}
                    {inc.opened_at && (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Opened {format(new Date(inc.opened_at), "MMM d, yyyy")}</p>
                    )}
                  </div>
                ))}
                <button onClick={() => setShowIncidentSelector(true)}
                  className="flex items-center gap-1 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors mt-1">
                  <Plus size={10} /> Link Incident
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <ShieldAlert size={20} className="text-zinc-300 dark:text-zinc-600" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No incidents linked to this ticket</p>
                <button onClick={() => setShowIncidentSelector(true)}
                  className="flex items-center gap-1 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                  <Plus size={12} /> Link Incident
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* ===================== STICKY FOOTER ===================== */}
        <div className="flex-shrink-0 border-t border-border dark:border-border-dark bg-white dark:bg-[#111113] px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {/* Save - available to all when dirty */}
            <button onClick={handleSave} disabled={saving || !hasDirtyFields}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>

            {/* Resolve - manager only */}
            {canResolveTicket ? (
              <button onClick={handleResolve} disabled={resolving || ticket.status === "resolved"}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                title="Resolve ticket">
                {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Resolve
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <CheckCircle2 size={14} /> Resolve
              </button>
            )}

            {/* Close drawer - available to all */}
            <button onClick={handleCloseDrawer}
              className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
              <XCircle size={14} /> Close
            </button>

            {/* Assign - manager only */}
            {canAssignTicket ? (
              <button onClick={() => setShowAssign(true)} disabled={assigning}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50"
                title="Assign ticket to an agent">
                {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                Assign
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <UserCheck size={14} /> Assign
              </button>
            )}

            {/* Delete - manager only */}
            {canDeleteTicket ? (
              <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                title="Delete ticket">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <Trash2 size={14} /> Delete
              </button>
            )}



            {/* Link Incident - available to all with permission */}
            {canLinkIncident ? (
              <button onClick={() => setShowIncidentSelector(true)} disabled={linkingIncident}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50"
                title="Link an existing incident">
                <ShieldAlert size={14} /> Link Incident
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <ShieldAlert size={14} /> Link Incident
              </button>
            )}

            {/* Create Signal - gated by canCreateSignal */}
            {canCreateSignal ? (
              <button onClick={() => setShowCreateSignal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors"
                title="Create a new signal from this ticket">
                <Radio size={14} /> Create Signal
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-4 py-2 text-xs font-medium text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <Radio size={14} /> Create Signal
              </button>
            )}
          </div>
          {isManager && (
            <p className="mt-2 text-[10px] text-emerald-500 dark:text-emerald-400">Support Manager \u2014 full access</p>
          )}
          {!isManager && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">ESC to close \u00B7 Ctrl+S to save \u00B7 Some actions require Support Manager permissions</p>
          )}
        </div>
      </motion.div>

      {/* ===================== MODALS ===================== */}
      <AssignDialog
        open={showAssign}
        currentAssignee={ticket.assigned_to}
        onAssign={handleAssign}
        onCancel={() => setShowAssign(false)}
      />
      <SignalSelectorDialog
        open={showLinkSignalDialog}
        onLink={handleLinkExistingSignal}
        onCancel={() => setShowLinkSignalDialog(false)}
        workspaceId={workspace.id}
      />
      <IncidentSelectorDialog
        open={showIncidentSelector}
        onLink={handleLinkIncident}
        onCreateNew={handleCreateNewIncident}
        onCancel={() => setShowIncidentSelector(false)}
        workspaceId={workspace.id}
      />
      <CreateSignalDialog
        open={showCreateSignal}
        ticket={ticket}
        onCreate={handleCreateSignal}
        onCancel={() => setShowCreateSignal(false)}
      />
      <ConfirmDialog
        open={showCloseConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
        confirmLabel="Discard Changes"
        destructive
        onConfirm={() => { setShowCloseConfirm(false); onClose(); }}
        onCancel={() => setShowCloseConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Ticket"
        message={`Are you sure you want to delete "${ticket.title || ticket.id}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* AI History Modal */}
      {showAiHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAiHistory(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg max-h-[70vh] rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark shadow-modal overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border dark:border-border-dark">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Previous AI Versions ({aiState.history.length})</h3>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 max-h-[55vh]">
              {aiState.history.map((h, i) => (
                <div key={i} className="rounded-lg border border-border dark:border-border-dark bg-zinc-50 dark:bg-[#202024] p-3">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Version {i + 1}</p>
                  <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">{h}</pre>
                </div>
              ))}
            </div>
            <div className="p-5 pt-3 flex justify-end">
              <button onClick={() => setShowAiHistory(false)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {selectedKnowledge && (
          <KnowledgeDrawer entry={selectedKnowledge} onClose={() => setSelectedKnowledge(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
