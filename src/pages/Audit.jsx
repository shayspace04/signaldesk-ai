import { motion } from "framer-motion";
import { ScrollText, Brain, Ticket, Radio, ShieldAlert, Mail, CheckCircle2, XCircle, BookOpen, Link2, Archive } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import { format } from "date-fns";

const ACTION_ICONS = {
  "ticket.created": Ticket, "ticket.updated": Ticket, "ticket.resolved": Ticket, "ticket.escalated": Ticket,
  "draft.generated": Brain, "draft.approved": CheckCircle2, "draft.rejected": XCircle, "draft.pending_approval": Brain,
  "signal.detected": Radio, "signal.created": Radio, "incident.created": ShieldAlert,
  "manager.notification_created": Mail, "email.sent": Mail, "triage.completed": Brain, "knowledge.search.completed": Brain,
  "signal.in_review": Radio, "signal.approved": Radio, "signal.resolved": Radio,
  "engineering.handoff": ShieldAlert, "engineering.package_reviewed": ShieldAlert,
  "draft.ready": Brain, "ticket.ready_for_reply": Ticket, "ticket.closed": Ticket,
  "ticket.status_changed": Ticket, "ticket.priority_changed": Ticket, "ticket.assigned": Ticket,
  "signal.linked": Radio, "signal.unlinked": Radio,
  "incident.linked": ShieldAlert, "incident.unlinked": ShieldAlert, "incident.resolved": ShieldAlert,
  "incident.severity_escalated": ShieldAlert, "linear.issue_created": ShieldAlert,
  "linear.synced": ShieldAlert, "linear.fetched": ShieldAlert,
  "knowledge.created": BookOpen, "knowledge.updated": BookOpen, "knowledge.referenced": Link2, "knowledge.archived": Archive,
};

const ACTION_COLORS = {
  "ticket.created": "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20", "ticket.updated": "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20",
  "ticket.resolved": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20", "ticket.escalated": "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20",
  "draft.generated": "text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20", "draft.approved": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
  "draft.rejected": "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20", "draft.pending_approval": "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20",
  "signal.detected": "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950/20", "signal.created": "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950/20",
  "incident.created": "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20", "manager.notification_created": "text-cyan-500 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20",
  "email.sent": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20", "triage.completed": "text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20",
  "knowledge.search.completed": "text-cyan-500 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20",
  "signal.in_review": "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20", "signal.approved": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
  "signal.resolved": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
  "engineering.handoff": "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20", "engineering.package_reviewed": "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20",
  "draft.ready": "text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20", "ticket.ready_for_reply": "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20",
  "ticket.closed": "text-muted-base bg-zinc-100 dark:bg-zinc-800", "ticket.status_changed": "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20",
  "ticket.priority_changed": "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20", "ticket.assigned": "text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20",
  "signal.linked": "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-950/20", "signal.unlinked": "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20",
  "incident.linked": "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20", "incident.unlinked": "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20",
  "incident.resolved": "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20", "incident.severity_escalated": "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20",
  "linear.issue_created": "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20", "linear.synced": "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20",
  "linear.fetched": "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20",
  "knowledge.created": "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20", "knowledge.updated": "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20",
  "knowledge.referenced": "text-cyan-500 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20", "knowledge.archived": "text-muted-base bg-zinc-100 dark:bg-zinc-800",
};

export default function Audit() {
  const { workspace } = useWorkspace();
  const auditFilters = workspaceFilter(workspace.id);
  const { data: logs, total, loading, refresh } = useLemmaRecords("audit_logs", { sort: [{ field: "created_at", direction: "desc" }], limit: 200, filters: auditFilters });
  useRefreshListener(refresh);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6">
        <h1 className="text-[36px] font-bold tracking-tight text-primary">Audit Log</h1>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{total} event{total !== 1 ? "s" : ""} recorded</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />)}</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-border-dark bg-zinc-50/50 py-20">
          <ScrollText size={36} className="mb-4 text-zinc-300 dark:text-zinc-600" />
          <p className="text-base font-medium text-secondary-body">No audit events</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">Events will appear here as actions are performed.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => {
            const Icon = ACTION_ICONS[log.action] || Brain;
            const color = ACTION_COLORS[log.action] || "text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
            return (
              <div key={log.id || idx}
                className="flex items-start gap-4 rounded-xl border border-border dark:border-border-dark bg-card px-4 py-3.5 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-200 dark:hover:border-border-dark">
                <div className={`mt-0.5 rounded-lg p-2 ${color} flex-shrink-0`}><Icon size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-primary">{log.action}</p>
                    {log.created_at && <span className="flex-shrink-0 text-xs text-muted dark:text-muted-dark">{format(new Date(log.created_at), "MMM d, HH:mm")}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-base">
                    {log.actor_agent_name || log.actor_type || "System"}{log.resource_type ? ` · ${log.resource_type}` : ""}
                  </p>
                  {log.details?.name && <p className="mt-0.5 truncate text-xs text-muted dark:text-muted-dark">{log.details.name}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
