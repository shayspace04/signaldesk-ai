import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, BookOpen, Lightbulb, FileText, Target, Activity, CheckCircle2, Shield, Clock, Hash, BarChart3, Brain, Calendar, Link2, ExternalLink, Loader2, Ticket, AlertTriangle, GitBranch, TrendingUp, Users, DollarSign, Zap, RefreshCw, Eye, Circle } from "lucide-react";
import { format } from "date-fns";
import client from "@/lib/lemmaClient";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";

const REFRESH_INTERVAL_MS = 30000;

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2">
      <Icon size={13} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="ml-auto text-xs font-medium text-zinc-900 dark:text-zinc-50">{value != null ? value : "\u2014"}</span>
    </div>
  );
}

function DetailSection({ title, content }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">{title}</p>
      <div className="rounded-lg bg-zinc-50 dark:bg-[#202024] p-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{content || "No data available."}</div>
    </div>
  );
}

function TimelineEvent({ icon: Icon, color, time, label, detail, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`rounded-full p-1 ${color}`}>
          <Icon size={12} className="text-white" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
        {detail && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{detail}</p>}
        {time && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{format(new Date(time), "MMM d, yyyy HH:mm")}</p>}
      </div>
    </div>
  );
}

function RefItem({ icon: Icon, color, id, title, status, priority, date, subtitle, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2 transition hover:bg-zinc-100 dark:hover:bg-[#27272A] text-left">
      <Icon size={13} className={`${color} flex-shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {id && <span className="text-[10px] font-mono font-medium text-zinc-400 dark:text-zinc-500">{typeof id === "string" && id.length > 12 ? id.slice(0, 8) + "..." : id}</span>}
          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50 truncate">{title || "Untitled"}</span>
        </div>
        {subtitle && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {status && <StatusBadge status={status} size="sm" />}
        {priority && <PriorityBadge priority={priority} size="sm" />}
        {date && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{format(new Date(date), "MMM d")}</span>}
      </div>
    </button>
  );
}

function ImpactCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-lg border border-border dark:border-border-dark p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={color} />
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function ConfidenceSection({ score, factors }) {
  const level = score >= 95 ? "Excellent" : score >= 85 ? "High" : score >= 70 ? "Medium" : score >= 50 ? "Low" : "Needs Review";
  const dotColor = score >= 95 ? "bg-green-500" : score >= 85 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : score >= 50 ? "bg-orange-500" : "bg-red-500";
  const textColor = score >= 95 ? "text-green-600 dark:text-green-400" : score >= 85 ? "text-green-500 dark:text-green-400" : score >= 70 ? "text-amber-500 dark:text-amber-400" : score >= 50 ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
  const barColor = score >= 95 ? "bg-green-500" : score >= 85 ? "bg-green-500" : score >= 70 ? "bg-amber-500" : score >= 50 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AI Confidence</p>
        <span className={`text-xl font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className={`text-xs font-semibold ${textColor}`}>{level}</span>
        <ConfidenceBadge value={score} />
      </div>
      {factors.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">Why this confidence?</p>
          <div className="space-y-1">
            {factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 dark:text-zinc-400">{f.label}</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{f.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReferenceSection({ title, icon: Icon, color, items, emptyText, onNavigate }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
        <Icon size={12} className={`inline ${color} mr-1`} />
        {title} ({safeItems.length})
      </p>
      {safeItems.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">{emptyText || "No supporting references yet."}</p>
      ) : (
        <div className="space-y-1.5">{safeItems}</div>
      )}
    </div>
  );
}

function KnowledgeGraph({ graph, onNavigate }) {
  const nodes = [
    { key: "tickets", icon: Ticket, color: "text-blue-500", label: "Ticket Cluster", id: graph?.ticketCluster },
    { key: "signal", icon: Activity, color: "text-green-500", label: "Signal", id: graph?.signalId },
    { key: "incident", icon: Shield, color: "text-red-500", label: "Incident", id: graph?.incidentId },
    { key: "knowledge", icon: BookOpen, color: "text-amber-500", label: "Knowledge Article", id: graph?.entryId, active: true },
    { key: "linear", icon: ExternalLink, color: "text-indigo-500", label: "Linear Issue", id: graph?.linearIssueId },
  ];
  const visible = nodes.filter((n) => n.id);
  if (visible.length < 2) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">Knowledge Relationships</p>
      <div className="rounded-xl border border-border dark:border-border-dark bg-zinc-50/50 dark:bg-[#18181B] p-4">
        <div className="flex flex-col items-center gap-1">
          {visible.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={n.key} className="flex flex-col items-center">
                <button
                  onClick={() => onNavigate?.(n.key, n.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${n.active ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" : "bg-white dark:bg-[#202024] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#27272A]"}`}
                >
                  <Icon size={12} className={n.color} />
                  {n.label}
                </button>
                {i < visible.length - 1 && <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-600" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function generateSummary(entry, tickets, signals, incident) {
  if (entry.summary) return entry.summary;
  const tkts = Array.isArray(tickets) ? tickets : [];
  const sigs = Array.isArray(signals) ? signals : [];
  const tc = tkts.length;
  const sc = sigs.length;
  const custCount = new Set(tkts.map((t) => t.customer_email || t.customer_name).filter(Boolean)).size;
  const severity = incident?.severity || entry.severity || "medium";
  const resolvedCount = tkts.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const resolution = entry.resolution || incident?.resolution_notes || "";
  const rc = entry.root_cause || incident?.root_cause || "";
  const parts = [];
  parts.push(`An issue affecting ${custCount || tc} customer${custCount !== 1 ? "s" : ""} was identified`);
  if (rc) parts.push(`caused by ${rc.toLowerCase()}`);
  else if (entry.category) parts.push(`related to ${entry.category}`);
  parts.push(`. The incident was classified as ${severity} severity`);
  if (tc > 0) parts.push(`with ${tc} related support ticket${tc !== 1 ? "s" : ""}`);
  if (sc > 0) parts.push(`and ${sc} signal${sc !== 1 ? "s" : ""}`);
  if (resolvedCount > 0) parts.push(`. ${resolvedCount} ticket${resolvedCount !== 1 ? "s" : ""} have been resolved`);
  if (resolution) parts.push(` via ${resolution.slice(0, 80)}`);
  parts.push(".");
  return parts.join(" ");
}

function generateRootCause(entry, incident, tickets) {
  if (entry.root_cause && entry.root_cause.length > 30) return entry.root_cause;
  const tkts = Array.isArray(tickets) ? tickets : [];
  const parts = [];
  if (incident?.root_cause) parts.push(incident.root_cause);
  else if (incident?.description) parts.push(incident.description);
  else if (incident?.title) parts.push(`Root cause analysis for: ${incident.title}`);
  if (tkts.length > 0) {
    const bodies = tkts.map((t) => t.body || t.description || "").filter(Boolean);
    if (bodies.length > 0) {
      const common = bodies.slice(0, 3).join("; ");
      parts.push(`Evidence from ${tkts.length} related ticket${tkts.length !== 1 ? "s" : ""}: ${common.slice(0, 200)}`);
    }
  }
  if (entry.category) parts.push(`Category: ${entry.category}`);
  if (entry.tags && entry.tags.length > 0) parts.push(`Tags: ${entry.tags.join(", ")}`);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function generateBusinessImpact(entry, tickets, incident) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const custEmails = new Set(tkts.map((t) => t.customer_email).filter(Boolean));
  const custNames = new Set(tkts.map((t) => t.customer_name).filter(Boolean));
  const affected = Math.max(custEmails.size, custNames.size, tkts.length > 0 ? 1 : 0);
  const sev = incident?.severity || entry.severity || "medium";
  const resolved = tkts.filter((t) => t.status === "resolved" || t.status === "closed");
  let resHours = 0;
  if (resolved.length > 0) {
    const durations = resolved.map((t) => t.created_at && t.updated_at ? (new Date(t.updated_at) - new Date(t.created_at)) / 3600000 : 0).filter(Boolean);
    resHours = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10 : 0;
  }
  const customersAffected = entry.customers_affected || affected;
  const resolutionTime = entry.resolution_time_hours || resHours;
  const severityScore = { critical: 5, urgent: 4, high: 3, medium: 2, low: 1 }[sev] || 2;
  const revenueRiskScore = (customersAffected * severityScore) + (resolutionTime > 0 ? Math.round(resolutionTime) : 0);
  const revenueRisk = revenueRiskScore >= 20 ? "High" : revenueRiskScore >= 8 ? "Medium" : "Low";
  return { affectedCustomers: affected, relatedTickets: tkts.length, resolutionTime: resHours, severity: sev, revenueRisk };
}

function generateTechnicalImpact(entry, tickets, signals) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const sigs = Array.isArray(signals) ? signals : [];
  const parts = [];
  const categories = new Set(tkts.map((t) => t.category).filter(Boolean));
  const tags = new Set();
  tkts.forEach((t) => (t.tags || []).forEach((tag) => tags.add(tag)));
  sigs.forEach((s) => (s.tags || []).forEach((tag) => tags.add(tag)));
  if (entry.category) categories.add(entry.category);
  if (categories.size > 0) parts.push(`Affected system${categories.size > 1 ? "s" : ""}: ${[...categories].join(", ")}`);
  if (tags.size > 0) parts.push(`Technical tag${tags.size > 1 ? "s" : ""}: ${[...tags].join(", ")}`);
  if (tkts.length > 0) {
    const urgent = tkts.filter((t) => t.priority === "urgent" || t.priority === "critical" || t.priority === "high");
    if (urgent.length > 0) parts.push(`${urgent.length} high-priority ticket${urgent.length !== 1 ? "s" : ""} reported`);
  }
  if (entry.root_cause) parts.push(`System behavior: ${entry.root_cause.slice(0, 120)}`);
  return parts.length > 0 ? parts.join("\n") : null;
}

function generateCustomerImpact(entry, tickets) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const custNames = [...new Set(tkts.map((t) => t.customer_name).filter(Boolean))];
  const custEmails = [...new Set(tkts.map((t) => t.customer_email).filter(Boolean))];
  const parts = [];
  if (custNames.length > 0) parts.push(`Affected customer${custNames.length > 1 ? "s" : ""}: ${custNames.slice(0, 5).join(", ")}${custNames.length > 5 ? ` and ${custNames.length - 5} more` : ""}`);
  else if (custEmails.length > 0) parts.push(`Affected account${custEmails.length > 1 ? "s" : ""}: ${custEmails.slice(0, 5).join(", ")}`);
  const statuses = {};
  tkts.forEach((t) => { const s = t.status || "unknown"; statuses[s] = (statuses[s] || 0) + 1; });
  const statusStr = Object.entries(statuses).map(([s, c]) => `${c} ${s}`).join(", ");
  if (statusStr) parts.push(`Ticket status: ${statusStr}`);
  const bodies = tkts.map((t) => t.body || "").filter((b) => b.length > 10);
  if (bodies.length > 0) {
    const complaints = bodies.slice(0, 3).map((b) => b.slice(0, 100)).join("\n");
    parts.push(`Customer feedback summary:\n${complaints}`);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

function generatePreventiveActions(entry, incident, tickets) {
  if (entry.preventive_actions) return entry.preventive_actions;
  const tkts = Array.isArray(tickets) ? tickets : [];
  const actions = [];
  const categories = new Set(tkts.map((t) => t.category).filter(Boolean));
  if (entry.category) categories.add(entry.category);
  if (entry.root_cause) {
    const rc = entry.root_cause.toLowerCase();
    if (rc.includes("timeout") || rc.includes("latency")) actions.push("Implement connection retry logic with exponential backoff");
    if (rc.includes("auth") || rc.includes("oauth") || rc.includes("token")) actions.push("Improve authentication token refresh and validation");
    if (rc.includes("db") || rc.includes("database") || rc.includes("query")) actions.push("Optimize database queries and add connection pooling");
    if (rc.includes("api") || rc.includes("endpoint")) actions.push("Add API rate limiting and circuit breaker pattern");
    if (rc.includes("memory") || rc.includes("leak")) actions.push("Implement memory leak detection and automated heap dump analysis");
    if (rc.includes("config") || rc.includes("deploy")) actions.push("Add configuration validation in CI/CD pipeline");
    if (rc.includes("network") || rc.includes("dns")) actions.push("Add redundant network paths and DNS failover");
    if (rc.includes("cache")) actions.push("Implement cache warming strategy and stale cache invalidation");
  }
  if (categories.has("billing") || categories.has("payment")) actions.push("Add payment gateway monitoring and automatic retry on failure");
  if (categories.has("security")) actions.push("Schedule security audit and penetration testing");
  if (categories.has("performance") || categories.has("scaling")) actions.push("Implement auto-scaling policies based on traffic patterns");
  actions.push("Add monitoring alerts for early detection of similar patterns");
  actions.push("Update runbook with incident response procedures");
  if (actions.length < 3) actions.push("Schedule post-mortem review with engineering team");
  return actions.map((a, i) => `${i + 1}. ${a}`).join("\n");
}

function generateLessonsLearned(entry, incident, tickets) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const lessons = [];
  if (tkts.length > 0) {
    const first = tkts[0];
    if (first?.created_at) {
      const last = tkts[tkts.length - 1];
      if (last?.updated_at) {
        const span = Math.round((new Date(last.updated_at) - new Date(first.created_at)) / 3600000 * 10) / 10;
        if (span > 0) lessons.push(`Total time to resolution: ${span} hours across ${tkts.length} tickets.`);
      }
    }
  }
  if (entry.root_cause) {
    lessons.push("Early detection of similar patterns could reduce resolution time.");
    lessons.push("Cross-team communication should be established at first escalation trigger.");
  }
  if (incident?.linearIssueId) lessons.push("Engineering handoff was required — improve signal-to-incident automation to reduce manual escalation.");
  lessons.push("Post-incident documentation should be completed within 24 hours of resolution.");
  lessons.push("All customer communications should be reviewed and approved before sending.");
  return lessons.length > 0 ? lessons.map((l, i) => `${i + 1}. ${l}`).join("\n") : null;
}

function generateMonitoring(entry, tickets) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const recs = [];
  const categories = new Set(tkts.map((t) => t.category).filter(Boolean));
  if (entry.category) categories.add(entry.category);
  if (entry.root_cause) {
    const rc = entry.root_cause.toLowerCase();
    if (rc.includes("timeout") || rc.includes("latency")) recs.push("Monitor API response times at p95 and p99 percentiles");
    if (rc.includes("error") || rc.includes("fail")) recs.push("Track error rate by endpoint and trigger alert at >1% threshold");
    if (rc.includes("auth") || rc.includes("login")) recs.push("Monitor authentication failure rate per user and per IP");
    if (rc.includes("db") || rc.includes("database")) recs.push("Set query performance baseline and alert on regressions >20%");
  }
  if (categories.has("billing")) recs.push("Monitor payment success rate and transaction failure patterns");
  if (categories.has("performance")) recs.push("Track system resource utilization (CPU, memory, disk I/O)");
  if (categories.has("security")) recs.push("Alert on unusual access patterns and failed authentication attempts");
  recs.push("Create dashboard for real-time monitoring of related metrics");
  recs.push("Set up weekly report on incident trends and resolution SLAs");
  return recs.length > 0 ? recs.map((r, i) => `${i + 1}. ${r}`).join("\n") : null;
}

function computeConfidence(entry, tickets, signals, incident, hasEngineeringConfirm) {
  const tkts = Array.isArray(tickets) ? tickets : [];
  const sigs = Array.isArray(signals) ? signals : [];
  const factors = [];

  const resolvedTickets = tkts.filter((t) => t.status === "resolved" || t.status === "closed");
  const ticketScore = Math.min(30, resolvedTickets.length * 2);
  factors.push({ label: `Resolved tickets (30%)`, value: `${resolvedTickets.length} (${ticketScore}%)` });

  const incidentScore = incident ? Math.min(20, 20) : Math.min(20, 0);
  factors.push({ label: `Linked incidents (20%)`, value: `${incident ? 1 : 0} (${incidentScore}%)` });

  const signalScore = Math.min(15, sigs.length * 5);
  factors.push({ label: `Linked signals (15%)`, value: `${sigs.length} (${signalScore}%)` });

  const recurrence = Math.min(10, resolvedTickets.length);
  factors.push({ label: `Historical recurrence (10%)`, value: `${resolvedTickets.length} occurrences (${recurrence}%)` });

  const hasRC = entry.root_cause && entry.root_cause.length > 10;
  const rcMatches = tkts.filter((t) => {
    if (!entry.root_cause) return false;
    const q = entry.root_cause.toLowerCase();
    return (t.title || "").toLowerCase().includes(q) || (t.body || "").toLowerCase().includes(q);
  }).length;
  const rcScore = hasRC ? Math.min(10, 3 + rcMatches * 2) : 2;
  factors.push({ label: `Root cause similarity (10%)`, value: `${rcMatches} matches (${rcScore}%)` });

  const hasHumanVerification = entry.verified_by || entry.verified_at;
  const humanScore = hasHumanVerification ? 10 : 5;
  factors.push({ label: `Human verification (10%)`, value: hasHumanVerification ? "Verified (10%)" : "Auto-generated (5%)" });

  const engScore = hasEngineeringConfirm ? 5 : 0;
  factors.push({ label: `Engineering confirmation (5%)`, value: hasEngineeringConfirm ? "Confirmed (5%)" : "Pending (0%)" });

  const raw = ticketScore + incidentScore + signalScore + recurrence + rcScore + humanScore + engScore;
  return { score: Math.min(100, Math.max(5, raw)), factors };
}

export default function KnowledgeDrawer({ entry, onClose }) {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  const [relatedTickets, setRelatedTickets] = useState([]);
  const [relatedSignals, setRelatedSignals] = useState([]);
  const [relatedIncident, setRelatedIncident] = useState(null);
  const [relatedLinear, setRelatedLinear] = useState(null);
  const [allTickets, setAllTickets] = useState([]);
  const [allSignals, setAllSignals] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allKnowledge, setAllKnowledge] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState({ viewCount: 0, timesSuggested: 0, timesUsed: 0, referenceCount: 0, lastUsed: null });

  const recordView = useCallback(async () => {
    try {
      await client.records.create("audit_logs", {
        action: "knowledge.viewed",
        actor: "System",
        resource_type: "knowledge",
        resource_id: entry.id,
        details: { title: entry.title },
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      });
    } catch {}
  }, [entry, workspace]);

  useEffect(() => {
    if (!entry) return;
    recordView();
  }, [entry?.id]);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimerRef = useRef(null);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    refreshTimerRef.current = setInterval(handleRefresh, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [handleRefresh]);

  useEffect(() => {
    if (!entry) return;
    let mounted = true;
    setLoading(true);

    const load = async () => {
      const filters = workspaceFilter(workspace.id);
      const fetchAll = async (table) => {
        try {
          const res = await client.records.list(table, { limit: 500, filters });
          return res.items || res.records || res.data || [];
        } catch { return []; }
      };

      const [allTkts, allSigs, allIncs, allLogs, allKn] = await Promise.all([
        fetchAll("tickets"),
        fetchAll("signals"),
        fetchAll("incidents"),
        fetchAll("audit_logs"),
        fetchAll("memory_entries"),
      ]);

      if (!mounted) return;
      setAllTickets(allTkts);
      setAllSignals(allSigs);
      setAllIncidents(allIncs);
      setAuditLogs(allLogs);
      setAllKnowledge(allKn);

      const sigIds = new Set();
      if (entry.signal_id) sigIds.add(entry.signal_id);
      if (entry.source_signal_id) sigIds.add(entry.source_signal_id);
      (entry.signal_ids || []).forEach((id) => sigIds.add(id));

      const directSignals = allSigs.filter((s) => sigIds.has(s.id));
      const matchedSignals = allSigs.filter((s) => {
        if (sigIds.has(s.id)) return false;
        if (entry.root_cause && (s.summary || "").toLowerCase().includes((entry.root_cause || "").toLowerCase())) return true;
        const rc = entry.root_cause || "";
        if (rc && (s.name || "").toLowerCase().includes(rc.toLowerCase())) return true;
        if (entry.incident_id && s.incident_id === entry.incident_id) return true;
        if (entry.category && s.category === entry.category) return true;
        if (entry.tags && entry.tags.length > 0 && s.tags) {
          const eTags = entry.tags.map((t) => String(t).toLowerCase());
          const sTags = (Array.isArray(s.tags) ? s.tags : []).map((t) => String(t).toLowerCase());
          if (eTags.some((t) => sTags.includes(t))) return true;
        }
        const titleWords = (entry.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        if (titleWords.length > 0) {
          const sText = ((s.name || "") + " " + (s.summary || "")).toLowerCase();
          if (titleWords.some((w) => sText.includes(w))) return true;
        }
        return false;
      });
      const seenSig = new Set();
      const uniqueSignals = [...directSignals, ...matchedSignals].filter((s) => { if (seenSig.has(s.id)) return false; seenSig.add(s.id); return true; });
      const foundSignalIds = uniqueSignals.map((s) => s.id);

      let incident = null;
      if (entry.incident_id) {
        incident = allIncs.find((i) => i.id === entry.incident_id) || null;
        try { if (!incident) incident = await client.records.get("incidents", entry.incident_id).catch(() => null); } catch {}
      }
      if (!incident && entry.related_incident_id) {
        incident = allIncs.find((i) => i.id === entry.related_incident_id) || null;
        try { if (!incident) incident = await client.records.get("incidents", entry.related_incident_id).catch(() => null); } catch {}
      }

      const relTkts = allTkts.filter((t) => {
        if (entry.ticket_ids && entry.ticket_ids.includes(t.id)) return true;
        if (entry.signal_id && t.signal_id === entry.signal_id) return true;
        if (foundSignalIds.length > 0 && t.signal_id && foundSignalIds.includes(t.signal_id)) return true;
        if (entry.incident_id && t.incident_id === entry.incident_id) return true;
        if (entry.root_cause && (t.title || "").toLowerCase().includes((entry.root_cause || "").toLowerCase())) return true;
        if (entry.root_cause && (t.body || "").toLowerCase().includes((entry.root_cause || "").toLowerCase())) return true;
        if (entry.category && t.category === entry.category) return true;
        if (entry.tags && entry.tags.length > 0 && t.tags) {
          const eTags = entry.tags.map((tg) => String(tg).toLowerCase());
          const tTags = (Array.isArray(t.tags) ? t.tags : []).map((tg) => String(tg).toLowerCase());
          if (eTags.some((tg) => tTags.includes(tg))) return true;
        }
        const titleWords = (entry.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        if (titleWords.length > 0) {
          const tText = ((t.title || "") + " " + (t.body || "")).toLowerCase();
          if (titleWords.some((w) => tText.includes(w))) return true;
        }
        return false;
      });

      const linear = entry.linear_issue_id || null;
      const refCount = relTkts.length + uniqueSignals.length + (incident ? 1 : 0) + (linear ? 1 : 0);

      const eid = entry.id;
      const viewCount = allLogs.filter((l) => {
        const a = (l.action || "").toLowerCase();
        const rid = l.resource_id || l.resourceId || "";
        return (rid === eid || rid === entry.incident_id) && (a === "knowledge.viewed" || a === "knowledge.opened" || a === "knowledge.read");
      }).length;

      const timesSuggested = allLogs.filter((l) => {
        const a = (l.action || "").toLowerCase();
        const rid = l.resource_id || l.resourceId || "";
        return (rid === eid) && (a === "knowledge.suggested" || a === "knowledge.referenced");
      }).length;

      const timesUsed = allLogs.filter((l) => {
        const a = (l.action || "").toLowerCase();
        const rid = l.resource_id || l.resourceId || "";
        return (rid === eid) && (a === "knowledge.used" || a === "knowledge.applied");
      }).length;

      const usageLogs = allLogs.filter((l) => {
        const a = (l.action || "").toLowerCase();
        const rid = l.resource_id || l.resourceId || "";
        return (rid === eid) && (a.includes("knowledge") || a.includes("use") || a.includes("reference"));
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const lastUsed = usageLogs.length > 0 ? usageLogs[0].created_at : null;

      if (mounted) {
        setRelatedTickets(relTkts);
        setRelatedSignals(uniqueSignals);
        setRelatedIncident(incident);
        setRelatedLinear(linear);
        setUsageStats({ viewCount, timesSuggested, timesUsed, referenceCount: refCount, lastUsed });
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [entry, workspace.id, refreshKey]);

  const businessImpact = useMemo(() => generateBusinessImpact(entry, relatedTickets, relatedIncident), [entry, relatedTickets, relatedIncident]);
  const summaryText = useMemo(() => generateSummary(entry, relatedTickets, relatedSignals, relatedIncident), [entry, relatedTickets, relatedSignals, relatedIncident]);
  const rootCauseText = useMemo(() => generateRootCause(entry, relatedIncident, relatedTickets), [entry, relatedIncident, relatedTickets]);
  const techImpactText = useMemo(() => generateTechnicalImpact(entry, relatedTickets, relatedSignals), [entry, relatedTickets, relatedSignals]);
  const custImpactText = useMemo(() => generateCustomerImpact(entry, relatedTickets), [entry, relatedTickets]);
  const resolutionText = useMemo(() => {
    if (entry.resolution) return entry.resolution;
    if (relatedIncident?.resolution_notes) return relatedIncident.resolution_notes;
    const tkts = Array.isArray(relatedTickets) ? relatedTickets : [];
    const bodies = tkts.filter((t) => t.status === "resolved").map((t) => t.body || "").filter(Boolean);
    if (bodies.length > 0) return bodies.slice(0, 3).join("\n---\n");
    return null;
  }, [entry, relatedIncident, relatedTickets]);
  const prevActionsText = useMemo(() => generatePreventiveActions(entry, relatedIncident, relatedTickets), [entry, relatedIncident, relatedTickets]);
  const lessonsText = useMemo(() => generateLessonsLearned(entry, relatedIncident, relatedTickets), [entry, relatedIncident, relatedTickets]);
  const monitoringText = useMemo(() => generateMonitoring(entry, relatedTickets), [entry, relatedTickets]);

  const hasEngConfirm = relatedIncident?.linearStatus === "done" || relatedIncident?.linearStatus === "resolved";
  const confidence = useMemo(() => computeConfidence(entry, relatedTickets, relatedSignals, relatedIncident, hasEngConfirm), [entry, relatedTickets, relatedSignals, relatedIncident, hasEngConfirm]);

  const relatedAuditEvents = useMemo(() => {
    const eid = entry.id;
    return (Array.isArray(auditLogs) ? auditLogs : []).filter((l) => {
      const rid = l.resource_id || l.resourceId || "";
      return rid === eid || rid === entry.incident_id;
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
  }, [auditLogs, entry]);

  const relatedKnowledgeArticles = useMemo(() => {
    const kn = Array.isArray(allKnowledge) ? allKnowledge : [];
    const eid = entry?.id;
    return kn.filter((k) => {
      if (k.id === eid) return false;
      if (entry.root_cause && k.root_cause && k.root_cause.toLowerCase().includes(entry.root_cause.toLowerCase())) return true;
      if (entry.category && k.category === entry.category) return true;
      if (entry.incident_id && k.incident_id === entry.incident_id) return true;
      if (entry.tags && k.tags) {
        const eTags = entry.tags.map((t) => String(t).toLowerCase());
        const kTags = (Array.isArray(k.tags) ? k.tags : []).map((t) => String(t).toLowerCase());
        if (eTags.some((t) => kTags.includes(t))) return true;
      }
      return false;
    }).slice(0, 3);
  }, [allKnowledge, entry]);

  const graph = useMemo(() => {
    const tkts = Array.isArray(relatedTickets) ? relatedTickets : [];
    const sigs = Array.isArray(relatedSignals) ? relatedSignals : [];
    return {
      ticketCluster: tkts.length > 0 ? tkts[0]?.id : null,
      signalId: sigs.length > 0 ? sigs[0]?.id : null,
      incidentId: relatedIncident?.id || null,
      entryId: entry?.id || null,
      linearIssueId: relatedLinear || null,
    };
  }, [relatedTickets, relatedSignals, relatedIncident, relatedLinear, entry]);

  const timelineEvents = useMemo(() => {
    const events = [];
    const tkts = Array.isArray(relatedTickets) ? relatedTickets : [];
    const sigs = Array.isArray(relatedSignals) ? relatedSignals : [];

    if (entry.created_at) {
      events.push({ type: "knowledge", time: entry.created_at, label: "Knowledge article created", icon: BookOpen, color: "bg-amber-500", detail: entry.title });
    }
    if (entry.captured_at) {
      events.push({ type: "capture", time: entry.captured_at, label: "Issue captured", icon: Activity, color: "bg-green-500", detail: "Pattern recorded in knowledge base" });
    }
    if (entry.updated_at && entry.updated_at !== entry.created_at) {
      events.push({ type: "update", time: entry.updated_at, label: "Article updated", icon: RefreshCw, color: "bg-blue-500" });
    }
    if (relatedIncident?.created_at) {
      events.push({ type: "incident", time: relatedIncident.created_at, label: "Incident created", icon: Shield, color: "bg-red-500", detail: relatedIncident.title });
    }
    if (relatedIncident?.resolved_at) {
      events.push({ type: "resolved", time: relatedIncident.resolved_at, label: "Incident resolved", icon: CheckCircle2, color: "bg-green-500" });
    }
    sigs.forEach((s) => {
      if (s.detected_at) {
        events.push({ type: "signal", time: s.detected_at, label: "Signal detected", icon: Activity, color: "bg-green-500", detail: s.name || s.summary });
      }
    });
    tkts.forEach((t) => {
      if (t.created_at) {
        events.push({ type: "ticket", time: t.created_at, label: "Ticket created", icon: Ticket, color: "bg-blue-500", detail: t.title });
      }
      if (t.updated_at && t.status === "resolved") {
        events.push({ type: "ticket_resolved", time: t.updated_at, label: "Ticket resolved", icon: CheckCircle2, color: "bg-green-500", detail: t.title });
      }
    });
    events.sort((a, b) => new Date(a.time) - new Date(b.time));
    return events;
  }, [entry, relatedTickets, relatedSignals, relatedIncident]);

  const operationalImpact = useMemo(() => {
    const tkts = Array.isArray(relatedTickets) ? relatedTickets : [];
    const sigs = Array.isArray(relatedSignals) ? relatedSignals : [];
    const totalTickets = tkts.length;
    const totalSignals = sigs.length;
    const openTickets = tkts.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
    const sev = relatedIncident?.severity || entry.severity || "medium";
    const severityScore = { critical: 5, urgent: 4, high: 3, medium: 2, low: 1 }[sev] || 2;
    const impactScore = (totalTickets * 2) + (totalSignals * 3) + (openTickets * 1) + severityScore;
    if (impactScore >= 15) return "Critical";
    if (impactScore >= 8) return "Significant";
    if (impactScore >= 4) return "Moderate";
    return "Low";
  }, [relatedTickets, relatedSignals, relatedIncident, entry]);

  const wsTerm = useMemo(() => {
    const name = workspace?.name || "Workspace";
    const kn = workspace?.knowledge;
    return {
      articleLabel: kn?.title || "Knowledge Base",
      ticketsLabel: workspace?.kpi?.openTickets?.replace("Open ", "") || "Tickets",
      signalsLabel: workspace?.kpi?.activeSignals?.replace("Active ", "") || "Signals",
      incidentsLabel: workspace?.kpi?.criticalIncidents?.replace("Critical ", "") || "Incidents",
      subtitle: kn?.subtitle || "Organizational memory",
    };
  }, [workspace]);

  const handleNavigate = (type, id) => {
    if (!id) return;
    switch (type) {
      case "tickets":
        navigate("/tickets", { state: { focusTicketId: id } });
        break;
      case "signal":
        navigate("/signals");
        break;
      case "incident":
        navigate("/incidents");
        break;
      case "linear":
        window.open(`https://linear.app/issue/${id}`, "_blank", "noopener,noreferrer");
        break;
      case "knowledge":
        navigate("/knowledge");
        break;
      default:
        break;
    }
    onClose();
  };

  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="relative flex h-full w-full max-w-[600px] flex-col bg-white dark:bg-[#111113] border-l border-border dark:border-border-dark shadow-2xl">
        <div className="flex-shrink-0 border-b border-border dark:border-border-dark bg-white dark:bg-[#111113] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={15} className="text-amber-500" />
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{wsTerm.articleLabel}</span>
                <ConfidenceBadge value={confidence.score} />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug">{entry.title || "Untitled Article"}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleRefresh} title="Refresh data"
                className="flex-shrink-0 rounded-lg p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors">
                <RefreshCw size={16} />
              </button>
              <button onClick={onClose}
                className="flex-shrink-0 rounded-lg p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
            {entry.category && (
              <span className="rounded-md bg-zinc-100 dark:bg-[#202024] px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{entry.category}</span>
            )}
            {entry.created_at && <span className="flex items-center gap-1"><Calendar size={12} />Created {format(new Date(entry.created_at), "MMM d, yyyy")}</span>}
            {entry.updated_at && <span className="flex items-center gap-1">Updated {format(new Date(entry.updated_at), "MMM d, yyyy")}</span>}
            <span className="flex items-center gap-1"><Hash size={12} />{usageStats.referenceCount} references</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-zinc-400 dark:text-zinc-500" /></div>
          ) : (
            <>
              <DetailSection title="Executive Summary" content={summaryText} />
              <DetailSection title="Detailed Root Cause" content={rootCauseText} />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Business Impact</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <ImpactCard icon={Users} color="text-blue-500" label="Customers Affected" value={businessImpact.affectedCustomers} />
                  <ImpactCard icon={FileText} color="text-violet-500" label="Related Tickets" value={businessImpact.relatedTickets} />
                  <ImpactCard icon={Clock} color="text-cyan-500" label="Resolution Time" value={businessImpact.resolutionTime > 0 ? `${businessImpact.resolutionTime}h` : "\u2014"} />
                  <ImpactCard icon={Shield} color={businessImpact.severity === "critical" || businessImpact.severity === "urgent" ? "text-red-500" : "text-amber-500"} label="Severity" value={businessImpact.severity.charAt(0).toUpperCase() + businessImpact.severity.slice(1)} />
                  <ImpactCard icon={DollarSign} color={businessImpact.revenueRisk === "High" ? "text-red-500" : businessImpact.revenueRisk === "Medium" ? "text-amber-500" : "text-green-500"} label="Revenue Risk" value={businessImpact.revenueRisk} />
                  <ImpactCard icon={Zap} color={operationalImpact === "Critical" ? "text-red-500" : operationalImpact === "Significant" ? "text-orange-500" : "text-amber-500"} label="Operational Impact" value={operationalImpact} />
                </div>
              </div>

              <DetailSection title="Technical Impact" content={techImpactText} />
              <DetailSection title="Customer Impact" content={custImpactText} />
              <DetailSection title="Resolution" content={resolutionText} />
              <DetailSection title="Preventive Actions" content={prevActionsText} />
              <DetailSection title="Lessons Learned" content={lessonsText} />
              <DetailSection title="Recommended Monitoring" content={monitoringText} />

              {timelineEvents.length >= 2 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Timeline</p>
                  <div className="rounded-xl border border-border dark:border-border-dark bg-zinc-50/50 dark:bg-[#18181B] p-4">
                    {timelineEvents.map((evt, i) => (
                      <TimelineEvent key={i} icon={evt.icon} color={evt.color} time={evt.time}
                        label={evt.label} detail={evt.detail} isLast={i === timelineEvents.length - 1} />
                    ))}
                  </div>
                </div>
              )}

              <ConfidenceSection score={confidence.score} factors={confidence.factors} />

              <ReferenceSection title={"Related " + wsTerm.ticketsLabel} icon={FileText} color="text-blue-500"
                items={relatedTickets.slice(0, 8).map((t) => (
                  <RefItem key={t.id} icon={FileText} color="text-blue-400" id={t.id} title={t.title || t.customer_name || t.id}
                    status={t.status} priority={t.priority} date={t.created_at}
                    onClick={() => handleNavigate("tickets", t.id)} />
                ))}
                emptyText="No related tickets yet."
              />

              <ReferenceSection title={"Related " + wsTerm.signalsLabel} icon={Activity} color="text-green-500"
                items={relatedSignals.slice(0, 5).map((s) => (
                  <RefItem key={s.id} icon={Activity} color="text-green-400" id={s.id} title={s.name || s.summary || s.id}
                    status={s.status} priority={s.proposed_priority} date={s.detected_at}
                    onClick={() => handleNavigate("signal", s.id)} />
                ))}
                emptyText="No related signals yet."
              />

              <ReferenceSection title={"Related " + wsTerm.incidentsLabel} icon={Shield} color="text-red-500"
                items={relatedIncident ? [
                  <RefItem key={relatedIncident.id} icon={Shield} color="text-red-400" id={relatedIncident.id} title={relatedIncident.title || relatedIncident.id}
                    status={relatedIncident.status} priority={relatedIncident.severity} date={relatedIncident.created_at}
                    onClick={() => handleNavigate("incident", relatedIncident.id)} />
                ] : []}
                emptyText="No related incidents yet."
              />

              {relatedLinear && (
                <ReferenceSection title="Related Linear Issues" icon={ExternalLink} color="text-indigo-500"
                  items={[
                    <RefItem key={relatedLinear} icon={ExternalLink} color="text-indigo-400" id={relatedLinear} title={relatedLinear}
                      onClick={() => handleNavigate("linear", relatedLinear)} />
                  ]}
                />
              )}

              <ReferenceSection title="Related Audit Events" icon={Eye} color="text-zinc-500"
                items={relatedAuditEvents.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">{(l.action || "event").replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                      {l.created_at && <span className="ml-2 text-[10px] text-zinc-400 dark:text-zinc-500">{format(new Date(l.created_at), "MMM d, HH:mm")}</span>}
                    </span>
                  </div>
                ))}
                emptyText="No audit events recorded yet."
              />

              <ReferenceSection title={"Related " + wsTerm.articleLabel} icon={BookOpen} color="text-amber-500"
                items={relatedKnowledgeArticles.map((k) => (
                  <button key={k.id}
                    onClick={() => handleNavigate("knowledge", k.id)}
                    className="flex w-full items-center gap-2 rounded-lg bg-zinc-50 dark:bg-[#202024] px-3 py-2 transition hover:bg-zinc-100 dark:hover:bg-[#27272A] text-left">
                    <BookOpen size={13} className="text-amber-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50 truncate block">{k.title || "Untitled"}</span>
                    </div>
                    {k.confidence != null && <ConfidenceBadge value={k.confidence} />}
                  </button>
                ))}
                emptyText="No related knowledge articles yet."
              />

              <KnowledgeGraph graph={graph} onNavigate={handleNavigate} />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Usage Statistics</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatRow icon={Hash} label="References" value={usageStats.referenceCount} />
                  <StatRow icon={Eye} label="Views" value={usageStats.viewCount} />
                  <StatRow icon={Lightbulb} label="Times Suggested" value={usageStats.timesSuggested} />
                  <StatRow icon={CheckCircle2} label="Times Used" value={usageStats.timesUsed} />
                  <StatRow icon={Clock} label="Last Used" value={usageStats.lastUsed ? format(new Date(usageStats.lastUsed), "MMM d, yyyy") : "Never"} />
                  <StatRow icon={Brain} label="Confidence" value={`${confidence.score}%`} />
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
