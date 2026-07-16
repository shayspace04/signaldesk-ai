import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Activity, FileText, Users, TicketCheck, Radio, ShieldAlert, ExternalLink, Loader2, CheckCircle2, Clock, MessageSquare, SendHorizonal, Brain, BookOpen, Lightbulb, TrendingUp, Zap, BarChart3, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import c from "react-countup";
const CountUp = c.default;
import { useMetrics } from "@/hooks/useMetrics";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useRefreshListener } from "@/lib/refreshEvents";
import KpiCard from "@/components/analytics/KpiCard";
import AnalyticsDrawer from "@/components/analytics/AnalyticsDrawer";

function ChartBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-muted dark:text-muted-dark truncate text-right">{label}</span>
      <div className="flex-1 h-6 rounded-lg bg-muted-surface overflow-hidden">
        <div className={`h-full rounded-lg transition-all duration-700 ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="w-8 text-xs text-muted-base text-right">{count}</span>
    </div>
  );
}

function ChartSection({ title, data, color }) {
  const entries = useMemo(() => Object.entries(data || {}), [data]);
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);
  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-primary mb-4">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted dark:text-muted-dark">No data.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([lbl, count]) => (
            <ChartBar key={lbl} label={lbl} count={count} max={maxCount} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopList({ title, data, color }) {
  const items = useMemo(() => data || [], [data]);
  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-primary mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted dark:text-muted-dark">No data.</p>
      ) : (
        <div className="space-y-2">
          {items.map(([name, count], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>{i + 1}</span>
              <span className="flex-1 text-sm text-primary truncate">{name}</span>
              <span className="text-xs text-muted dark:text-muted-dark">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-5 mt-2 first:mt-0">
      {Icon && <Icon size={18} className="text-zinc-400 dark:text-zinc-500" />}
      <h2 className="text-lg font-semibold text-secondary">{title}</h2>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700 ml-2" />
    </div>
  );
}

function sparklineFromRecords(records, field) {
  if (!records || records.length === 0) return [];
  const now = Date.now();
  const buckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    buckets[format(d, "MMM d")] = 0;
  }
  records.forEach((r) => {
    const ts = r[field];
    if (!ts) return;
    const key = format(new Date(ts), "MMM d");
    if (buckets[key] !== undefined) buckets[key]++;
  });
  return Object.values(buckets);
}

const TIMEFILTERS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export default function Analytics() {
  const { workspace } = useWorkspace();
  const [timeFilter, setTimeFilter] = useState("all");
  const [chartFilter, setChartFilter] = useState("category");
  const [drawerSection, setDrawerSection] = useState(null);

  const m = useMetrics(workspace.id, { timeFilter });
  useRefreshListener(m.refresh);

  const chartOptions = [
    { value: "category", label: "By Category" },
    { value: "priority", label: "By Priority" },
    { value: "timeline", label: "Timeline" },
  ];

  let chartData, chartColor, chartTitle;
  if (chartFilter === "category") {
    chartData = m.analytics.ticketsByCategory;
    chartColor = "bg-violet-500";
    chartTitle = "Tickets by Category";
  } else if (chartFilter === "priority") {
    chartData = m.analytics.ticketsByPriority;
    chartColor = "bg-blue-500";
    chartTitle = "Tickets by Priority";
  } else {
    chartData = m.analytics.ticketsByDay;
    chartColor = "bg-emerald-500";
    chartTitle = "Tickets by Day";
  }

  const ticketSpark = useMemo(() => sparklineFromRecords(m.raw.tickets, "created_at"), [m.raw.tickets]);
  const signalSpark = useMemo(() => sparklineFromRecords(m.raw.signals, "detected_at"), [m.raw.signals]);
  const incidentSpark = useMemo(() => sparklineFromRecords(m.raw.incidents, "created_at"), [m.raw.incidents]);
  const draftSpark = useMemo(() => sparklineFromRecords(m.raw.drafts, "created_at"), [m.raw.drafts]);
  const knowledgeSpark = useMemo(() => sparklineFromRecords(m.raw.knowledge, "captured_at"), [m.raw.knowledge]);
  const logSpark = useMemo(() => sparklineFromRecords(m.raw.logs, "created_at"), [m.raw.logs]);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Analytics</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{workspace.name} · Platform metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          {TIMEFILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTimeFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                timeFilter === f.value ? "bg-zinc-900 text-white" : "text-muted-base hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Support Operations ===== */}
      <SectionHeader title="Support Operations" icon={Activity} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <KpiCard icon={Activity} color="text-violet-500" value={m.analytics.totalActions} label="Total Actions" loading={m.loading}
          sparklineData={logSpark} onClick={() => setDrawerSection("tickets")} />
        <KpiCard icon={TicketCheck} color="text-blue-500" value={m.tickets.totalInPeriod} label="Tickets" loading={m.loading}
          trend={m.tickets.trendCreation} sparklineData={ticketSpark} onClick={() => setDrawerSection("tickets")} />
        <KpiCard icon={Radio} color="text-green-500" value={m.signals.total} label="Total Signals" loading={m.loading}
          trend={m.signals.trendCreation} sparklineData={signalSpark} onClick={() => setDrawerSection("signals")} />
        <KpiCard icon={ShieldAlert} color="text-amber-500" value={m.analytics.incidentCount} label="Incidents" loading={m.loading}
          trend={m.incidents.trendCreation} sparklineData={incidentSpark} onClick={() => setDrawerSection("incidents")} />
      </div>

      {/* ===== Response Quality ===== */}
      <SectionHeader title="Response Quality" icon={Zap} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <KpiCard icon={FileText} color="text-emerald-500" value={m.analytics.resolvedCount} label="Resolved" loading={m.loading}
          trend={m.tickets.resolvedTrend} sparklineData={ticketSpark} onClick={() => setDrawerSection("tickets")} />
        <KpiCard icon={MessageSquare} color="text-violet-500" value={m.drafts.total} label="Total Drafts" loading={m.loading}
          trend={m.drafts.trendCreation} sparklineData={draftSpark} onClick={() => setDrawerSection("drafts")} />
        <KpiCard icon={SendHorizonal} color="text-emerald-500" value={m.drafts.approved} label="Approved Replies" loading={m.loading}
          trend={m.drafts.trendCreation} sparklineData={draftSpark} onClick={() => setDrawerSection("drafts")} />
        <KpiCard icon={Clock} color="text-cyan-500" value={m.tickets.avgResponseTime} label="Avg Resp Time (hrs)" loading={m.loading}
          onClick={() => setDrawerSection("tickets")} />
      </div>

      {/* ===== Knowledge ===== */}
      <SectionHeader title="Knowledge" icon={BookOpen} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <KpiCard icon={BookOpen} color="text-amber-500" value={m.knowledge.total} label="Knowledge Articles" loading={m.loading}
          trend={m.knowledge.trendCreation} sparklineData={knowledgeSpark} onClick={() => setDrawerSection("knowledge")} />
        <KpiCard icon={Lightbulb} color="text-amber-500" value={m.knowledge.totalReferences} label="Total References" loading={m.loading}
          onClick={() => setDrawerSection("knowledge")} />
        <KpiCard icon={Brain} color="text-amber-500" value={m.knowledge.avgConfidence} label="Avg Confidence" loading={m.loading}
          onClick={() => setDrawerSection("knowledge")} />
        <KpiCard icon={ExternalLink} color="text-amber-500" value={m.knowledge.withIncident} label="Linked to Incidents" loading={m.loading}
          onClick={() => setDrawerSection("knowledge")} />
          <KpiCard icon={Clock} color="text-cyan-500" value={m.knowledge.avgResolutionTime} label="Avg Resolution (hrs)" loading={m.loading}
            onClick={() => setDrawerSection("knowledge")} />
      </div>

      {/* ===== Engineering ===== */}
      <SectionHeader title="Engineering" icon={TrendingUp} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <KpiCard icon={ExternalLink} color="text-indigo-500" value={m.incidents.escalated} label="Escalated to Engineering" loading={m.loading}
          onClick={() => setDrawerSection("engineering")} />
        <KpiCard icon={Loader2} color="text-indigo-500" value={m.incidents.openLinear} label="Open Engineering Issues" loading={m.loading}
          onClick={() => setDrawerSection("engineering")} />
        <KpiCard icon={CheckCircle2} color="text-indigo-500" value={m.incidents.resolvedLinear} label="Resolved Engineering Issues" loading={m.loading}
          onClick={() => setDrawerSection("engineering")} />
        <KpiCard icon={Clock} color="text-indigo-500" value={m.incidents.avgEscalationTime} label="Avg Esc Time (hrs)" loading={m.loading}
          onClick={() => setDrawerSection("engineering")} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-8">
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-primary">Ticket Analysis</h2>
            <div className="flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
              {chartOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setChartFilter(o.value)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    chartFilter === o.value ? "bg-zinc-900 text-white" : "text-muted-base hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {Object.keys(chartData || {}).length === 0 ? (
            <p className="text-sm text-muted dark:text-muted-dark py-8 text-center">No ticket data.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(chartData).map(([lbl, count]) => {
                const max = Math.max(...Object.values(chartData), 1);
                const pct = (count / max) * 100;
                return (
                  <div key={lbl} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted dark:text-muted-dark truncate text-right">{lbl}</span>
                    <div className="flex-1 h-6 rounded-lg bg-muted-surface overflow-hidden">
                      <div className={`h-full rounded-lg transition-all duration-700 ${chartColor}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="w-8 text-xs text-muted-base text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <ChartSection title="Signals by Stage" data={m.analytics.signalsByStatus} color="bg-green-500" />
          <ChartSection title="Signals by Severity" data={m.analytics.signalsBySeverity} color="bg-orange-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-8">
        <ChartSection title="Incident Trend" data={m.analytics.incidentTrend} color="bg-red-500" />
        <ChartSection title="Incidents by Status" data={m.analytics.incidentByStatus} color="bg-amber-500" />
        <ChartSection title="Incidents by Severity" data={m.analytics.incidentBySeverity} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-8">
        <ChartSection title="Drafts by Status" data={m.analytics.draftsByStatus} color="bg-violet-500" />
        <TopList title="Top Categories" data={m.analytics.topCategories} color="bg-violet-500" />
        <TopList title="Top Customers" data={m.analytics.topCustomers} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-8">
        <ChartSection title="Actions by Type" data={Object.fromEntries((m.analytics.actionsByType || []).slice(0, 10))} color="bg-cyan-500" />
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-primary mb-4">SLA Compliance</h2>
            <div className="flex items-center gap-4">
              <span className="text-[36px] font-bold tracking-tight text-primary">
                <CountUp end={m.analytics.slaCompliance ?? 0} duration={1.5} suffix="%" />
              </span>
              <p className="text-sm text-muted dark:text-muted-dark">Tickets resolved within 24 hours</p>
            </div>
            <div className="mt-4 h-3 rounded-full bg-muted-surface overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${(m.analytics.slaCompliance ?? 0) >= 90 ? "bg-emerald-500" : (m.analytics.slaCompliance ?? 0) >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${Math.max(m.analytics.slaCompliance ?? 0, 2)}%` }} />
            </div>
          </div>
        <ChartSection title="Resolution Time Trend (hours)" data={Object.fromEntries(m.analytics.avgResTimeByDay)} color="bg-cyan-500" />
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-primary mb-4">Engineering Response</h2>
          <div className="flex items-center gap-4">
            <span className="text-[36px] font-bold tracking-tight text-primary">
              <CountUp end={m.analytics.engineeringResponseTime} duration={1.5} suffix="h" decimals={1} />
            </span>
            <p className="text-sm text-muted dark:text-muted-dark">Avg response time</p>
          </div>
          <div className="mt-4 flex justify-between text-xs text-muted dark:text-muted-dark">
            <span>{m.analytics.escalatedCount} escalated</span>
            <span>{m.analytics.incidentResolved} resolved</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-8">
        <ChartSection title="Knowledge Articles by Day" data={m.analytics.knowledgeByDay} color="bg-amber-500" />
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-primary mb-4">Top Knowledge Articles</h2>
          {m.knowledge.topArticles.length === 0 ? (
            <p className="text-sm text-muted dark:text-muted-dark">No articles yet.</p>
          ) : (
            <div className="space-y-2">
              {m.knowledge.topArticles.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 text-sm text-primary truncate">{a.title}</span>
                  <span className="text-xs text-muted dark:text-muted-dark">{a.refs} refs</span>
                  <span className="rounded-md bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{a.confidence}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawerSection && (
        <AnalyticsDrawer section={drawerSection} m={m} onClose={() => setDrawerSection(null)} />
      )}
    </motion.div>
  );
}
