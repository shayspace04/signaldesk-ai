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
import { calculateChurnRisk } from "@/lib/churnRisk";
import useRole from "@/hooks/useRole";
import { useWorkspace } from "@/context/WorkspaceContext";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { workspaceFilter } from "@/lib/workspaceConfig";
import KnowledgeDrawer from "@/components/knowledge/KnowledgeDrawer";

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
  "ticket.resolved": { icon: CheckCircle2, color: "text-emerald-500" },
  "ticket.escalated": { icon: AlertTriangle, color: "text-orange-500" },
  "ticket.assigned": { icon: UserCheck, color: "text-violet-500" },
  "ticket.priority_changed": { icon: BarChart3, color: "text-amber-500" },
  "ticket.status_changed": { icon: RefreshCw, color: "text-blue-500" },
  "draft.generated": { icon: Brain, color: "text-violet-500" },
  "draft.approved": { icon: CheckCircle2, color: "text-emerald-500" },
  "draft.rejected": { icon: XCircle, color: "text-red-500" },
  "draft.pending_approval": { icon: Clock, color: "text-amber-500" },
  "signal.detected": { icon: Radio, color: "text-green-500" },
  "signal.created": { icon: Radio, color: "text-green-500" },
  "incident.created": { icon: ShieldAlert, color: "text-red-500" },
  "incident.linked": { icon: ShieldAlert, color: "text-red-500" },
  "manager.notification_created": { icon: Bell, color: "text-cyan-500" },
  "email.sent": { icon: Mail, color: "text-emerald-500" },
  "triage.completed": { icon: Brain, color: "text-purple-500" },
};

