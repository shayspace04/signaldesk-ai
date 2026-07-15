import { motion } from "framer-motion";
import { useState } from "react";
import {
  TicketCheck, Radio, ShieldAlert, FileText, Brain, AlertTriangle,
  RefreshCw, Download, Search, Activity, BookOpen, Rocket,
  Mail, CheckCircle2, ArrowUpRight, ArrowDownRight, Link2, Archive, Loader2,
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
import { deriveWorkflowStage } from "@/lib/workflowStage";
import { launchEnterpriseDemo } from "@/lib/enterpriseDemoLoader";

function Trend({ value, positive }) {
  if (value == null) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-success" : "text-danger"}`}>
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
      className={`group relative rounded-xl border border-border dark:border-border-dark bg-card p-5 transition-all duration-200 hover:border-zinc-300 dark:hover:border-border-dark hover:shadow-card ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-zinc-100 dark:bg-[#202024] p-2 text-zinc-600 dark:text-muted-dark">
              <Icon size={16} />
            </div>
            {trend !== undefined && <Trend value={trend} positive={trendPositive} />}
          </div>
          <p className="text-sm text-muted dark:text-muted-dark truncate">{title}</p>
          <div className="mt-1">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded bg-zinc-100 dark:bg-[#202024]" />
            ) : (
              <span className="text-[32px] font-bold tracking-tight text-primary">
                <CountUp end={value} duration={1.5} />
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-muted dark:text-muted-dark">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {action && (
        <button onClick={action} className="text-sm font-medium text-muted dark:text-muted-dark hover:text-primary transition-colors">
          View all
        </button>
      )}
    </div>
  );
}

function ActivityLog({ log }) {
  const actionLabels = {
    "draft.generated": { icon: Brain, label: "AI generated a draft response", color: "text-violet-500 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/20" },
    "draft.approved": { icon: CheckCircle2, label: "Manager approved AI draft", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    "draft.rejected": { icon: Brain, label: "AI draft rejected", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
    "signal.detected": { icon: Radio, label: "AI detected anomaly signal", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20" },
    "signal.created": { icon: Radio, label: "New signal created", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20" },
    "incident.created": { icon: ShieldAlert, label: "Incident triggered", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
    "ticket.created": { icon: TicketCheck, label: "New ticket opened", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
    "ticket.resolved": { icon: CheckCircle2, label: "Ticket resolved", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    "ticket.escalated": { icon: AlertTriangle, label: "Ticket escalated", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
    "knowledge.search.completed": { icon: BookOpen, label: "Knowledge article suggested", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/20" },
    "email.sent": { icon: Mail, label: "Email sent to customer", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
    "triage.completed": { icon: Activity, label: "Triage completed", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20" },
    "signal.in_review": { icon: Radio, label: "Signal moved to review", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
    "signal.approved": { icon: Radio, label: "Signal approved", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    "signal.workflow_changed": { icon: Radio, label: "Signal stage changed", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20" },
    "signal.resolved": { icon: Radio, label: "Signal resolved", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    "engineering.handoff": { icon: ShieldAlert, label: "Engineering handoff created", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
    "engineering.package_reviewed": { icon: ShieldAlert, label: "Engineering package reviewed", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
    "draft.ready": { icon: Brain, label: "Draft reply ready", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/20" },
    "ticket.ready_for_reply": { icon: TicketCheck, label: "Ticket ready for reply", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
    "ticket.closed": { icon: TicketCheck, label: "Ticket closed", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-[#202024]" },
    "incident.resolved": { icon: CheckCircle2, label: "Incident resolved", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    "knowledge.created": { icon: BookOpen, label: "Knowledge article created", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
    "knowledge.updated": { icon: BookOpen, label: "Knowledge article updated", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
    "knowledge.referenced": { icon: Link2, label: "Knowledge article referenced", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/20" },
    "knowledge.archived": { icon: Archive, label: "Knowledge article archived", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-[#202024]" },
  };

  const meta = actionLabels[log.action] || { icon: Activity, label: log.action, color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-[#202024]" };
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 px-1 group">
      <div className={`mt-0.5 rounded-lg ${meta.bg} p-1.5 ${meta.color} flex-shrink-0`}>
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-primary truncate">{meta.label}</p>
        <p className="text-xs text-muted dark:text-muted-dark mt-0.5">
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
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-[#27272A] cursor-pointer transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary truncate">{ticket.title || ticket.customer_name || ticket.id}</p>
        <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{ticket.customer_name || ticket.customer_email || ""}</p>
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
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-[#27272A] cursor-pointer transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary truncate">{signal.name || signal.summary || signal.id}</p>
        <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{signal.category || ""}</p>
      </div>
      <div className="ml-3 flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={signal.proposed_priority} />
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${deriveWorkflowStage(signal) === "incident_created" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : deriveWorkflowStage(signal) === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : deriveWorkflowStage(signal) === "review" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-600 dark:bg-[#202024] dark:text-muted-dark"}`}>
          {deriveWorkflowStage(signal).charAt(0).toUpperCase() + deriveWorkflowStage(signal).slice(1)}
        </span>
      </div>
    </div>
  );
}

