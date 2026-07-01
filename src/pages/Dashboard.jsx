import { motion } from "framer-motion";
import { useState } from "react";
import {
  TicketCheck, Radio, ShieldAlert, FileText, Brain, AlertTriangle,
  RefreshCw, Download, Search, Activity, BookOpen,
  Mail, CheckCircle2, ArrowUpRight, ArrowDownRight, Link2, Archive,
} from "lucide-react";
import c from "react-countup";
const CountUp = c.default;
import { useNavigate } from "react-router-dom";
import { useMetrics } from "@/hooks/useMetrics";
import { format } from "date-fns";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import { useWorkspace } from "@/context/WorkspaceContext";
import { toast } from "sonner";
import { emitRefresh } from "@/lib/refreshEvents";

function Trend({ value, positive }) {
  if (value == null) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {value}
    </span>
  );
}

function KpiCard({ title, value, icon: Icon, subtitle, trend, trendPositive, loading, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -2 }}
      className={`group relative rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5 transition-all duration-200 hover:border-zinc-300 dark:hover:border-[#2A2A2E] hover:shadow-card dark:border-[#2A2A2E] dark:bg-[#18181B] dark:hover:border-[#2A2A2E] ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-zinc-100 p-2 text-zinc-600 dark:bg-[#202024] dark:text-[#A1A1AA]">
              <Icon size={16} />
            </div>
            {trend !== undefined && <Trend value={trend} positive={trendPositive} />}
          </div>
          <p className="text-sm text-muted dark:text-[#A1A1AA] truncate dark:text-[#A1A1AA]">{title}</p>
          <div className="mt-1">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded bg-zinc-100 dark:bg-[#202024]" />
            ) : (
              <span className="text-[32px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">
                <CountUp end={value} duration={1.5} />
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-muted dark:text-[#A1A1AA]">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-[#FAFAFA]">{title}</h2>
      {action && (
        <button onClick={action} className="text-sm font-medium text-muted dark:text-[#A1A1AA] hover:text-zinc-900 dark:hover:text-[#FAFAFA] transition-colors dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]">
          View all
        </button>
      )}
    </div>
  );
}

function ActivityLog({ log }) {
  const actionLabels = {
    "draft.generated": { icon: Brain, label: "AI generated a draft response", color: "text-violet-500", bg: "bg-violet-50" },
    "draft.approved": { icon: CheckCircle2, label: "Manager approved AI draft", color: "text-emerald-500", bg: "bg-emerald-50" },
    "draft.rejected": { icon: Brain, label: "AI draft rejected", color: "text-red-500", bg: "bg-red-50" },
    "signal.detected": { icon: Radio, label: "AI detected anomaly signal", color: "text-green-500", bg: "bg-green-50" },
    "signal.created": { icon: Radio, label: "New signal created", color: "text-green-500", bg: "bg-green-50" },
    "incident.created": { icon: ShieldAlert, label: "Incident triggered", color: "text-red-500", bg: "bg-red-50" },
    "ticket.created": { icon: TicketCheck, label: "New ticket opened", color: "text-blue-500", bg: "bg-blue-50" },
    "ticket.resolved": { icon: CheckCircle2, label: "Ticket resolved", color: "text-emerald-500", bg: "bg-emerald-50" },
    "ticket.escalated": { icon: AlertTriangle, label: "Ticket escalated", color: "text-orange-500", bg: "bg-orange-50" },
    "knowledge.search.completed": { icon: BookOpen, label: "Knowledge article suggested", color: "text-cyan-500", bg: "bg-cyan-50" },
    "email.sent": { icon: Mail, label: "Email sent to customer", color: "text-blue-500", bg: "bg-blue-50" },
    "triage.completed": { icon: Activity, label: "Triage completed", color: "text-purple-500", bg: "bg-purple-50" },
    "signal.in_review": { icon: Radio, label: "Signal moved to review", color: "text-amber-500", bg: "bg-amber-50" },
    "signal.approved": { icon: Radio, label: "Signal approved", color: "text-emerald-500", bg: "bg-emerald-50" },
    "signal.resolved": { icon: Radio, label: "Signal resolved", color: "text-emerald-500", bg: "bg-emerald-50" },
    "engineering.handoff": { icon: ShieldAlert, label: "Engineering handoff created", color: "text-indigo-500", bg: "bg-indigo-50" },
    "engineering.package_reviewed": { icon: ShieldAlert, label: "Engineering package reviewed", color: "text-indigo-500", bg: "bg-indigo-50" },
    "draft.ready": { icon: Brain, label: "Draft reply ready", color: "text-violet-500", bg: "bg-violet-50" },
    "ticket.ready_for_reply": { icon: TicketCheck, label: "Ticket ready for reply", color: "text-blue-500", bg: "bg-blue-50" },
    "ticket.closed": { icon: TicketCheck, label: "Ticket closed", color: "text-zinc-500", bg: "bg-zinc-100" },
    "incident.resolved": { icon: CheckCircle2, label: "Incident resolved", color: "text-emerald-500", bg: "bg-emerald-50" },
    "knowledge.created": { icon: BookOpen, label: "Knowledge article created", color: "text-amber-500", bg: "bg-amber-50" },
    "knowledge.updated": { icon: BookOpen, label: "Knowledge article updated", color: "text-amber-500", bg: "bg-amber-50" },
    "knowledge.referenced": { icon: Link2, label: "Knowledge article referenced", color: "text-cyan-500", bg: "bg-cyan-50" },
    "knowledge.archived": { icon: Archive, label: "Knowledge article archived", color: "text-zinc-500", bg: "bg-zinc-100" },
  };

  const meta = actionLabels[log.action] || { icon: Activity, label: log.action, color: "text-zinc-500 dark:text-[#A1A1AA]", bg: "bg-zinc-100 dark:bg-[#202024]" };
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 px-1 group">
      <div className={`mt-0.5 rounded-lg ${meta.bg} p-1.5 ${meta.color} flex-shrink-0`}>
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-900 dark:text-[#FAFAFA] truncate dark:text-[#FAFAFA]">{meta.label}</p>
        <p className="text-xs text-muted dark:text-[#A1A1AA] mt-0.5 dark:text-[#A1A1AA]">
          {log.actor_agent_name || log.actor_type || "System"}
          {log.created_at && <> · {format(new Date(log.created_at), "MMM d, HH:mm")}</>}
        </p>
      </div>
    </div>
  );
}

function RecentTicketRow({ ticket, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors dark:hover:bg-[#27272A]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA] truncate dark:text-[#FAFAFA]">{ticket.title || ticket.customer_name || ticket.id}</p>
        <p className="text-xs text-muted dark:text-[#A1A1AA] mt-0.5 dark:text-[#A1A1AA]">{ticket.customer_name || ticket.customer_email || ""}</p>
      </div>
      <div className="ml-3 flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={ticket.priority} />
        <StatusBadge status={ticket.status} />
      </div>
    </div>
  );
}

function SignalRow({ signal, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors dark:hover:bg-[#27272A]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:[#FAFAFA] truncate dark:text-[#FAFAFA]">{signal.name || signal.summary || signal.id}</p>
        <p className="text-xs text-muted dark:[#A1A1AA] mt-0.5 dark:text-[#A1A1AA]">{signal.category || ""}</p>
      </div>
      <div className="ml-3 flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={signal.proposed_priority} />
        <StatusBadge status={signal.status} />
      </div>
    </div>
  );
}

function IncidentRow({ incident, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors dark:hover:bg-[#27272A]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:[#FAFAFA] truncate dark:text-[#FAFAFA]">{incident.title || incident.id}</p>
        <p className="text-xs text-muted dark:[#A1A1AA] mt-0.5 dark:text-[#A1A1AA]">{incident.affected_ticket_count ? `${incident.affected_ticket_count} tickets affected` : ""}</p>
      </div>
      <div className="ml-3 flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={incident.severity} />
        <StatusBadge status={incident.status} />
      </div>
    </div>
  );
}

function exportAsCSV(m) {
  const rows = [
    ["Metric", "Value"],
    ["Dashboard - " + format(new Date(), "MMM d, yyyy, HH:mm"), ""],
    ["Open Tickets", m.dashboard.openTickets],
    ["Active Signals", m.dashboard.activeSignals],
    ["Critical Incidents", m.dashboard.criticalIncidents],
    ["Pending Drafts", m.dashboard.pendingDrafts],
    ["Resolved Today", m.dashboard.resolvedToday],
    ["Avg Resolution (hrs)", m.dashboard.avgResolutionTime],
    ["Avg Response (hrs)", m.dashboard.avgResponseTime],
    ["Urgent %", m.dashboard.urgentPct + "%"],
    ["Waiting for Reply", m.dashboard.waitingForReply],
    ["Signals Approved", m.dashboard.signalsApproved],
    ["Signals Under Review", m.dashboard.signalsUnderReview],
    ["Signals Resolved", m.dashboard.signalsResolved],
    ["Incidents Resolved (Engineering)", m.dashboard.incidentsResolved],
    ["Knowledge Articles", m.dashboard.knowledgeArticles],
    ["Knowledge References", m.dashboard.knowledgeReferences],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Dashboard metrics exported as CSV");
}

export default function Dashboard() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState("7d");
  const [searchQuery, setSearchQuery] = useState("");

  const m = useMetrics(workspace.id, { timeFilter, searchQuery });
  const k = workspace.kpi;

  const isEmpty = !m.loading && m.raw.tickets.length === 0 && m.raw.signals.length === 0 && m.raw.incidents.length === 0;
  const d = m.dashboard;

  const trendUp = (v) => !v?.startsWith("-");
  const trendDown = (v) => v?.startsWith("-");

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">{workspace.name} · {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-[#A1A1AA]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dashboard..."
              className="w-56 rounded-xl border border-border dark:border-[#2A2A2E] bg-surface dark:bg-[#111113] py-2 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-zinc-300 dark:focus:border-[#2A2A2E] focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 placeholder:text-muted dark:border-[#2A2A2E] dark:bg-[#111113] dark:focus:border-zinc-600 dark:focus:ring-zinc-600 dark:placeholder:text-[#71717A]"
            />
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm text-zinc-700 dark:text-[#FAFAFA] outline-none hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-colors dark:border-[#2A2A2E] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:hover:border-[#2A2A2E]"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={m.refresh}
            className="flex items-center gap-2 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm font-medium text-zinc-700 dark:text-[#FAFAFA] hover:bg-zinc-50 hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-all duration-200 dark:border-[#2A2A2E] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:hover:bg-[#27272A] dark:hover:border-[#2A2A2E]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => exportAsCSV(m)}
            className="flex items-center gap-2 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] px-3 py-2 text-sm font-medium text-zinc-700 dark:text-[#FAFAFA] hover:bg-zinc-50 hover:border-zinc-300 dark:hover:border-[#2A2A2E] transition-all duration-200 dark:border-[#2A2A2E] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:hover:bg-[#27272A] dark:hover:border-[#2A2A2E]"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {isEmpty && !searchQuery ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 py-24 dark:border-[#2A2A2E] dark:bg-[#202024]/50">
          <Radio size={40} className="mb-4 text-zinc-300 dark:text-[#71717A]" />
          <p className="text-lg font-medium text-zinc-600 dark:text-[#A1A1AA]">No data yet</p>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">Load demo data from Settings to populate the dashboard.</p>
        </div>
      ) : isEmpty && searchQuery ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 py-24 dark:border-[#2A2A2E] dark:bg-[#202024]/50">
          <Search size={40} className="mb-4 text-zinc-300 dark:text-[#71717A]" />
          <p className="text-lg font-medium text-zinc-600 dark:text-[#A1A1AA]">No results for &quot;{searchQuery}&quot;</p>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">Try a different search term across tickets, signals, and incidents.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <KpiCard
              title={k.openTickets}
              value={d.openTickets}
              icon={TicketCheck}
              trend={d.openTrend}
              trendPositive={trendDown(d.openTrend)}
              loading={m.loading}
              subtitle={`${d.resolvedToday} resolved today`}
              onClick={() => navigate("/tickets")}
            />
            <KpiCard
              title={k.activeSignals}
              value={d.activeSignals}
              icon={Radio}
              trend={d.signalTrend}
              trendPositive={trendUp(d.signalTrend)}
              loading={m.loading}
              subtitle={`${d.signalsCreatedToday} created today`}
              onClick={() => navigate("/signals")}
            />
            <KpiCard
              title={k.criticalIncidents}
              value={d.criticalIncidents}
              icon={ShieldAlert}
              trend={d.incidentTrend}
              trendPositive={trendDown(d.incidentTrend)}
              loading={m.loading}
              subtitle={`${d.incidentsActive} active`}
              onClick={() => navigate("/incidents")}
            />
            <KpiCard
              title={k.pendingDrafts}
              value={d.pendingDrafts}
              icon={FileText}
              trend={d.draftTrend}
              trendPositive={trendDown(d.draftTrend)}
              loading={m.loading}
              subtitle={`${d.waitingForReply} waiting for reply`}
              onClick={() => navigate("/approval")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-8">
            <div className="xl:col-span-2">
              <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5 shadow-card dark:border-[#2A2A2E] dark:bg-[#18181B]">
                <SectionHeader title="Recent Tickets" action={() => navigate("/tickets")} />
                {m.loading ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                  </div>
                ) : m.searched.tickets.length === 0 ? (
                  <p className="text-sm text-muted dark:text-[#A1A1AA] py-8 text-center dark:text-[#A1A1AA]">No tickets match the current filters.</p>
                ) : (
                  <div className="divide-y divide-border dark:divide-[#2A2A2E]">
                    {m.searched.tickets.slice(0, 6).map((t) => (
                      <RecentTicketRow key={t.id} ticket={t} onClick={() => navigate("/tickets", { state: { focusTicketId: t.id } })} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5 shadow-card dark:border-[#2A2A2E] dark:bg-[#18181B]">
                <SectionHeader title="Recent Activity" />
                {m.searched.logs.length === 0 ? (
                  <p className="text-sm text-muted dark:text-[#A1A1AA] py-8 text-center dark:text-[#A1A1AA]">No activity recorded.</p>
                ) : (
                  <div className="divide-y divide-border dark:divide-[#2A2A2E]">
                    {m.searched.logs.slice(0, 8).map((log, idx) => (
                      <ActivityLog key={log.id || idx} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-8">
            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5 shadow-card dark:border-[#2A2A2E] dark:bg-[#18181B]">
              <SectionHeader title="Signals" action={() => navigate("/signals")} />
              {m.loading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                </div>
              ) : m.searched.signals.length === 0 ? (
                <p className="text-sm text-muted dark:text-[#A1A1AA] py-8 text-center dark:text-[#A1A1AA]">No signals detected.</p>
              ) : (
                <div className="divide-y divide-border dark:divide-[#2A2A2E]">
                  {m.searched.signals.slice(0, 5).map((s) => (
                    <SignalRow key={s.id} signal={s} onClick={() => navigate("/signals")} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-5 shadow-card dark:border-[#2A2A2E] dark:bg-[#18181B]">
              <SectionHeader title="Critical Incidents" action={() => navigate("/incidents")} />
              {m.loading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                </div>
              ) : m.searched.incidents.length === 0 ? (
                <p className="text-sm text-muted dark:text-[#A1A1AA] py-8 text-center dark:text-[#A1A1AA]">No active incidents.</p>
              ) : (
                <div className="divide-y divide-border dark:divide-[#2A2A2E]">
                  {m.searched.incidents.slice(0, 5).map((inc) => (
                    <IncidentRow key={inc.id} incident={inc} onClick={() => navigate("/incidents")} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
