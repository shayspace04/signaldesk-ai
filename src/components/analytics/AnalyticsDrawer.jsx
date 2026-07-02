import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Download, ExternalLink, Loader2, Activity, TicketCheck, ShieldAlert, MessageSquare, SendHorizonal, Brain, BookOpen, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import c from "react-countup";
const CountUp = c.default;

function ChartBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-muted dark:text-muted-dark truncate text-right">{label}</span>
      <div className="flex-1 h-5 rounded-lg bg-zinc-100 dark:bg-[#202024] overflow-hidden">
        <div className={`h-full rounded-lg transition-all duration-700 ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="w-8 text-xs text-zinc-500 dark:text-zinc-400 text-right">{count}</span>
    </div>
  );
}

function RecentItem({ icon: Icon, color, title, subtitle, date }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2">
      <Icon size={13} className={`${color} flex-shrink-0`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-50 truncate">{title || "\u2014"}</p>
        {subtitle && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{subtitle}</p>}
      </div>
      {date && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">{format(new Date(date), "MMM d")}</span>}
    </div>
  );
}

function TicketsDrawer({ m, onClose }) {
  const navigate = useNavigate();
  const statuses = Object.entries(m.analytics.ticketsByStatus || {});
  const priorities = Object.entries(m.analytics.ticketsByPriority || {});
  const categories = Object.entries(m.analytics.ticketsByCategory || {});
  const customers = m.analytics.topCustomers || [];
  const recent = (m.all.tickets || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);

  const csvData = useMemo(() => {
    const rows = [["ID", "Title", "Customer", "Status", "Priority", "Category", "Created"]];
    (m.all.tickets || []).forEach((t) => {
      rows.push([t.id, t.title || "", t.customer_name || "", t.status || "", t.priority || "", t.category || "", t.created_at || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  return (
    <DrawerShell title="Ticket Analytics" icon={TicketCheck} color="text-blue-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/tickets" pageLabel="Open Tickets">
      {statuses.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Status Breakdown</p>
          <ChartSection data={Object.fromEntries(statuses)} color="bg-blue-500" />
        </div>
      )}
      {priorities.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Priority Breakdown</p>
          <ChartSection data={Object.fromEntries(priorities)} color="bg-violet-500" />
        </div>
      )}
      {categories.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Category Breakdown</p>
          <ChartSection data={Object.fromEntries(categories)} color="bg-emerald-500" />
        </div>
      )}
      {customers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Top Customers</p>
          <div className="space-y-1">
            {customers.slice(0, 5).map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{i + 1}</span>
                <span className="flex-1 text-xs text-zinc-900 dark:text-zinc-50 truncate">{name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{count} tickets</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Recent Tickets</p>
        <div className="space-y-1">
          {recent.map((t) => (
            <RecentItem key={t.id} icon={TicketCheck} color="text-blue-400" title={t.title || t.id} subtitle={t.customer_name || t.customer_email} date={t.created_at} />
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

function SignalsDrawer({ m, onClose }) {
  const navigate = useNavigate();
  const sigStatus = Object.entries(m.analytics.signalsByStatus || {});
  const sigSev = Object.entries(m.analytics.signalsBySeverity || {});
  const recent = (m.all.signals || []).sort((a, b) => new Date(b.detected_at || 0) - new Date(a.detected_at || 0)).slice(0, 10);

  const csvData = useMemo(() => {
    const rows = [["ID", "Name", "Category", "Status", "Priority", "Detected"]];
    (m.all.signals || []).forEach((s) => {
      rows.push([s.id, s.name || "", s.category || "", s.status || "", s.proposed_priority || "", s.detected_at || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  return (
    <DrawerShell title="Signal Analytics" icon={Activity} color="text-green-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/signals" pageLabel="Open Signals">
      {sigStatus.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Signal Distribution</p>
          <ChartSection data={Object.fromEntries(sigStatus)} color="bg-green-500" />
        </div>
      )}
      {sigSev.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Root Causes by Severity</p>
          <ChartSection data={Object.fromEntries(sigSev)} color="bg-orange-500" />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Recent Signals</p>
        <div className="space-y-1">
          {recent.map((s) => (
            <RecentItem key={s.id} icon={Activity} color="text-green-400" title={s.name || s.summary || s.id} subtitle={`${s.category || "general"} \u00B7 ${s.status || "pending"}`} date={s.detected_at} />
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

function IncidentsDrawer({ m, onClose }) {
  const navigate = useNavigate();
  const incByStatus = Object.entries(m.analytics.incidentByStatus || {});
  const incBySev = Object.entries(m.analytics.incidentBySeverity || {});
  const recent = (m.all.incidents || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);

  const csvData = useMemo(() => {
    const rows = [["ID", "Title", "Status", "Severity", "Created", "Linear Issue"]];
    (m.all.incidents || []).forEach((i) => {
      rows.push([i.id, i.title || "", i.status || "", i.severity || "", i.created_at || "", i.linearIssueId || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  return (
    <DrawerShell title="Incident Analytics" icon={ShieldAlert} color="text-amber-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/incidents" pageLabel="Open Incidents">
      {incByStatus.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Incidents by Status</p>
          <ChartSection data={Object.fromEntries(incByStatus)} color="bg-amber-500" />
        </div>
      )}
      {incBySev.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Severity Distribution</p>
          <ChartSection data={Object.fromEntries(incBySev)} color="bg-orange-500" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Open" value={m.incidents.active} color="text-amber-500" />
        <StatMini label="MTTR" value={`${m.incidents.avgEscalationTime || 0}h`} color="text-blue-500" />
        <StatMini label="Escalated" value={m.incidents.escalated} color="text-indigo-500" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Recent Incidents</p>
        <div className="space-y-1">
          {recent.map((i) => (
            <RecentItem key={i.id} icon={ShieldAlert} color="text-amber-400" title={i.title || i.id} subtitle={`${i.severity || "medium"} \u00B7 ${i.status || "open"}`} date={i.created_at} />
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

function DraftsDrawer({ m, onClose }) {
  const navigate = useNavigate();
  const draftStatus = Object.entries(m.analytics.draftsByStatus || {});
  const recent = (m.all.drafts || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);

  const csvData = useMemo(() => {
    const rows = [["ID", "Ticket ID", "Status", "Created"]];
    (m.all.drafts || []).forEach((d) => {
      rows.push([d.id, d.ticket_id || "", d.status || "", d.created_at || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  const approvalRate = m.drafts.total > 0 ? Math.round((m.drafts.approved / m.drafts.total) * 100) : 0;

  return (
    <DrawerShell title="Draft Analytics" icon={MessageSquare} color="text-violet-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/tickets" pageLabel="Open Tickets">
      {draftStatus.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Draft Status</p>
          <ChartSection data={Object.fromEntries(draftStatus)} color="bg-violet-500" />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Approval Rate" value={`${approvalRate}%`} color="text-emerald-500" />
        <StatMini label="Approved" value={m.drafts.approved} color="text-emerald-500" />
        <StatMini label="Rejected" value={m.drafts.rejected} color="text-red-500" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Recent Drafts</p>
        <div className="space-y-1">
          {recent.map((d) => (
            <RecentItem key={d.id} icon={MessageSquare} color="text-violet-400" title={`Draft for ${d.ticket_id || "unknown"}`} subtitle={d.status || "pending"} date={d.created_at} />
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

function KnowledgeDrawerView({ m, onClose }) {
  const navigate = useNavigate();
  const topArticles = m.knowledge.topArticles || [];

  const csvData = useMemo(() => {
    const rows = [["ID", "Title", "Confidence", "References", "Status"]];
    (m.all.knowledge || []).forEach((k) => {
      rows.push([k.id, k.title || "", k.confidence ?? "", k.reference_count ?? 0, k.status || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  return (
    <DrawerShell title="Knowledge Analytics" icon={BookOpen} color="text-amber-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/knowledge" pageLabel="Open Knowledge">
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Articles" value={m.knowledge.total} color="text-amber-500" />
        <StatMini label="Avg Confidence" value={`${m.knowledge.avgConfidence || 0}%`} color="text-amber-500" />
        <StatMini label="Total Refs" value={m.knowledge.totalReferences} color="text-amber-500" />
      </div>
      {topArticles.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Top Articles</p>
          <div className="space-y-1">
            {topArticles.slice(0, 5).map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">{i + 1}</span>
                <span className="flex-1 text-xs text-zinc-900 dark:text-zinc-50 truncate">{a.title}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{a.refs} refs</span>
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{a.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

function EngineeringDrawer({ m, onClose }) {
  const navigate = useNavigate();

  const csvData = useMemo(() => {
    const rows = [["ID", "Title", "Severity", "Linear Issue", "Linear Status", "Created"]];
    (m.all.incidents || []).forEach((i) => {
      if (i.linearIssueId) rows.push([i.id, i.title || "", i.severity || "", i.linearIssueId || "", i.linearStatus || "", i.created_at || ""]);
    });
    return rows.map((r) => r.join(",")).join("\n");
  }, [m]);

  return (
    <DrawerShell title="Engineering Analytics" icon={CheckCircle2} color="text-indigo-500" onClose={onClose} navigate={navigate} csvData={csvData} pagePath="/incidents" pageLabel="Open Incidents">
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Open Issues" value={m.incidents.openLinear} color="text-indigo-500" />
        <StatMini label="Resolved" value={m.incidents.resolvedLinear} color="text-emerald-500" />
        <StatMini label="Avg Esc Time" value={`${m.incidents.avgEscalationTime || 0}h`} color="text-indigo-500" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Escalation History</p>
        {(m.all.incidents || []).filter((i) => i.linearIssueId).length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No engineering escalations yet.</p>
        ) : (
          <div className="space-y-1">
            {(m.all.incidents || []).filter((i) => i.linearIssueId).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10).map((i) => (
              <RecentItem key={i.id} icon={ExternalLink} color="text-indigo-400" title={i.title || i.id} subtitle={`${i.linearIssueId || ""} \u00B7 ${i.linearStatus || "Todo"}`} date={i.created_at} />
            ))}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

function StatMini({ label, value, color }) {
  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-3 text-center">
      <p className={`text-lg font-bold ${color} dark:brightness-110`}>{value}</p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function ChartSection({ data, color }) {
  const entries = Object.entries(data || {});
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);
  if (entries.length === 0) return <p className="text-xs text-zinc-400 dark:text-zinc-500 italic py-2">No data.</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([label, count]) => (
        <ChartBar key={label} label={label} count={count} max={maxCount} color={color} />
      ))}
    </div>
  );
}

function DrawerShell({ title, icon: Icon, color, children, onClose, navigate, csvData, pagePath, pageLabel }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="relative flex h-full w-full max-w-[520px] flex-col bg-white dark:bg-[#111113] border-l border-border dark:border-border-dark shadow-2xl">
        <div className="flex-shrink-0 border-b border-border dark:border-border-dark bg-white dark:bg-[#111113] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => { navigate(pagePath); onClose(); }} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors">
              <ExternalLink size={12} /> {pageLabel}
            </button>
            <button onClick={() => { const blob = new Blob([csvData], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url); }}
              className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors">
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </motion.div>
    </div>
  );
}

const DRAWERS = {
  tickets: TicketsDrawer,
  signals: SignalsDrawer,
  incidents: IncidentsDrawer,
  drafts: DraftsDrawer,
  knowledge: KnowledgeDrawerView,
  engineering: EngineeringDrawer,
};

export default function AnalyticsDrawer({ section, m, onClose }) {
  if (!section || !DRAWERS[section]) return null;
  const D = DRAWERS[section];
  return <D m={m} onClose={onClose} />;
}
