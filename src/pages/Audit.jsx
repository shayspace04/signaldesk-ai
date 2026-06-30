import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ScrollText, Loader2, Brain, Ticket, Radio, ShieldAlert, Mail, CheckCircle2, XCircle } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import { format } from "date-fns";

const ACTION_ICONS = {
  "ticket.created": Ticket,
  "ticket.updated": Ticket,
  "ticket.resolved": Ticket,
  "ticket.escalated": Ticket,
  "draft.generated": Brain,
  "draft.approved": CheckCircle2,
  "draft.rejected": XCircle,
  "draft.pending_approval": Brain,
  "signal.detected": Radio,
  "signal.created": Radio,
  "incident.created": ShieldAlert,
  "manager.notification_created": Mail,
  "email.sent": Mail,
  "triage.completed": Brain,
  "knowledge.search.completed": Brain,
};

const ACTION_COLORS = {
  "ticket.created": "text-blue-500",
  "ticket.updated": "text-blue-500",
  "ticket.resolved": "text-green-500",
  "ticket.escalated": "text-orange-500",
  "draft.generated": "text-violet-500",
  "draft.approved": "text-green-500",
  "draft.rejected": "text-red-500",
  "draft.pending_approval": "text-amber-500",
  "signal.detected": "text-accent",
  "signal.created": "text-accent",
  "incident.created": "text-red-500",
  "manager.notification_created": "text-cyan-500",
  "email.sent": "text-green-500",
  "triage.completed": "text-purple-500",
  "knowledge.search.completed": "text-cyan-500",
};

export default function Audit() {
  const { data: logs, loading, refresh } = useLemmaRecords("audit_logs", {
    sort: [{ field: "created_at", direction: "desc" }],
    limit: 200,
  });
  useRefreshListener(refresh);

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-10 bg-white pb-4">
        <div className="flex items-center gap-3">
          <ScrollText size={22} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-zinc-400">{logs.length} events recorded</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20">
          <ScrollText size={36} className="mb-3 text-zinc-300" />
          <p className="text-base font-medium text-zinc-600">No audit events</p>
          <p className="mt-1 text-sm text-zinc-400">Events will appear here as actions are performed.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => {
            const Icon = ACTION_ICONS[log.action] || Brain;
            const color = ACTION_COLORS[log.action] || "text-zinc-400";
            return (
              <div
                key={log.id || idx}
                className="flex items-start gap-4 rounded-lg border border-[#EFEFEF] bg-white px-4 py-3 transition-colors hover:bg-zinc-50"
              >
                <div className={`mt-0.5 rounded-lg bg-zinc-100 p-2 ${color}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {log.action}
                    </p>
                    {log.created_at && (
                      <span className="flex-shrink-0 text-xs text-zinc-400">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {log.actor_agent_name || log.actor_type || "System"}
                    {log.resource_type ? ` · ${log.resource_type}` : ""}
                  </p>
                  {log.details?.name && (
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {log.details.name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