function getActionMeta(action) {
  return ACTION_ICONS[action] || { icon: Clock, color: "text-zinc-400" };
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
        <p className="text-xs text-zinc-400 dark:text-[#71717A] mb-0.5">{label}</p>
        <p className="text-sm text-zinc-900 dark:text-[#FAFAFA] group-hover:text-accent transition-colors">{value || "-"}</p>
      </div>
    );
  }

  if (multiline) {
    return (
      <div>
        <p className="text-xs text-zinc-400 dark:text-[#71717A] mb-1">{label}</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={4}
          className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 dark:text-[#71717A] mb-1">{label}</p>
      {options ? (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
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
          className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-2.5 py-1.5 text-sm text-zinc-900 dark:[#FAFAFA]- [dark:focus:ring-zinc-600] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
          autoFocus
        />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-[#202024] transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-zinc-500 dark:text-[#A1A1AA]" />}
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">{title}</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
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
        className="w-full max-w-sm rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">{title}</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-[#A1A1AA]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel}
            className="rounded-xl border border-border dark:border-[#2A2A2E] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
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
        className="w-full max-w-sm rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">Assign Ticket</h3>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-0.5">
          <button
            onClick={() => onAssign(null)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A] ${!currentAssignee ? "bg-zinc-50 dark:bg-[#27272A]" : ""}`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#202024] text-xs font-semibold text-zinc-500 dark:text-[#A1A1AA]">
              <User size={14} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Unassigned</p>
              <p className="text-xs text-zinc-400 dark:text-[#71717A]">Remove current assignee</p>
            </div>
            {!currentAssignee && <Check size={16} className="text-accent" />}
          </button>
          {filtered.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onAssign(agent.name)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A] ${currentAssignee === agent.name ? "bg-zinc-50 dark:bg-[#27272A]" : ""}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#202024] text-xs font-semibold text-zinc-600 dark:text-[#A1A1AA]">
                {agent.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{agent.name}</p>
                <p className="text-xs text-zinc-400 dark:text-[#71717A] capitalize">{agent.role.replace("_", " ")}</p>
              </div>
              {currentAssignee === agent.name && <Check size={16} className="text-accent" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 dark:text-[#71717A] text-center py-4">No agents found</p>
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
        className="w-full max-w-md rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">Link Incident</h3>
            <button onClick={onCreateNew}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
              <Plus size={12} /> New
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-zinc-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-[#71717A] text-center py-6">No incidents found</p>
          ) : (
            filtered.map((inc) => (
              <button key={inc.id} onClick={() => onLink(inc)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{inc.title || inc.id}</p>
                  <p className="text-xs text-zinc-400 dark:text-[#71717A]">
                    <PriorityBadge priority={inc.severity} /> <StatusBadge status={inc.status} />
                  </p>
                </div>
                <ExternalLink size={14} className="text-zinc-300 dark:text-[#71717A] flex-shrink-0 ml-2" />
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
      // Keep backward compat: update signal_id on ticket
      await client.records.update("tickets", ticket.id, { signal_id: signalId });
      // Create junction entry for multi-signal support
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
        className="w-full max-w-md rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">Create Signal</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-[#A1A1AA]">Title</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-[#A1A1AA]">Description</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-[#A1A1AA]">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-[#A1A1AA]">Customer Impact</label>
              <select value={impact} onChange={(e) => setImpact(e.target.value)}
                className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none">
                <option value="">Select...</option>
                <option value="single">Single Customer</option>
                <option value="multiple">Multiple Customers</option>
                <option value="all">All Customers</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-[#A1A1AA]">Evidence</label>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2}
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-none" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel}
            className="rounded-xl border border-border dark:border-[#2A2A2E] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
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
        className="w-full max-w-md rounded-2xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">Link Existing Signal</h3>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signals..."
              className="w-full rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-zinc-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-[#71717A] text-center py-6">No signals found</p>
          ) : (
            filtered.map((sig) => (
              <button key={sig.id} onClick={() => onLink(sig)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{sig.name || sig.id}</p>
                  <p className="text-xs text-zinc-400 dark:text-[#71717A]">
                    <StatusBadge status={sig.status} /> <PriorityBadge priority={sig.proposed_priority} />
                  </p>
                </div>
                <ExternalLink size={14} className="text-zinc-300 dark:text-[#71717A] flex-shrink-0 ml-2" />
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
  const [draftState, setDraftState] = useState({
    status: "idle",
    versions: [],
    currentVersion: 0,
    editorContent: "",
    error: null,
    draftId: null,
  });
  const [unsavedDraft, setUnsavedDraft] = useState(false);
  const draftAutosaveRef = useRef(null);
  const [aiState, setAiState] = useState({ action: null, loading: false, result: null, history: [] });
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      if (e.key === "Escape" && !showAssign && !showIncidentSelector && !showCreateSignal && !showDeleteConfirm) {
        onClose();
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
    onClose();
  };

  // ==================== Assign ====================
  const handleAssign = async (agentName) => {
    setAssigning(true);
    const toastId = toast.loading("Assigning ticket...");
    try {
      const updates = agentName ? { assignee: agentName } : { assignee: null };
      await client.records.update("tickets", ticket.id, updates);
      setTicket((prev) => ({ ...prev, ...updates }));
      await addAuditLog(ticket.id, "ticket.assigned", { assignee: agentName || "unassigned" }, ticket.workspaceId, ticket.workspaceName);
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

  // ==================== Draft ====================

  const updateDraftState = (patch) => setDraftState((prev) => ({ ...prev, ...patch }));

  const handleGenerateDraft = async () => {
    if (draftState.status === "generating") return;
    updateDraftState({ status: "generating", error: null });
    const toastId = toast.loading("Generating AI draft reply...");
    try {
      const res = await client.functions.run("generate_draft_reply", {
        input: { ticket_id: ticket.id },
      });
      const body = res?.output_data?.body || res?.body || (
        `Dear ${ticket.customer_name || "Customer"},\n\nThank you for reaching out. I've reviewed your request regarding "${ticket.title}". Our team is investigating and will follow up shortly.\n\nBest regards,\nSupport Team`
      );
      const draftId = res?.output_data?.draft_id || res?.draft_id;
      const now = new Date().toISOString();
      const newVersion = { body, version: 1, created_at: now, status: "pending" };
      updateDraftState({
        status: "editing",
        versions: [newVersion],
        currentVersion: 0,
        editorContent: body,
        draftId: draftId || null,
      });
      setUnsavedDraft(true);
      await addAuditLog(ticket.id, "draft.generated", { draft_id: draftId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Draft reply generated");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg = err?.message || "Request timed out";
      updateDraftState({
        status: "error",
        error: msg.includes("timed out") ? "Draft generation timed out. The function may not be deployed. Try again." : msg,
      });
      toast.dismiss(toastId);
      toast.error(msg);
    }
  };

  const handleSaveDraft = async () => {
    if (draftState.status !== "editing" && draftState.status !== "error") return;
    if (!draftState.editorContent.trim()) {
      toast.info("Draft content is empty");
      return;
    }
    updateDraftState({ status: "saving" });
    const toastId = toast.loading("Saving draft...");
    try {
      const body = draftState.editorContent;
      if (draftState.draftId) {
        await client.records.update("drafts", draftState.draftId, { body });
      } else {
        const result = await client.records.create("drafts", {
          id: crypto.randomUUID(),
          ticket_id: ticket.id,
          body,
          status: "pending",
          confidence: 85,
        });
        updateDraftState({ draftId: result.id || result });
      }
      const versions = [...draftState.versions];
      if (versions[draftState.currentVersion]) {
        versions[draftState.currentVersion] = { ...versions[draftState.currentVersion], body };
      }
      updateDraftState({ versions, status: "editing" });
      setUnsavedDraft(false);
      await addAuditLog(ticket.id, "draft.saved", {}, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Draft saved");
      emitRefresh();
    } catch (err) {
      updateDraftState({ status: "editing" });
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to save draft");
    }
  };

  const handleRequestApproval = async () => {
    if (draftState.status !== "editing") return;
    const toastId = toast.loading("Submitting for approval...");
    try {
      await handleSaveDraft();
      updateDraftState({ status: "pending_approval" });
      await addAuditLog(ticket.id, "draft.pending_approval", {}, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Draft submitted for manager approval");
      emitRefresh();
    } catch {
      toast.dismiss(toastId);
      toast.error("Failed to submit for approval");
      updateDraftState({ status: "editing" });
    }
  };

  const handleApproveDraft = async () => {
    if (draftState.status !== "pending_approval" && draftState.status !== "editing") return;
    updateDraftState({ status: "saving" });
    const toastId = toast.loading("Approving draft...");
    try {
      await client.functions.run("resolve_ticket", { input: { ticket_id: ticket.id, draft_id: draftState.draftId } });
      updateDraftState({ status: "approved" });
      await addAuditLog(ticket.id, "draft.approved", { draft_id: draftState.draftId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Draft approved by manager");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      updateDraftState({ status: "pending_approval" });
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to approve draft");
    }
  };

  const handleRejectDraft = async () => {
    if (draftState.status !== "pending_approval" && draftState.status !== "editing") return;
    updateDraftState({ status: "saving" });
    const toastId = toast.loading("Rejecting draft...");
    try {
      await client.functions.run("reject_draft", { input: { ticket_id: ticket.id, draft_id: draftState.draftId } });
      updateDraftState({ status: "rejected" });
      await addAuditLog(ticket.id, "draft.rejected", { draft_id: draftState.draftId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Draft rejected");
      emitRefresh();
    } catch (err) {
      updateDraftState({ status: "pending_approval" });
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to reject draft");
    }
  };

  const handleSendReply = async () => {
    if (draftState.status !== "approved") return;
    updateDraftState({ status: "sending" });
    const toastId = toast.loading("Sending reply...");
    try {
      await client.functions.run("send_approved_reply", {
        input: { draft_id: draftState.draftId, ticket_id: ticket.id, channel: "email" },
      });
      updateDraftState({
        status: "sent",
        versions: draftState.versions.map((v) => (v.status === "pending" || v.status === "approved" ? { ...v, status: "sent" } : v)),
      });
      setUnsavedDraft(false);
      await addAuditLog(ticket.id, "email.sent", { draft_id: draftState.draftId }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success("Reply sent to customer");
      emitRefresh();
      if (onRefresh) onRefresh();
    } catch (err) {
      updateDraftState({ status: "approved" });
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to send reply");
    }
  };

  const handleRegenerateDraft = async () => {
    if (draftState.status === "generating") return;
    const currentBody = draftState.editorContent;
    updateDraftState({ status: "generating", error: null });
    const toastId = toast.loading("Regenerating draft reply...");
    try {
      const res = await client.functions.run("generate_draft_reply", {
        input: { ticket_id: ticket.id },
      });
      const body = res?.output_data?.body || res?.body || currentBody;
      const draftId = res?.output_data?.draft_id || res?.draft_id;
      const newVersion = { body, version: draftState.versions.length + 1, created_at: new Date().toISOString(), status: "pending" };
      updateDraftState({
        status: "editing",
        versions: [...draftState.versions, newVersion],
        currentVersion: draftState.versions.length,
        editorContent: body,
        draftId: draftId || draftState.draftId,
      });
      setUnsavedDraft(true);
      await addAuditLog(ticket.id, "draft.generated", { draft_id: draftId, regeneration: true }, ticket.workspaceId, ticket.workspaceName);
      toast.dismiss(toastId);
      toast.success(`Version ${newVersion.version} generated`);
      emitRefresh();
    } catch (err) {
      const msg = err?.message || "Request timed out";
      updateDraftState({ status: "editing", error: msg, editorContent: currentBody });
      toast.dismiss(toastId);
      toast.error(msg);
    }
  };

  const handleCopyDraft = () => {
    if (!draftState.editorContent) return;
    navigator.clipboard.writeText(draftState.editorContent);
    toast.success("Draft copied to clipboard");
  };

  const switchDraftVersion = (index) => {
    if (index < 0 || index >= draftState.versions.length) return;
    const v = draftState.versions[index];
    setUnsavedDraft(true);
    updateDraftState({ currentVersion: index, editorContent: v.body });
  };

  const handleDraftEditorChange = (text) => {
    setUnsavedDraft(true);
    updateDraftState({ editorContent: text });
    clearTimeout(draftAutosaveRef.current);
    draftAutosaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`signaldesk-draft-${ticket.id}`, text);
      } catch {}
    }, 2000);
  };

  // Unsaved changes warning
  useEffect(() => {
    if (!unsavedDraft) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedDraft]);

  // Restore autosaved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`signaldesk-draft-${ticket.id}`);
      if (saved && draftState.status === "idle") {
        updateDraftState({
          status: "editing",
          editorContent: saved,
          versions: [{ body: saved, version: 1, created_at: new Date().toISOString(), status: "pending" }],
          currentVersion: 0,
        });
        setUnsavedDraft(true);
      }
    } catch {}
  }, [ticket.id]);

  const canRequestApproval = draftState.status === "editing" && draftState.editorContent.trim().length > 0 && canGenerateDrafts;
  const canApproveDraftAction = (draftState.status === "pending_approval" || draftState.status === "editing") && canApproveDrafts;
  const canRejectDraftAction = (draftState.status === "pending_approval" || draftState.status === "editing") && canRejectDrafts;
  const canSendDraft = draftState.status === "approved" && canSendReplies;

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
    await new Promise((r) => setTimeout(r, 800));

    const body = ticket.body || "";
    const cat = ticket.category || "general";
    const sent = ticket.sentiment || "calm";

    let result = "";
    if (action === "summarize") {
      const words = body.split(/\s+/).filter(Boolean);
      const short = words.length > 40 ? body.split(".").slice(0, 3).join(".") + "." : body || "No content.";
      const intent = words.some((w) => ["refund", "cancel", "return"].includes(w.toLowerCase())) ? "Requesting refund/cancellation" : words.some((w) => ["help", "issue", "problem", "broken", "error"].includes(w.toLowerCase())) ? "Requesting technical support" : "General inquiry";
      const resolvedFromHistory = customerTickets.filter((t) => t.status === "resolved");
      const similarResolved = resolvedFromHistory.filter((t) => t.category === cat).length;
      result = [
        `**Summary:** ${short}`,
        `**Key Issue:** ${cat} — ${ticket.priority} priority`,
        `**Customer Intent:** ${intent}`,
        `**Context:** ${customerTickets.length} previous ticket(s) from this customer · ${similarResolved} similar ${cat} tickets resolved previously`,
        `**Sentiment:** ${sent}`,
      ].join("\n");
    } else if (action === "rootCause") {
      const causes = {
        billing: "Billing configuration error or payment processing failure",
        account: "Account permission misconfiguration or expired credentials",
        technical: "System integration error or API timeout",
        delivery: "Delivery routing failure or address validation error",
        general: "Unexpected system behavior under standard load conditions",
      };
      const similarCatCount = customerTickets.filter((t) => t.category === cat && t.id !== ticket.id).length;
      const similarResolved = customerTickets.filter((t) => t.category === cat && t.status === "resolved");
      const confidence = Math.min(65 + similarCatCount * 5, 92);
      result = [
        `**Likely Root Cause:** ${causes[cat] || causes.general}`,
        `**Supporting Evidence:** ${similarCatCount} similar ${cat} case(s) in this customer's history. ${similarResolved.length > 0 ? `${similarResolved.length} previously resolved.` : "No prior resolved cases of this type."}`,
        `**Ticket Context:** ${ticket.priority} priority · ${sent} sentiment · ${customerTickets.length} total customer tickets`,
        `**Confidence:** ${confidence}%`,
      ].join("\n");
    } else if (action === "resolution") {
      const sla = ticket.sla_due_at ? (new Date(ticket.sla_due_at) > new Date() ? "Within SLA" : "SLA breached") : "No SLA set";
      const avgResolveHours = customerStats?.avgResolutionHours ? `${customerStats.avgResolutionHours}h avg` : "Unknown";
      result = [
        `**Suggested Resolution:**`,
        `1. Verify customer account and recent transaction history`,
        `2. Check for related system alerts or known outages`,
        `3. Apply standard ${cat} troubleshooting workflow`,
        `4. Escalate to ${cat === "technical" ? "engineering" : "specialist"} team if unresolved`,
        ``,
        `**Ticket Context:** ${ticket.priority} priority · SLA: ${sla} · Sentiment: ${sent}`,
        `**Customer History:** ${customerTickets.length} previous tickets · Avg resolution: ${avgResolveHours}`,
        `**Confidence:** 78%`,
      ].join("\n");
    } else if (action === "sentiment") {
      const negativeWordsList = body ? body.toLowerCase().split(/\s+/).filter((w) =>
        ["bad", "angry", "frustrated", "terrible", "awful", "disappointed", "cancel", "refund", "complaint", "horrible", "never", "worst", "unacceptable", "ridiculous"].includes(w)
      ).length : 0;
      const positiveWordsList = body ? body.toLowerCase().split(/\s+/).filter((w) =>
        ["good", "great", "thanks", "thank", "help", "please", "appreciate", "excellent"].includes(w)
      ).length : 0;
      const score = Math.min(100, Math.max(0, 50 + (positiveWordsList - negativeWordsList) * 10));
      const level = score >= 70 ? "Positive" : score >= 40 ? "Neutral" : "Negative";
      const previousNegativeCount = customerTickets.filter((t) => t.sentiment === "angry" || t.sentiment === "frustrated").length;
      result = [
        `**Customer Sentiment:** ${level}`,
        `**Sentiment Score:** ${score}/100`,
        `**Confidence:** 85%`,
        ``,
        `**Indicators:** ${negativeWordsList > 0 ? `${negativeWordsList} negative word(s) detected. ` : ""}${positiveWordsList > 0 ? `${positiveWordsList} positive word(s) detected.` : ""}`,
        `**History:** ${previousNegativeCount} previous negative ticket(s) from this customer`,
        `**Risk Level:** ${level === "Negative" ? "High - immediate attention required" : level === "Neutral" ? "Medium - monitor" : "Low"}`,
        ``,
        `**Recommended Action:** ${level === "Negative" ? "Prioritize empathetic response and quick resolution. Consider escalation." : "Standard follow-up procedure."}`,
      ].join("\n");
    } else if (action === "churn") {
      const risk = calculateChurnRisk(ticket, { customerTickets, incidents: linkedIncidents });
      if (risk && !risk.resolved) {
        const lines = [
          `**Churn Risk Score:** ${risk.riskPercent}%`,
          `**Risk Level:** ${risk.riskLevel}`,
          `**Why This Score?**`,
        ];
        risk.breakdown.forEach((b) => {
          lines.push(`${b.label} (${b.evidence})`);
        });
        lines.push(``);
        lines.push(`**Contributing Factors:**`);
        risk.factors.forEach((f) => {
          lines.push(`- ${f.label} (score: ${f.score > 0 ? "+" : ""}${f.score})`);
        });
        lines.push(``);
        lines.push(`**Evidence:**`);
        risk.evidence.forEach((e) => {
          lines.push(`- ${e}`);
        });
        lines.push(``);
        lines.push(`**Recommended Actions:**`);
        risk.recommendations.forEach((r, i) => {
          lines.push(`${i + 1}. ${r.action} (${r.priority}) — ${r.reason}`);
        });
        result = lines.join("\n");
      } else {
        result = `**Churn Risk Score:** 0%\n**Risk Level:** Low\nNo action required.`;
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
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        ref={drawerRef}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="relative flex h-full w-full max-w-[560px] flex-col bg-white dark:bg-[#111113] border-l border-border dark:border-[#2A2A2E] shadow-2xl"
      >
        {/* ===================== STICKY HEADER ===================== */}
        <div className="flex-shrink-0 border-b border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-zinc-400 dark:text-[#71717A]">
                  SD-{ticket.number || String(ticket.id).slice(-4).toUpperCase()}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {ticket.category && (
                  <span className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-[#A1A1AA]">
                    {ticket.category}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-[#FAFAFA] leading-snug truncate">
                {ticket.title || "Untitled Ticket"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-lg p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-[#A1A1AA] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 dark:bg-[#27272A] text-[7px] font-semibold text-zinc-600 dark:text-[#A1A1AA]">
                {avatarFor(ticket.id)}
              </span>
              <span className="truncate max-w-[120px]">{ticket.customer_name || ticket.customer_email || "Unknown"}</span>
            </div>
            {ticket.created_at && (
              <span className="flex items-center gap-1"><Clock size={12} />{format(new Date(ticket.created_at), "MMM d, yyyy")}</span>
            )}
            {ticket.updated_at && (
              <span className="flex items-center gap-1">Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}</span>
            )}
            {ticket.assignee ? (
              <span className="flex items-center gap-1"><UserCheck size={12} />{ticket.assignee}</span>
            ) : (
              <span className="text-zinc-300 dark:text-[#71717A]">Unassigned</span>
            )}
            {hasDirtyFields && <span className="flex items-center gap-1 text-amber-500 font-medium"><Clock size={12} /> Unsaved changes</span>}
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
                  <p className="text-xs text-zinc-400 dark:text-[#71717A] mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-[#A1A1AA]">{tag}</span>
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
                  <p className="text-xs text-zinc-400 dark:text-[#71717A] mb-1">Contact</p>
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
                      <AlertTriangle size={14} className={churnRisk.riskLevel === "Critical" ? "text-red-600" : churnRisk.riskLevel === "High" ? "text-orange-600" : "text-yellow-600"} />
                      <span className={`text-xs font-semibold ${churnRisk.riskLevel === "Critical" ? "text-red-700 dark:text-red-400" : churnRisk.riskLevel === "High" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                        {churnRisk.riskLevel} Churn Risk
                      </span>
                    </div>
                    <span className="text-lg font-bold text-zinc-900 dark:text-[#FAFAFA]">{churnRisk.riskPercent}%</span>
                  </div>
                </div>
              )}

              {/* Customer History */}
              {customerTickets.length > 0 && customerStats && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-[#A1A1AA] uppercase tracking-wider mb-2">History</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-zinc-900 dark:text-[#FAFAFA]">{customerStats.total}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">Total</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-emerald-600">{customerStats.resolvedCount}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">Resolved</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-2 text-center">
                      <p className="text-lg font-bold text-amber-600">{customerStats.openCount}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">Open</p>
                    </div>
                  </div>
                  {customerStats.avgResolutionHours != null && (
                    <p className="text-[10px] text-zinc-500 dark:text-[#A1A1AA] mb-2">Avg resolution: {customerStats.avgResolutionHours}h {customerStats.mostCommonCategory ? `· Common: ${customerStats.mostCommonCategory}` : ""}</p>
                  )}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {customerTickets.slice(0, 10).map((t) => (
                      <div key={t.id} onClick={() => handleCustomerTicketClick(t)}
                        className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-[#27272A] cursor-pointer transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-900 dark:text-[#FAFAFA] truncate">{t.title || t.customer_name || t.id}</p>
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
                <p className="text-xs text-zinc-400 dark:text-[#71717A]">No previous tickets from this customer.</p>
              )}
            </div>
          </Section>

          {/* --- Section 3: Timeline --- */}
          <Section title="Timeline" icon={Clock}>
            {loadingLogs ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-zinc-400" /></div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-[#71717A] text-center py-4">No timeline events.</p>
            ) : (
              <div className="space-y-0">
                {logs.map((log, idx) => {
                  const aMeta = getActionMeta(log.action);
                  const Icon = aMeta.icon;
                  const color = aMeta.color;
                  return (
                    <div key={log.id || idx} className="flex gap-3 pb-4 last:pb-0 relative">
                      {idx < logs.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-[#2A2A2E]" />
                      )}
                      <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#202024] flex-shrink-0 ${color}`}>
                        <Icon size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-900 dark:text-[#FAFAFA] capitalize">{log.action?.replace(/\./g, " ") || log.event || "Event"}</p>
                        {log.details?.name && <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">{log.details.name}</p>}
                        {log.action === "ticket.assigned" && log.details?.assignee && (
                          <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">Assigned to {log.details.assignee}</p>
                        )}
                        <span className="text-xs text-zinc-400 dark:text-[#71717A]">
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* --- Section 4: AI Assistant --- */}
          <Section title="AI Assistant" icon={Brain} defaultOpen={!!aiState.result}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleAiAction("summarize")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <FileText size={13} /> Summarize
                </button>
                <button onClick={() => handleAiAction("rootCause")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <Target size={13} /> Root Cause
                </button>
                <button onClick={() => handleAiAction("resolution")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <Lightbulb size={13} /> Resolution
                </button>
                <button onClick={() => handleAiAction("sentiment")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <ThumbsUp size={13} /> Sentiment
                </button>
                <button onClick={() => handleAiAction("churn")} disabled={aiState.loading}
                  className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                  <BarChart3 size={13} /> Churn Risk
                </button>
              </div>

              {aiState.loading && (
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] p-3">
                  <Loader2 size={14} className="animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-500 dark:text-[#A1A1AA]">Processing...</span>
                </div>
              )}

              {aiState.result && (
                <div className="rounded-lg border border-border dark:border-[#2A2A2E] bg-zinc-50 dark:bg-[#202024] p-3">
                  <pre className="text-xs text-zinc-700 dark:text-[#D4D4D8] whitespace-pre-wrap font-sans leading-relaxed">
                    {aiState.result}
                  </pre>
                  <div className="mt-2 flex items-center gap-2 pt-2 border-t border-border dark:border-[#2A2A2E]">
                    <button onClick={copyAiResult} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-[#FAFAFA] transition-colors">
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={regenerateAi}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-[#FAFAFA] transition-colors ml-auto">
                      <RotateCcw size={12} /> Regenerate
                    </button>
                  </div>
                  {aiState.history.length > 0 && (
                    <button onClick={() => setShowAiHistory(true)}
                      className="mt-2 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-[#A1A1AA] transition-colors">
                      <History size={11} /> Previous versions ({aiState.history.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* --- Section 5: Draft Reply --- */}
          <Section title="Draft Reply" icon={MessageSquare} defaultOpen={draftState.status !== "idle"}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {draftState.status !== "idle" && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      draftState.status === "generating" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
                      draftState.status === "editing" ? "bg-zinc-100 dark:bg-[#202024] text-zinc-500 dark:text-[#A1A1AA]" :
                      draftState.status === "pending_approval" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                      draftState.status === "approved" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                      draftState.status === "rejected" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                      draftState.status === "sent" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                      draftState.status === "error" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                      draftState.status === "saving" || draftState.status === "sending" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : ""
                    }`}>
                      {draftState.status === "generating" ? "Generating..." :
                       draftState.status === "editing" && unsavedDraft ? "Unsaved" :
                       draftState.status === "editing" ? "Saved" :
                       draftState.status === "saving" ? "Saving..." :
                       draftState.status === "pending_approval" ? "Pending Approval" :
                       draftState.status === "approved" ? "Approved" :
                       draftState.status === "rejected" ? "Rejected" :
                       draftState.status === "sending" ? "Sending..." :
                       draftState.status === "sent" ? "Sent" :
                       draftState.status === "error" ? "Error" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Error State */}
              {draftState.status === "error" && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">Draft generation failed</p>
                      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400/80">{draftState.error || "Unknown error"}</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={handleGenerateDraft}
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-red-500 transition-colors">
                          <RotateCcw size={10} /> Retry
                        </button>
                        {draftState.editorContent && (
                          <button onClick={() => updateDraftState({ status: "editing", error: null })}
                            className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                            Edit previous draft
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Generating State */}
              {draftState.status === "generating" && (
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] p-3">
                  <Loader2 size={14} className="animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-500 dark:text-[#A1A1AA]">Generating AI reply...</span>
                </div>
              )}

              {/* Generate Button (idle) */}
              {draftState.status === "idle" && (
                canGenerateDrafts ? (
                  <button onClick={handleGenerateDraft}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                    <Sparkles size={14} /> Generate AI Draft Reply
                  </button>
                ) : (
                  <button disabled
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                    <Sparkles size={14} /> Generate AI Draft Reply
                  </button>
                )
              )}

              {/* Editor */}
              {(draftState.status === "editing" || draftState.status === "pending_approval" || draftState.status === "approved" || draftState.status === "rejected" || draftState.status === "sent" || draftState.status === "saving" || draftState.status === "sending") && (
                <div className="space-y-2">
                  {draftState.versions.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {draftState.versions.map((v, i) => (
                        <button key={i} onClick={() => switchDraftVersion(i)}
                          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
                            i === draftState.currentVersion
                              ? "bg-zinc-900 dark:bg-[#FAFAFA] text-white dark:text-zinc-900"
                              : "bg-zinc-100 dark:bg-[#202024] text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-200 dark:hover:bg-[#27272A]"
                          }`}>
                          <History size={10} /> V{v.version}
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={draftState.editorContent}
                    onChange={(e) => handleDraftEditorChange(e.target.value)}
                    readOnly={draftState.status === "pending_approval" || draftState.status === "approved" || draftState.status === "rejected" || draftState.status === "sent" || draftState.status === "saving" || draftState.status === "sending"}
                    placeholder="Draft reply will appear here..."
                    rows={8}
                    className="w-full rounded-lg border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-3 py-2.5 text-sm text-zinc-900 dark:text-[#FAFAFA] outline-none focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 resize-y min-h-[160px] leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-[#71717A] disabled:opacity-70 disabled:cursor-not-allowed"
                  />

                  {draftState.status === "saving" && (
                    <div className="flex items-center gap-2 text-xs text-blue-500">
                      <Loader2 size={12} className="animate-spin" /> Saving draft...
                    </div>
                  )}
                  {draftState.status === "sending" && (
                    <div className="flex items-center gap-2 text-xs text-emerald-500">
                      <Loader2 size={12} className="animate-spin" /> Sending reply...
                    </div>
                  )}
                  {unsavedDraft && draftState.status === "editing" && (
                    <p className="text-[10px] text-amber-500">Unsaved changes · drafts are autosaved locally</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {draftState.status === "editing" && (
                      canSaveDrafts ? (
                        <button onClick={handleSaveDraft} disabled={!unsavedDraft}
                          className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50">
                          <Save size={11} /> Save Draft
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <Save size={11} /> Save Draft
                        </button>
                      )
                    )}

                    {draftState.status === "editing" && draftState.editorContent.trim().length > 0 && (
                      canRequestApproval ? (
                        <button onClick={handleRequestApproval}
                          className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-amber-500 transition-colors">
                          <CheckCircle2 size={11} /> Request Approval
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <CheckCircle2 size={11} /> Request Approval
                        </button>
                      )
                    )}

                    {draftState.status === "pending_approval" && (
                      canApproveDraftAction ? (
                        <button onClick={handleApproveDraft}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-500 transition-colors">
                          <CheckCircle2 size={11} /> Approve
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <CheckCircle2 size={11} /> Approve
                        </button>
                      )
                    )}

                    {draftState.status === "pending_approval" && (
                      canRejectDraftAction ? (
                        <button onClick={handleRejectDraft}
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-red-500 transition-colors">
                          <XCircle size={11} /> Reject
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <XCircle size={11} /> Reject
                        </button>
                      )
                    )}

                    {draftState.status === "approved" && (
                      canSendDraft ? (
                        <button onClick={handleSendReply}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-500 transition-colors">
                          <SendHorizonal size={11} /> Send Reply
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <SendHorizonal size={11} /> Send Reply
                        </button>
                      )
                    )}

                    {(draftState.status === "editing" || draftState.status === "approved") && (
                      canRegenerateDrafts ? (
                        <button onClick={handleRegenerateDraft} disabled={draftState.status === "generating"}
                          className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50">
                          <RotateCcw size={11} /> Regenerate
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <RotateCcw size={11} /> Regenerate
                        </button>
                      )
                    )}

                    {draftState.editorContent && (
                      canCopyDrafts ? (
                        <button onClick={handleCopyDraft}
                          className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                          <Copy size={11} /> Copy
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <Copy size={11} /> Copy
                        </button>
                      )
                    )}

                    {(draftState.status === "rejected" || draftState.status === "sent") && (
                      canGenerateDrafts ? (
                        <button onClick={handleGenerateDraft}
                          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[10px] font-medium text-white hover:opacity-90 transition-colors">
                          <Sparkles size={11} /> New Draft
                        </button>
                      ) : (
                        <button disabled
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium bg-zinc-100 dark:bg-[#202024] text-zinc-400 dark:text-[#71717A] cursor-not-allowed">
                          <Sparkles size={11} /> New Draft
                        </button>
                      )
                    )}
                  </div>

                  {draftState.versions.length > 0 && (
                    <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">
                      {draftState.versions.length === 1 ? "1 version" : `${draftState.versions.length} versions`}
                      {draftState.draftId && ` · ID: ${draftState.draftId.slice(0, 8)}...`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* --- Section 6: Linked Signal --- */}
          <Section title={`Linked Signal${linkedSignals.length !== 1 ? "s" : ""} (${linkedSignals.length})`} icon={Radio}>
            {linkedSignals.length > 0 ? (
              <div className="space-y-2">
                {linkedSignals.map((sig) => (
                  <div key={sig.id} className="rounded-lg border border-border dark:border-[#2A2A2E] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{sig.name || "Signal"}</p>
                        <p className="text-xs text-zinc-400 dark:text-[#71717A] font-mono mt-0.5">{sig.id.slice(0, 8)}...</p>
                      </div>
                      <button onClick={() => handleUnlinkSignal(sig.id)}
                        className="flex-shrink-0 rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={sig.status} />
                      <PriorityBadge priority={sig.proposed_priority || sig.severity} />
                      {sig.analysis_confidence != null && (
                        <span className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">Confidence: {sig.analysis_confidence}%</span>
                      )}
                    </div>
                    {sig.summary && <p className="mt-1 text-xs text-zinc-500 dark:text-[#A1A1AA] line-clamp-2">{sig.summary}</p>}
                    <div className="mt-1.5 text-[10px] text-zinc-400 dark:text-[#71717A]">
                      {sig.created_at && <span>Created {format(new Date(sig.created_at), "MMM d, yyyy")}</span>}
                      {sig.detected_at && <span> · Detected {format(new Date(sig.detected_at), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowCreateSignal(true)}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[10px] font-medium text-white hover:opacity-90 transition-opacity">
                    <Plus size={10} /> Create Signal
                  </button>
                  <button onClick={() => setShowLinkSignalDialog(true)}
                    className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <Radio size={10} /> Link Existing
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <Radio size={20} className="text-zinc-300 dark:text-[#71717A]" />
                <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">No signals linked to this ticket</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateSignal(true)}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                    <Plus size={12} /> Create Signal
                  </button>
                  <button onClick={() => setShowLinkSignalDialog(true)}
                    className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <Radio size={12} /> Link Existing
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* --- Section 7: Known Solutions --- */}
          <Section title={`Known Solutions (${knownSolutions.length})`} icon={BookOpen} defaultOpen={knownSolutions.length > 0}>
            {knownSolutions.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-[#71717A] text-center py-4">No matching knowledge found.</p>
            ) : (
              <div className="space-y-2">
                {knownSolutions.map((k) => (
                  <div key={k.id} onClick={() => setSelectedKnowledge(k)}
                    className="rounded-lg border border-border dark:border-[#2A2A2E] p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb size={13} className="text-amber-500 flex-shrink-0" />
                          <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{k.title || "Knowledge"}</p>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] mt-1 line-clamp-2">{k.summary || k.resolution || ""}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {k.confidence != null && <ConfidenceBadge value={k.confidence} />}
                      {k.root_cause && <span className="text-[10px] text-zinc-400 dark:text-[#71717A]">Root cause documented</span>}
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
                  <div key={inc.id} className="rounded-lg border border-border dark:border-[#2A2A2E] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate">{inc.title || "Incident"}</p>
                        <p className="text-xs text-zinc-400 dark:text-[#71717A] font-mono mt-0.5">{inc.id.slice(0, 8)}...</p>
                      </div>
                      <button onClick={() => handleUnlinkIncident(inc.id)}
                        className="flex-shrink-0 rounded p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={inc.status} />
                      <PriorityBadge priority={inc.severity} />
                      {inc.owner_user_id && <span className="text-[10px] text-zinc-500 dark:text-[#A1A1AA]">Owner: {inc.owner_user_id}</span>}
                    </div>
                    {inc.summary && <p className="mt-1 text-xs text-zinc-500 dark:text-[#A1A1AA] line-clamp-2">{inc.summary}</p>}
                    {inc.affected_ticket_count != null && (
                      <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-[#71717A]">{inc.affected_ticket_count} linked ticket(s)</p>
                    )}
                    {inc.opened_at && (
                      <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Opened {format(new Date(inc.opened_at), "MMM d, yyyy")}</p>
                    )}
                  </div>
                ))}
                <button onClick={() => setShowIncidentSelector(true)}
                  className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-[10px] font-medium text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors mt-1">
                  <Plus size={10} /> Link Incident
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <ShieldAlert size={20} className="text-zinc-300 dark:text-[#71717A]" />
                <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">No incidents linked to this ticket</p>
                <button onClick={() => setShowIncidentSelector(true)}
                  className="flex items-center gap-1 rounded-lg border border-border dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
                  <Plus size={12} /> Link Incident
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* ===================== STICKY FOOTER ===================== */}
        <div className="flex-shrink-0 border-t border-border dark:border-[#2A2A2E] bg-white dark:bg-[#111113] px-6 py-4">
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
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <CheckCircle2 size={14} /> Resolve
              </button>
            )}

            {/* Close drawer - available to all */}
            <button onClick={handleCloseDrawer}
              className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
              <XCircle size={14} /> Close
            </button>

            {/* Assign - manager only */}
            {canAssignTicket ? (
              <button onClick={() => setShowAssign(true)} disabled={assigning}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50"
                title="Assign ticket to an agent">
                {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                Assign
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
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
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <Trash2 size={14} /> Delete
              </button>
            )}

            {/* Generate Draft - gated by canGenerateDrafts */}
            {canGenerateDrafts ? (
              <button onClick={handleGenerateDraft} disabled={draftState.status === "generating" || draftState.status === "saving" || draftState.status === "sending"}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Generate AI draft reply">
                {draftState.status === "generating" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {draftState.status === "generating" ? "Generating..." : "Draft"}
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <Sparkles size={14} /> Draft
              </button>
            )}

            {/* Link Incident - available to all with permission */}
            {canLinkIncident ? (
              <button onClick={() => setShowIncidentSelector(true)} disabled={linkingIncident}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors disabled:opacity-50"
                title="Link an existing incident">
                <ShieldAlert size={14} /> Link Incident
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <ShieldAlert size={14} /> Link Incident
              </button>
            )}

            {/* Create Signal - gated by canCreateSignal */}
            {canCreateSignal ? (
              <button onClick={() => setShowCreateSignal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors"
                title="Create a new signal from this ticket">
                <Radio size={14} /> Create Signal
              </button>
            ) : (
              <button disabled
                className="flex items-center gap-1.5 rounded-lg border border-border dark:border-[#2A2A2E] px-4 py-2 text-xs font-medium text-zinc-300 dark:text-[#71717A] cursor-not-allowed"
                title="Requires Support Manager permissions.">
                <Radio size={14} /> Create Signal
              </button>
            )}
          </div>
          {isManager && (
            <p className="mt-2 text-[10px] text-emerald-500 dark:text-emerald-400">Support Manager — full access</p>
          )}
          {!isManager && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-[#71717A]">ESC to close · Ctrl+S to save · Some actions require Support Manager permissions</p>
          )}
        </div>
      </motion.div>

      {/* ===================== MODALS ===================== */}
      <AssignDialog
        open={showAssign}
        currentAssignee={ticket.assignee}
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
        open={showDeleteConfirm}
        title="Delete Ticket"
        message={`Are you sure you want to delete "${ticket.title || ticket.id}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* AI History Modal */}
      <ConfirmDialog
        open={showAiHistory}
        title="Previous AI Versions"
        message={aiState.history.map((h, i) => `Version ${i + 1}: ${h.slice(0, 100)}...`).join("\n\n")}
        confirmLabel="Close"
        destructive={false}
        onConfirm={() => setShowAiHistory(false)}
        onCancel={() => setShowAiHistory(false)}
      />

      <AnimatePresence>
        {selectedKnowledge && (
          <KnowledgeDrawer entry={selectedKnowledge} onClose={() => setSelectedKnowledge(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
