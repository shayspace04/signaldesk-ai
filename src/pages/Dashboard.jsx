import { motion } from "framer-motion";
import {
  TicketCheck,
  Radio,
  ShieldAlert,
  FileText,
  Brain,
  AlertTriangle,
} from "lucide-react";
import CountUp from "react-countup";
import { useNavigate } from "react-router-dom";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import { calculateChurnRisk } from "@/lib/churnRisk";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";

function KpiCard({ title, value, icon: Icon, color, loading, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl border border-[#EFEFEF] bg-white p-5 transition-all hover:border-zinc-200 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500 truncate">{title}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-zinc-100" />
            ) : (
              <CountUp end={value} duration={1.5} />
            )}
          </h2>
        </div>
        <div className={`rounded-lg bg-zinc-50 p-2.5 ${color}`}>
          {Icon && <Icon size={22} />}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const { data: tickets, loading: loadingTickets, refresh: refreshTickets } = useLemmaRecords("tickets", { limit: 100 });
  const { data: incidents, loading: loadingIncidents, refresh: refreshIncidents } = useLemmaRecords("incidents", { limit: 100 });
  const { data: signals, loading: loadingSignals, refresh: refreshSignals } = useLemmaRecords("signals", { limit: 100 });
  const { data: drafts, loading: loadingDrafts, refresh: refreshDrafts } = useLemmaRecords("drafts", { limit: 100 });
  const { data: auditLogs, refresh: refreshAuditLogs } = useLemmaRecords("audit_logs", { sort: [{ field: "created_at", direction: "desc" }], limit: 10 });
  useRefreshListener(() => { refreshTickets(); refreshIncidents(); refreshSignals(); refreshDrafts(); refreshAuditLogs(); });

  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const criticalIncidents = incidents.filter((i) => i.severity === "urgent" || i.severity === "critical");
  const pendingDrafts = drafts.filter((d) => d.status === "pending");

  const customersAtRisk = tickets.filter((t) => {
    const r = calculateChurnRisk(t);
    return r && !r.resolved && (r.riskLevel === "High" || r.riskLevel === "Critical");
  }).length;

  const k = workspace.kpi;

  return (
    <motion.div
      className="flex flex-col min-h-full space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{workspace.name} Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">{workspace.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title={k.openTickets} value={openTickets.length} icon={TicketCheck} color="text-blue-500" loading={loadingTickets} />
        <KpiCard title={k.activeSignals} value={signals.length} icon={Radio} color="text-accent" loading={loadingSignals} />
        <KpiCard title={k.criticalIncidents} value={criticalIncidents.length} icon={ShieldAlert} color="text-red-500" loading={loadingIncidents} />
        <KpiCard title={k.pendingDrafts} value={pendingDrafts.length} icon={FileText} color="text-amber-500" loading={loadingDrafts} />
        <KpiCard title="Customers At Risk" value={customersAtRisk} icon={AlertTriangle} color="text-red-500" loading={loadingTickets} onClick={() => navigate("/tickets", { state: { churnFilter: "at-risk" } })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Recent Tickets</h2>
          {loadingTickets ? (
            <div className="space-y-2">
              {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />)}
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-zinc-400">No tickets yet.</p>
          ) : (
            <div className="space-y-2">
              {tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{t.title || t.customer_name || t.id}</p>
                    <p className="text-xs text-zinc-400">{t.customer_name || t.customer_email || ""}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Recent Activity</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-zinc-400">No activity recorded.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-[#EFEFEF] bg-white p-3">
                  <Brain size={15} className="mt-0.5 text-accent flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-900">{log.action}</p>
                    <p className="text-xs text-zinc-400">
                      {log.actor_agent_name || log.actor_type || "System"}
                      {log.created_at ? ` · ${format(new Date(log.created_at), "MMM d, HH:mm")}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Signals</h2>
          {signals.length === 0 ? (
            <p className="text-sm text-zinc-400">No signals detected.</p>
          ) : (
            <div className="space-y-2">
              {signals.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{s.name || s.summary || s.id}</p>
                    <p className="text-xs text-zinc-400">{s.category || ""}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={s.proposed_priority} />
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-zinc-400">No active incidents.</p>
          ) : (
            <div className="space-y-2">
              {incidents.slice(0, 5).map((inc) => (
                <div key={inc.id} className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{inc.title || inc.id}</p>
                    <p className="text-xs text-zinc-400">{inc.affected_ticket_count ? `${inc.affected_ticket_count} tickets` : ""}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={inc.severity} />
                    <StatusBadge status={inc.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