function IncidentRow({ incident, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-[#27272A] cursor-pointer transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary truncate">{incident.title || incident.id}</p>
        <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{incident.affected_ticket_count ? `${incident.affected_ticket_count} tickets affected` : ""}</p>
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
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoProgress, setDemoProgress] = useState({ current: 0, total: 0, workspace: "", message: "" });

  const handleLaunchDemo = async () => {
    setDemoLoading(true);
    setDemoProgress({ current: 0, total: 5, workspace: "Starting...", message: "" });
    try {
      await launchEnterpriseDemo((wsId, wsName, step, total, msg, pct) => {
        setDemoProgress({ current: wsId, total: step, workspace: wsName, message: msg });
      });
      toast.success("Enterprise demo launched — all 5 workspaces populated");
    } catch (err) {
      toast.error("Demo failed: " + (err.message || "unknown error"));
    } finally {
      setDemoLoading(false);
      setDemoProgress({ current: 0, total: 0, workspace: "", message: "" });
    }
  };

  const m = useMetrics(workspace.id, { timeFilter, searchQuery });
  const k = workspace.kpi;

  const hasWorkspaceData = m.all.tickets.length > 0 || m.all.signals.length > 0 || m.all.incidents.length > 0;
  const filterActive = timeFilter !== "all" || searchQuery.trim().length > 0;
  const noFilterResults = !m.loading && m.raw.tickets.length === 0 && m.raw.signals.length === 0 && m.raw.incidents.length === 0;
  const isEmptyWorkspace = !m.loading && !hasWorkspaceData;
  const isEmptyFilter = !m.loading && hasWorkspaceData && noFilterResults && filterActive;
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
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{workspace.name} · {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dashboard..."
              className="w-56 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-[#111113] py-2 pl-9 pr-3 text-sm text-secondary-body outline-none transition-all duration-200 focus:border-zinc-300 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-600 placeholder:text-muted dark:placeholder:text-[#71717A]"
            />
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="rounded-xl border border-border dark:border-border-dark bg-card px-3 py-2 text-sm text-secondary-body outline-none hover:border-zinc-300 dark:hover:border-border-dark transition-colors"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          {workspace.id === "signaldesk" && (
            <button
              onClick={handleLaunchDemo}
              disabled={demoLoading}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                demoLoading
                  ? "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-400 cursor-wait"
                  : "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:border-violet-300 dark:hover:border-violet-700"
              }`}
            >
              {demoLoading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {demoLoading ? "Populating..." : "Launch Enterprise Demo"}
            </button>
          )}
          <button
            onClick={m.refresh}
            className="flex items-center gap-2 rounded-xl border border-border dark:border-border-dark bg-card px-3 py-2 text-sm font-medium text-secondary-body hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:border-zinc-300 dark:hover:border-border-dark transition-all duration-200"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => exportAsCSV(m)}
            className="flex items-center gap-2 rounded-xl border border-border dark:border-border-dark bg-card px-3 py-2 text-sm font-medium text-secondary-body hover:bg-zinc-50 dark:hover:bg-[#27272A] hover:border-zinc-300 dark:hover:border-border-dark transition-all duration-200"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {demoLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-[#1a0a2e]/50 py-24">
          <Loader2 size={40} className="mb-4 text-violet-500 animate-spin" />
          <p className="text-lg font-medium text-violet-700 dark:text-violet-300">Launching Enterprise Demo...</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 w-48 rounded-full bg-violet-200 dark:bg-violet-900/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${Math.round((demoProgress.current !== 0 ? 1 : 0) / 5 * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-violet-500 dark:text-violet-400">
            Populating {demoProgress.workspace}...
          </p>
          <p className="mt-1 text-xs text-violet-400 dark:text-violet-500">{demoProgress.message}</p>
        </div>
      ) : isEmptyWorkspace && !searchQuery ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-border-dark bg-zinc-50/50 dark:bg-[#202024]/50 py-24">
          <Radio size={40} className="mb-4 text-zinc-300 dark:text-zinc-500" />
          <p className="text-lg font-medium text-secondary-body">This workspace has no data yet.</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">Click &quot;Launch Enterprise Demo&quot; above to populate all workspaces with realistic enterprise support data.</p>
        </div>
      ) : isEmptyWorkspace && searchQuery ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-border-dark bg-zinc-50/50 dark:bg-[#202024]/50 py-24">
          <Search size={40} className="mb-4 text-zinc-300 dark:text-zinc-500" />
          <p className="text-lg font-medium text-secondary-body">No results for &quot;{searchQuery}&quot;</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">Try a different search term across tickets, signals, and incidents.</p>
        </div>
      ) : isEmptyFilter ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-border-dark bg-zinc-50/50 dark:bg-[#202024]/50 py-24">
          <Search size={40} className="mb-4 text-zinc-300 dark:text-zinc-500" />
          <p className="text-lg font-medium text-secondary-body">No data matches the selected date range.</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark mb-6">Try a different filter or view all time.</p>
          <div className="flex items-center gap-3">
            <button onClick={() => { setTimeFilter("all"); setSearchQuery(""); }}
              className="rounded-lg border border-border dark:border-border-dark bg-card px-4 py-2 text-sm font-medium text-secondary-body hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
              Reset Filters
            </button>
            <button onClick={() => setTimeFilter("all")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
              Show All Time
            </button>
          </div>
        </div>
      ) : demoLoading ? (
        <div className="mb-6 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 flex items-center gap-4">
          <Loader2 size={20} className="animate-spin text-violet-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Enterprise Demo: Populating {demoProgress.workspace}...</p>
            <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5 truncate">{demoProgress.message}</p>
          </div>
          <div className="h-2 w-32 rounded-full bg-violet-200 dark:bg-violet-900/50 overflow-hidden flex-shrink-0">
            <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${Math.round((demoProgress.current !== 0 ? 1 : 0) / 5 * 100)}%` }} />
          </div>
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
              <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-card">
                <SectionHeader title="Recent Tickets" action={() => navigate("/tickets")} />
                {m.loading ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                  </div>
                ) : m.searched.tickets.length === 0 ? (
                  <p className="text-sm text-muted dark:text-muted-dark py-8 text-center">No tickets match the current filters.</p>
                ) : (
                  <div className="divide-y divide-border dark:divide-border-dark">
                    {m.searched.tickets.slice(0, 6).map((t) => (
                      <RecentTicketRow key={t.id} ticket={t} onClick={() => navigate("/tickets", { state: { focusTicketId: t.id } })} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-card">
                <SectionHeader title="Recent Activity" />
                {m.searched.logs.length === 0 ? (
                  <p className="text-sm text-muted dark:text-muted-dark py-8 text-center">No activity recorded.</p>
                ) : (
                  <div className="divide-y divide-border dark:divide-border-dark">
                    {m.searched.logs.slice(0, 8).map((log, idx) => (
                      <ActivityLog key={log.id || idx} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-8">
            <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-card">
              <SectionHeader title="Signals" action={() => navigate("/signals")} />
              {m.loading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                </div>
              ) : m.searched.signals.length === 0 ? (
                <p className="text-sm text-muted dark:text-muted-dark py-8 text-center">No signals detected.</p>
              ) : (
                <div className="divide-y divide-border dark:divide-border-dark">
                  {m.searched.signals.slice(0, 5).map((s) => (
                    <SignalRow key={s.id} signal={s} onClick={() => navigate("/signals")} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-card">
              <SectionHeader title="Critical Incidents" action={() => navigate("/incidents")} />
              {m.loading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-[#202024]" />)}
                </div>
              ) : m.searched.incidents.length === 0 ? (
                <p className="text-sm text-muted dark:text-muted-dark py-8 text-center">No active incidents.</p>
              ) : (
                <div className="divide-y divide-border dark:divide-border-dark">
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
