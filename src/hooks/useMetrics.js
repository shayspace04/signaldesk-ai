import { useMemo, useCallback } from "react";
import { useLemmaRecords } from "./useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import { workspaceFilter } from "@/lib/workspaceConfig";
import { format } from "date-fns";
import { calculateChurnRisk } from "@/lib/churnRisk";
import { deriveWorkflowStage } from "@/lib/workflowStage";

function pctChange(current, previous) {
  if (previous <= 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`;
}

function periodBounds(filter) {
  const now = Date.now();
  switch (filter) {
    case "today":
      return { cs: new Date().setHours(0, 0, 0, 0), ce: now, ps: now - 86400000, pe: now };
    case "7d":
      return { cs: now - 7 * 86400000, ce: now, ps: now - 14 * 86400000, pe: now - 7 * 86400000 };
    case "30d":
      return { cs: now - 30 * 86400000, ce: now, ps: now - 60 * 86400000, pe: now - 30 * 86400000 };
    case "90d":
      return { cs: now - 90 * 86400000, ce: now, ps: now - 180 * 86400000, pe: now - 90 * 86400000 };
    default:
      return null;
  }
}

function timeRange(records, field, start, end) {
  if (start == null) return records;
  return records.filter((r) => {
    if (!r[field]) return false;
    const t = new Date(r[field]).getTime();
    return t >= start && (end == null || t < end);
  });
}

export function useMetrics(workspaceId, options = {}) {
  const { timeFilter = "all", searchQuery = "" } = options;

  const metricsFilter = useMemo(() => workspaceFilter(workspaceId), [workspaceId]);

  const tHook = useLemmaRecords("tickets", { limit: 10000, filters: metricsFilter });
  const sHook = useLemmaRecords("signals", { limit: 1000, filters: metricsFilter });
  const iHook = useLemmaRecords("incidents", { limit: 500, filters: metricsFilter });
  const dHook = useLemmaRecords("drafts", { limit: 500, filters: metricsFilter });
  const aHook = useLemmaRecords("audit_logs", { limit: 500, sort: [{ field: "created_at", direction: "desc" }], filters: metricsFilter });
  const kHook = useLemmaRecords("memory_entries", { limit: 500, filters: metricsFilter });

  useRefreshListener(() => {
    tHook.refresh(); sHook.refresh(); iHook.refresh(); dHook.refresh(); aHook.refresh(); kHook.refresh();
  });

  const loading = tHook.loading || sHook.loading || iHook.loading || dHook.loading || aHook.loading || kHook.loading;

  const allTickets = tHook.data || [];
  const allSignals = sHook.data || [];
  const allIncidents = iHook.data || [];
  const allDrafts = dHook.data || [];
  const allLogs = aHook.data || [];
  const allKnowledge = kHook.data || [];

  const bounds = useMemo(() => periodBounds(timeFilter), [timeFilter]);

  const curT = useMemo(() => timeRange(allTickets, "created_at", bounds?.cs, bounds?.ce), [allTickets, bounds]);
  const curS = useMemo(() => timeRange(allSignals, "detected_at", bounds?.cs, bounds?.ce), [allSignals, bounds]);
  const curI = useMemo(() => timeRange(allIncidents, "created_at", bounds?.cs, bounds?.ce), [allIncidents, bounds]);
  const curD = useMemo(() => timeRange(allDrafts, "created_at", bounds?.cs, bounds?.ce), [allDrafts, bounds]);
  const curL = useMemo(() => timeRange(allLogs, "created_at", bounds?.cs, bounds?.ce), [allLogs, bounds]);
  const curK = useMemo(() => timeRange(allKnowledge, "captured_at", bounds?.cs, bounds?.ce), [allKnowledge, bounds]);

  const prevT = useMemo(() => bounds ? timeRange(allTickets, "created_at", bounds.ps, bounds.pe) : [], [allTickets, bounds]);
  const prevS = useMemo(() => bounds ? timeRange(allSignals, "detected_at", bounds.ps, bounds.pe) : [], [allSignals, bounds]);
  const prevI = useMemo(() => bounds ? timeRange(allIncidents, "created_at", bounds.ps, bounds.pe) : [], [allIncidents, bounds]);
  const prevD = useMemo(() => bounds ? timeRange(allDrafts, "created_at", bounds.ps, bounds.pe) : [], [allDrafts, bounds]);
  const prevK = useMemo(() => bounds ? timeRange(allKnowledge, "captured_at", bounds.ps, bounds.pe) : [], [allKnowledge, bounds]);

  const sf = useCallback((records, fields) => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => fields.some((f) => (r[f] || "").toLowerCase().includes(q)));
  }, [searchQuery]);

  const sT = useMemo(() => sf(curT, ["title", "customer_name", "customer_email", "id"]), [curT, sf]);
  const sS = useMemo(() => sf(curS, ["name", "summary", "category", "id"]), [curS, sf]);
  const sI = useMemo(() => sf(curI, ["title", "summary", "id"]), [curI, sf]);
  const sL = useMemo(() => sf(curL, ["action", "actor_agent_name", "actor_type", "id"]), [curL, sf]);
  const sD = useMemo(() => sf(curD, ["body", "ticket_number", "id"]), [curD, sf]);
  const sK = useMemo(() => sf(curK, ["title", "summary", "root_cause", "resolution", "id"]), [curK, sf]);

  const ticketMetrics = useMemo(() => {
    const open = allTickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
    const resolved = allTickets.filter((t) => t.status === "resolved");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resolvedToday = resolved.filter((t) => t.updated_at && new Date(t.updated_at) >= today);
    const resolvedYesterday = resolved.filter((t) => {
      if (!t.updated_at) return false;
      const d = new Date(t.updated_at);
      const y = new Date(today.getTime() - 86400000);
      return d >= y && d < today;
    });
    const critical = allTickets.filter((t) => t.priority === "urgent" || t.priority === "critical" || t.priority === "high");
    const urgent = allTickets.filter((t) => t.priority === "urgent");

    const resDur = resolved.filter((t) => t.created_at && t.updated_at);
    const avgResTime = resDur.length > 0
      ? resDur.reduce((s, t) => s + (new Date(t.updated_at) - new Date(t.created_at)) / 3600000, 0) / resDur.length
      : 0;

    const ticketsWithDrafts = curT.filter((t) => curD.some((d) => d.ticket_id === t.id));
    let avgRespTime = 0;
    if (ticketsWithDrafts.length > 0) {
      let total = 0, count = 0;
      ticketsWithDrafts.forEach((t) => {
        const d = curD.find((d) => d.ticket_id === t.id);
        if (d && t.created_at && d.created_at) {
          total += (new Date(d.created_at) - new Date(t.created_at)) / 3600000;
          count++;
        }
      });
      avgRespTime = count > 0 ? total / count : 0;
    }

    const draftTicketIds = new Set(curD.map((d) => d.ticket_id));
    const waitingReply = open.filter((t) => !draftTicketIds.has(t.id));

    const curOpen = curT.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
    const prevOpen = prevT.filter((t) => t.status !== "resolved" && t.status !== "closed").length;

    return {
      total: allTickets.length,
      totalInPeriod: curT.length,
      open: open.length,
      openTrend: bounds != null ? pctChange(curOpen, prevOpen > 0 ? prevOpen : curOpen > 0 ? 0 : 1) : null,
      resolved: resolved.length,
      resolvedToday: resolvedToday.length,
      resolvedTrend: bounds != null ? pctChange(resolvedToday.length, resolvedYesterday.length || 1) : null,
      critical: critical.length,
      urgent: urgent.length,
      urgentPct: allTickets.length > 0 ? Math.round((urgent.length / allTickets.length) * 100) : 0,
      highPct: allTickets.length > 0 ? Math.round((critical.length / allTickets.length) * 100) : 0,
      avgResolutionTime: Math.round(avgResTime * 10) / 10,
      avgResponseTime: Math.round(avgRespTime * 10) / 10,
      waitingForReply: waitingReply.length,
      trendCreation: bounds != null ? pctChange(curT.length, prevT.length) : null,
    };
  }, [allTickets, curT, prevT, curD, prevT]);

  const signalMetrics = useMemo(() => {
    const newStage = allSignals.filter((s) => deriveWorkflowStage(s) === "new" && s.status !== "rejected");
    const underReview = allSignals.filter((s) => deriveWorkflowStage(s) === "review" && s.status !== "rejected");
    const approved = allSignals.filter((s) => deriveWorkflowStage(s) === "approved");
    const incidentCreated = allSignals.filter((s) => deriveWorkflowStage(s) === "incident_created");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const createdToday = allSignals.filter((s) => s.detected_at && new Date(s.detected_at) >= today);

    return {
      total: allSignals.length,
      totalInPeriod: curS.length,
      pending: newStage.length,
      underReview: underReview.length,
      approved: approved.length,
      incidentCreated: incidentCreated.length,
      resolved: allSignals.filter((s) => s.status === "memory").length,
      createdToday: createdToday.length,
      trendCreation: bounds != null ? pctChange(curS.length, prevS.length) : null,
    };
  }, [allSignals, curS, prevS]);

  const incidentMetrics = useMemo(() => {
    const active = allIncidents.filter((i) => i.status !== "closed");
    const critical = allIncidents.filter((i) => i.severity === "urgent" || i.severity === "critical" || i.severity === "high");
    const urgent = allIncidents.filter((i) => i.severity === "urgent");
    const escalated = allIncidents.filter((i) => i.linearIssueId);
    const openLinear = escalated.filter((i) => {
      const s = (i.linearStatus || "").toLowerCase();
      return s !== "done" && s !== "resolved" && s !== "closed";
    });
    const resolvedLinear = escalated.filter((i) => {
      const s = (i.linearStatus || "").toLowerCase();
      return s === "done" || s === "resolved" || s === "closed";
    });

    let totalEscTime = 0;
    let escCount = 0;
    escalated.forEach((i) => {
      if (i.opened_at && i.linearSyncedAt) {
        totalEscTime += (new Date(i.linearSyncedAt) - new Date(i.opened_at)) / 3600000;
        escCount++;
      }
    });
    const avgEscTime = escCount > 0 ? totalEscTime / escCount : 0;

    return {
      total: allIncidents.length,
      totalInPeriod: curI.length,
      active: active.length,
      critical: critical.length,
      urgent: urgent.length,
      escalated: escalated.length,
      openLinear: openLinear.length,
      resolvedLinear: resolvedLinear.length,
      avgEscalationTime: Math.round(avgEscTime * 10) / 10,
      trendCreation: bounds != null ? pctChange(curI.length, prevI.length) : null,
    };
  }, [allIncidents, curI, prevI]);

  const draftMetrics = useMemo(() => {
    const pending = allDrafts.filter((d) => d.status === "pending" || d.status === "waiting_approval");
    const approved = allDrafts.filter((d) => d.status === "approved" || d.status === "sent");
    const rejected = allDrafts.filter((d) => d.status === "rejected");

    return {
      total: allDrafts.length,
      totalInPeriod: curD.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      trendCreation: bounds != null ? pctChange(curD.length, prevD.length) : null,
    };
  }, [allDrafts, curD, prevD]);

  const knowledgeMetrics = useMemo(() => {
    const published = allKnowledge.filter((k) => k.status === "published" || !k.status);
    const totalRefs = allKnowledge.reduce((s, k) => s + (k.reference_count || 0), 0);
    const avgConf = allKnowledge.length > 0
      ? Math.round(allKnowledge.reduce((s, k) => s + (k.confidence || 0), 0) / allKnowledge.length)
      : 0;
    const withIncident = allKnowledge.filter((k) => k.incident_id).length;
    const withSignal = allKnowledge.filter((k) => k.signal_id).length;
    const topArticles = [...allKnowledge]
      .sort((a, b) => (b.reference_count || 0) - (a.reference_count || 0))
      .slice(0, 5)
      .map((k) => ({ id: k.id, title: k.title || "Untitled", refs: k.reference_count || 0, confidence: k.confidence || 0 }));

    return {
      total: allKnowledge.length,
      totalInPeriod: curK.length,
      published: published.length,
      totalReferences: totalRefs,
      avgConfidence: avgConf,
      withIncident,
      withSignal,
      topArticles,
      trendCreation: bounds != null ? pctChange(curK.length, prevK.length) : null,
    };
  }, [allKnowledge, curK, prevK]);

  const auditMetrics = useMemo(() => {
    let unreadCount = 0;
    try {
      const readIds = new Set(JSON.parse(localStorage.getItem("signaldesk-read-notifs") || "[]"));
      unreadCount = allLogs.filter((n) => !readIds.has(n.id)).length;
    } catch {
      unreadCount = allLogs.length;
    }
    return { total: allLogs.length, totalInPeriod: curL.length, unread: unreadCount, logs: sL };
  }, [allLogs, curL, sL]);

  const dashboard = useMemo(() => ({
    openTickets: ticketMetrics.open,
    openTrend: ticketMetrics.openTrend,
    activeSignals: signalMetrics.total,
    signalTrend: signalMetrics.trendCreation,
    criticalIncidents: incidentMetrics.critical,
    incidentTrend: incidentMetrics.trendCreation,
    pendingDrafts: draftMetrics.pending,
    draftTrend: draftMetrics.trendCreation,
    resolvedToday: ticketMetrics.resolvedToday,
    resolvedTrend: ticketMetrics.resolvedTrend,
    criticalTickets: ticketMetrics.critical,
    urgentTickets: ticketMetrics.urgent,
    urgentPct: ticketMetrics.urgentPct,
    avgResolutionTime: ticketMetrics.avgResolutionTime,
    avgResponseTime: ticketMetrics.avgResponseTime,
    waitingForReply: ticketMetrics.waitingForReply,
    signalsCreatedToday: signalMetrics.createdToday,
    signalsUnderReview: signalMetrics.underReview,
    signalsResolved: signalMetrics.resolved,
    signalsApproved: signalMetrics.approved,
    incidentsActive: incidentMetrics.active,
    incidentsCritical: incidentMetrics.critical,
    incidentsResolved: incidentMetrics.resolvedLinear,
    engineeringResponseTime: null,
  }), [ticketMetrics, signalMetrics, incidentMetrics, draftMetrics]);

  const sidebar = useMemo(() => ({
    tickets: ticketMetrics.open,
    signals: signalMetrics.pending,
    incidents: incidentMetrics.active,
    drafts: draftMetrics.pending,
    unread: auditMetrics.unread,
  }), [ticketMetrics, signalMetrics, incidentMetrics, draftMetrics, auditMetrics]);

  const analytics = useMemo(() => {
    const byCat = {};
    allTickets.forEach((t) => { const c = t.category || "Uncategorized"; byCat[c] = (byCat[c] || 0) + 1; });
    const byPri = {};
    allTickets.forEach((t) => { const p = t.priority || "normal"; byPri[p] = (byPri[p] || 0) + 1; });
    const byDay = {};
    allTickets.forEach((t) => { if (t.created_at) { const d = format(new Date(t.created_at), "MMM d"); byDay[d] = (byDay[d] || 0) + 1; } });

    const sigByStatus = {};
    allSignals.forEach((s) => { const st = deriveWorkflowStage(s); if (st) sigByStatus[st] = (sigByStatus[st] || 0) + 1; });
    const sigBySev = {};
    allSignals.forEach((s) => { const sv = s.proposed_priority || s.severity || "normal"; sigBySev[sv] = (sigBySev[sv] || 0) + 1; });

    const incTrend = {};
    allIncidents.forEach((i) => { if (i.created_at) { const d = format(new Date(i.created_at), "MMM d"); incTrend[d] = (incTrend[d] || 0) + 1; } });
    const incByStatus = {};
    allIncidents.forEach((i) => { const st = i.status || "open"; incByStatus[st] = (incByStatus[st] || 0) + 1; });
    const incBySeverity = {};
    allIncidents.forEach((i) => { const sv = i.severity || "normal"; incBySeverity[sv] = (incBySeverity[sv] || 0) + 1; });

    const custCount = {};
    allTickets.forEach((t) => {
      const n = t.customer_name || t.customer_email || "Unknown";
      custCount[n] = (custCount[n] || 0) + 1;
    });

    const resolved = allTickets.filter((t) => t.status === "resolved" && t.created_at && t.updated_at);
    const resTrend = {};
    resolved.forEach((t) => {
      if (!t.updated_at) return;
      const d = format(new Date(t.updated_at), "MMM d");
      const h = (new Date(t.updated_at) - new Date(t.created_at)) / 3600000;
      if (!resTrend[d]) resTrend[d] = { total: 0, count: 0 };
      resTrend[d].total += h;
      resTrend[d].count += 1;
    });

    const sla = allTickets.filter((t) => t.status === "resolved" && t.created_at && t.updated_at);
    const slaOk = sla.filter((t) => (new Date(t.updated_at) - new Date(t.created_at)) <= 86400000);

    const engResponded = allIncidents.filter((i) => i.linearStatus && i.linearStatus !== "Todo" && i.opened_at && i.linearSyncedAt);
    let avgEngResponseTime = 0;
    if (engResponded.length > 0) {
      let total = 0;
      engResponded.forEach((i) => {
        const start = Math.max(new Date(i.opened_at).getTime(), new Date(i.created_at).getTime());
        const end = new Date(i.linearSyncedAt).getTime();
        total += (end - start) / 3600000;
      });
      avgEngResponseTime = Math.round((total / engResponded.length) * 10) / 10;
    }

    const draftsByStatus = {};
    allDrafts.forEach((d) => { const st = d.status || "pending"; draftsByStatus[st] = (draftsByStatus[st] || 0) + 1; });

    const knRefs = {};
    allKnowledge.forEach((k) => {
      const d = k.captured_at ? format(new Date(k.captured_at), "MMM d") : "Unknown";
      knRefs[d] = (knRefs[d] || 0) + 1;
    });

    return {
      ticketsByCategory: byCat,
      ticketsByPriority: byPri,
      ticketsByDay: byDay,
      signalsByStatus: sigByStatus,
      signalsBySeverity: sigBySev,
      incidentTrend: incTrend,
      incidentByStatus: incByStatus,
      incidentBySeverity: incBySeverity,
      draftsByStatus: draftsByStatus,
      knowledgeByDay: knRefs,
      knowledgeArticles: allKnowledge.length,
      knowledgeReferences: allKnowledge.reduce((s, k) => s + (k.reference_count || 0), 0),
      knowledgeAvgConfidence: allKnowledge.length > 0
        ? Math.round(allKnowledge.reduce((s, k) => s + (k.confidence || 0), 0) / allKnowledge.length)
        : 0,
      topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topCustomers: Object.entries(custCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
      avgResTimeByDay: Object.entries(resTrend).map(([d, v]) => [d, Math.round((v.total / v.count) * 10) / 10]).slice(-14),
      slaCompliance: sla.length > 0 ? Math.round((slaOk.length / sla.length) * 100) : 100,
      resolvedCount: ticketMetrics.resolved,
      incidentCount: incidentMetrics.total,
      totalActions: auditMetrics.total,
      engineeringResponseTime: avgEngResponseTime,
      incidentResolved: incidentMetrics.resolvedLinear,
      escalatedCount: incidentMetrics.escalated,
    };
  }, [allTickets, allSignals, allIncidents, allKnowledge, ticketMetrics, incidentMetrics, auditMetrics]);

  const churnMetrics = useMemo(() => {
    const open = allTickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
    const results = open.map((t) => {
      const ctx = {
        customerTickets: allTickets.filter((ot) => ot.customer_email === t.customer_email && ot.id !== t.id),
        incidents: allIncidents.filter((i) => i.ticket_id === t.id),
      };
      return { ticket: t, risk: calculateChurnRisk(t, ctx) };
    });

    const dist = { low: 0, medium: 0, high: 0 };
    results.forEach((r) => {
      if (r.risk.overallRisk <= 3) dist.low++;
      else if (r.risk.overallRisk <= 6) dist.medium++;
      else dist.high++;
    });

    const custRisk = {};
    open.forEach((t, i) => {
      const email = t.customer_email || "unknown";
      const risk = results[i]?.risk?.overallRisk || 0;
      if (!custRisk[email] || risk > custRisk[email].risk) {
        custRisk[email] = { name: t.customer_name || email, email, risk, tickets: 1 };
      } else {
        custRisk[email].tickets += 1;
      }
    });

    const health = { healthy: 0, atRisk: 0, critical: 0 };
    Object.values(custRisk).forEach((c) => {
      if (c.risk <= 3) health.healthy++;
      else if (c.risk <= 6) health.atRisk++;
      else health.critical++;
    });

    return {
      distribution: dist,
      healthDistribution: health,
      highRiskCount: dist.high,
      atRiskCount: dist.medium + dist.high,
      totalAnalyzed: results.length,
      customerRisk: Object.values(custRisk).sort((a, b) => b.risk - a.risk),
    };
  }, [allTickets, allIncidents]);

  const raw = { tickets: curT, signals: curS, incidents: curI, drafts: curD, logs: curL, knowledge: curK };

  const refresh = () => { tHook.refresh(); sHook.refresh(); iHook.refresh(); dHook.refresh(); aHook.refresh(); kHook.refresh(); };

  return {
    tickets: ticketMetrics, signals: signalMetrics, incidents: incidentMetrics,
    drafts: draftMetrics, knowledge: knowledgeMetrics, audit: auditMetrics, dashboard, sidebar, analytics,
    churn: churnMetrics, raw, loading, refresh,
    searched: { tickets: sT, signals: sS, incidents: sI, logs: sL, drafts: sD, knowledge: sK },
    all: { tickets: allTickets, signals: allSignals, incidents: allIncidents, drafts: allDrafts, logs: allLogs, knowledge: allKnowledge },
  };
}
