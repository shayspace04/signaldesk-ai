import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { ShieldAlert, CheckCircle2, Loader2, ArrowUp, ExternalLink, RefreshCw, MessageSquare, ArrowRight, Clock, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener, emitRefresh } from "@/lib/refreshEvents";
import useRole from "@/hooks/useRole";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import client from "@/lib/lemmaClient";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import { createNotification } from "@/lib/notifications";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const severityOrder = ["low", "normal", "high", "urgent"];

const LINEAR_STATUSES = ["Todo", "In Progress", "In Review", "Done"];

export default function Incidents() {
  const { workspace } = useWorkspace();
  const recordFilters = workspaceFilter(workspace.id);
  const { data: incidents, loading, refresh: refreshIncidents } = useLemmaRecords("incidents", { limit: 50, filters: recordFilters });
  const { data: signals, refresh: refreshSignals } = useLemmaRecords("signals", { limit: 100, filters: recordFilters });
  const { data: tickets, refresh: refreshTickets } = useLemmaRecords("tickets", { limit: 200, filters: recordFilters });
  useRefreshListener(() => { refreshIncidents(); refreshSignals(); refreshTickets(); });
  const { canCompleteApproval, canCreateLinearIssue, canResolveIncident } = useRole();
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [linearFilter, setLinearFilter] = useState("all");
  const [creatingLinear, setCreatingLinear] = useState(false);
  const [syncingLinear, setSyncingLinear] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (!showEscalate) return;
    const handler = () => setShowEscalate(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showEscalate]);

  const handleEscalate = async (newSeverity) => {
    if (!current || newSeverity === current.severity) return;
    setEscalating(true);
    setShowEscalate(false);
    const toastId = toast.loading(`Escalating severity to ${newSeverity}...`);
    try {
      await client.functions.run("escalate_incident", {
        input: {
          incident_id: current.id,
          new_severity: newSeverity,
          workspace_name: workspace.name,
          dashboard_link: `${window.location.origin}/incidents`,
        },
      });
      toast.dismiss(toastId);
      toast.success(`Severity escalated to ${newSeverity}`);
      await createNotification({ action: "incident.severity_escalated", actor: "Support Manager", resourceType: "incident", resourceId: current.id, details: { name: current.title, severity: newSeverity }, workspaceId: workspace.id, workspaceName: workspace.name });
      refreshIncidents();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to escalate severity");
    } finally {
      setEscalating(false);
    }
  };

  const handleCreateLinearIssue = async () => {
    if (!current || creatingLinear) return;
    if (current.linearIssueId) {
      if (current.linearIssueUrl) window.open(current.linearIssueUrl, "_blank");
      return;
    }
    setCreatingLinear(true);
    const toastId = toast.loading("Creating Linear issue...");
    try {
      const raw = await client.functions.run("create_linear_issue", {
        input: { incident_id: current.id },
      });
      const result = raw.output_data || raw.output || raw;
      toast.dismiss(toastId);
      if (result.success) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Engineering issue created successfully.</span>
            <a href={result.linearIssueUrl} target="_blank" rel="noopener noreferrer"
              className="text-indigo-600 underline font-medium">{result.linearIssueIdentifier} ↗</a>
          </div>,
          { duration: 5000 }
        );
        await createNotification({ action: "linear.issue_created", actor: "Support Manager", resourceType: "incident", resourceId: current.id, details: { name: current.title, linearIssue: result.linearIssueIdentifier }, workspaceId: workspace.id, workspaceName: workspace.name });
        refreshIncidents();
        emitRefresh();
      } else {
        toast.error(result.message || "Failed to create Linear issue");
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Unable to create Linear issue. Please retry.");
    } finally {
      setCreatingLinear(false);
    }
  };

  const handleSyncLinear = async () => {
    if (!current || !current.linearIssueId || syncingLinear) return;
    setSyncingLinear(true);
    const toastId = toast.loading("Syncing with Linear...");
    try {
      const raw = await client.functions.run("sync_linear_issue", {
        input: { incident_id: current.id },
      });
      const result = raw.output_data || raw.output || raw;
      toast.dismiss(toastId);
      if (result.success) {
        toast.success("Engineering issue synchronized");
        await createNotification({ action: "linear.synced", actor: "System", resourceType: "incident", resourceId: current.id, details: { name: current.title, status: result.status }, workspaceId: workspace.id, workspaceName: workspace.name });
        refreshIncidents();
        emitRefresh();
      } else {
        toast.error(result.message || "Sync failed");
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Unable to sync with Linear");
    } finally {
      setSyncingLinear(false);
    }
  };

  const handleResolve = async () => {
    if (!current || resolving) return;
    setResolving(true);
    const toastId = toast.loading("Resolving incident...");
    try {
      await client.records.update("incidents", current.id, { status: "resolved", resolved_at: new Date().toISOString() });
      if (current.signal_id) {
        const relatedSignals = signals.filter((s) => s.id === current.signal_id);
        for (const sig of relatedSignals) {
          await client.records.update("signals", sig.id, { status: "resolved" });
        }
      }
      const relatedTickets = tickets.filter((t) => t.signal_id === current.signal_id);
      for (const t of relatedTickets) {
        await client.records.update("tickets", t.id, { status: "ready_for_reply" });
      }

      const relatedSignal = signals.find((s) => s.id === current.signal_id);
      const custNames = [...new Set(relatedTickets.map((t) => t.customer_name).filter(Boolean))];
      const custEmails = [...new Set(relatedTickets.map((t) => t.customer_email).filter(Boolean))];
      const resolvedDuration = (() => {
        if (current.created_at) {
          const ms = new Date() - new Date(current.created_at);
          return Math.round(ms / 3600000 * 10) / 10;
        }
        return 0;
      })();
      const ticketIds = relatedTickets.map((t) => t.id);
      const signalIds = current.signal_id ? [current.signal_id] : [];
      const cat = current.category || relatedSignal?.category || "";
      const tags = [...new Set([...(current.tags || []), ...(relatedSignal?.tags || []), "auto-generated", "incident-resolution"])];

      await client.records.create("memory_entries", {
        title: current.title || `Resolved Incident — ${current.id}`,
        summary: current.summary || (current.description ? current.description.slice(0, 200) : ""),
        root_cause: current.root_cause || relatedSignal?.summary || current.description || "",
        resolution: current.resolution_notes || current.description || "",
        symptoms: relatedSignal?.summary || "",
        preventive_actions: "",
        timeline: `Incident created: ${current.created_at ? format(new Date(current.created_at), "MMM d, yyyy HH:mm") : "N/A"}\nSeverity: ${current.severity || "N/A"}\nSignal detected: ${relatedSignal?.detected_at ? format(new Date(relatedSignal.detected_at), "MMM d, yyyy HH:mm") : "N/A"}\nResolved: ${format(new Date(), "MMM d, yyyy HH:mm")}\nResolution time: ${resolvedDuration} hours`,
        incident_id: current.id,
        signal_id: current.signal_id,
        linear_issue_id: current.linearIssueId || "",
        ticket_ids: ticketIds,
        signal_ids: signalIds,
        category: cat,
        tags: tags,
        status: "published",
        confidence: 85,
        verified_by: "Support Manager",
        verified_at: new Date().toISOString(),
        reference_count: relatedTickets.length + (relatedSignal ? 1 : 0) + 1,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        customers_affected: custNames.length || custEmails.length || 0,
        resolution_time_hours: resolvedDuration,
        severity: current.severity || "medium",
      });
      await createNotification({ action: "knowledge.created", actor: "Support Manager", resourceType: "knowledge", resourceId: current.id, details: { name: current.title || "Knowledge Article" }, workspaceId: workspace.id, workspaceName: workspace.name });
      await createNotification({ action: "incident.resolved", actor: "Support Manager", resourceType: "incident", resourceId: current.id, details: { name: current.title }, workspaceId: workspace.id, workspaceName: workspace.name });
      toast.dismiss(toastId);
      toast.success("Incident resolved. Signal marked resolved, tickets ready for reply.");
      refreshIncidents(); refreshSignals(); refreshTickets(); emitRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to resolve incident");
    } finally {
      setResolving(false);
    }
  };

  const handleFetchLinear = async () => {
    if (!current || !current.linearIssueId) return;
    const toastId = toast.loading("Fetching Linear issue...");
    try {
      const raw = await client.functions.run("fetch_linear_issue", {
        input: { incident_id: current.id },
      });
      const result = raw.output_data || raw.output || raw;
      toast.dismiss(toastId);
      if (result.success) {
        await createNotification({ action: "linear.fetched", actor: "System", resourceType: "incident", resourceId: current.id, details: { name: current.title, status: result.status }, workspaceId: workspace.id, workspaceName: workspace.name });
        toast.success("Engineering issue refreshed");
        refreshIncidents();
      } else {
        toast.error(result.message || "Failed to fetch Linear issue");
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Unable to fetch Linear issue");
    }
  };

  const handleAddComment = async () => {
    if (!current || !current.linearIssueId || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    const toastId = toast.loading("Adding comment...");
    try {
      const raw = await client.functions.run("add_linear_comment", {
        input: { incident_id: current.id, body: commentText.trim(), user_name: "Support Manager" },
      });
      const result = raw.output_data || raw.output || raw;
      toast.dismiss(toastId);
      if (result.success) {
        toast.success("Comment synced to Linear");
        setCommentText("");
        refreshIncidents();
      } else {
        toast.error("Failed to add comment");
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Unable to add comment");
    } finally {
      setSendingComment(false);
    }
  };

  const filtered = linearFilter === "all" ? incidents : linearFilter === "escalated"
    ? incidents.filter((i) => i.linearIssueId)
    : incidents.filter((i) => !i.linearIssueId);

  const current = selected || filtered[0] || null;

  const linearIsDone = current?.linearStatus === "Done" || current?.linearStatus === "completed";

  const relatedTickets = useMemo(() => {
    if (!current) return [];
    const sigId = current.signal_id;
    if (!sigId) return [];
    return tickets.filter((t) => t.signal_id === sigId);
  }, [current, tickets]);

  const relatedSignal = useMemo(() => {
    if (!current || !current.signal_id) return null;
    return signals.find((s) => s.id === current.signal_id) || null;
  }, [current, signals]);

  return (
    <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-zinc-900 dark:text-[#FAFAFA]">Incidents</h1>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">Track and investigate active incidents.</p>
        </div>
        <div className="flex items-center gap-2">
          {[{ value: "all", label: "All" }, { value: "escalated", label: "Escalated" }, { value: "not_escalated", label: "Not Escalated" }].map((f) => (
            <button key={f.value} onClick={() => setLinearFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${linearFilter === f.value ? "bg-zinc-900 text-white" : "text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#27272A]"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}</div>
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024] lg:col-span-3" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50/50 py-20 dark:border-[#2A2A2E] dark:bg-[#202024]/50">
          <ShieldAlert size={36} className="mb-4 text-zinc-300 dark:text-[#71717A]" />
          <p className="text-zinc-600 dark:text-[#A1A1AA] font-medium">No incidents</p>
          <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">{workspace.name} &mdash; all systems operational.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            {filtered.map((inc) => (
              <button key={inc.id} onClick={() => setSelected(inc)}
                className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${current?.id === inc.id ? "border-zinc-300 dark:border-[#2A2A2E] bg-zinc-50 shadow-sm dark:border-[#2A2A2E] dark:bg-[#202024]" : "border-border dark:border-[#2A2A2E] bg-white dark:border-[#2A2A2E] dark:bg-[#18181B] hover:border-zinc-200 dark:hover:border-[#2A2A2E] hover:shadow-card"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-[#FAFAFA]">{inc.title || inc.id}</h3>
                  <PriorityBadge priority={inc.severity} />
                </div>
                <p className="mt-1.5 text-xs text-muted dark:text-[#A1A1AA]">
                  {inc.affected_ticket_count ? `${inc.affected_ticket_count} affected tickets` : ""}{inc.status ? ` · ${inc.status}` : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {inc.linearIssueIdentifier ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300">
                      <ExternalLink size={10} /> {inc.linearIssueIdentifier}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 dark:text-[#71717A]">Not Escalated</span>
                  )}
                  {inc.status === "resolved" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                      <CheckCircle2 size={10} /> Resolved
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {current && (
              <div className="space-y-5 rounded-xl border border-border dark:border-[#2A2A2E] bg-white dark:bg-[#18181B] p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-[#FAFAFA]">{current.title || current.id}</h2>
                      {current.linearIssueIdentifier && (
                        <a href={current.linearIssueUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                          <ExternalLink size={12} /> Linear {current.linearIssueIdentifier}
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted dark:text-[#A1A1AA]">{current.summary || ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <StatusBadge status={current.status} />
                    {canResolveIncident && current.status !== "resolved" && current.status !== "closed" && linearIsDone && (
                      <button onClick={handleResolve} disabled={resolving}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-all disabled:opacity-50">
                        {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Resolve
                      </button>
                    )}
                    {canResolveIncident && current.status !== "resolved" && current.status !== "closed" && !linearIsDone && current.linearIssueId && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                        <Clock size={12} /> Awaiting Linear
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024] relative">
                    <p className="text-xs text-muted dark:text-[#A1A1AA]">Severity</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PriorityBadge priority={current.severity} />
                      {canCompleteApproval && current.status !== "resolved" && current.status !== "closed" && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setShowEscalate(!showEscalate); }} disabled={escalating}
                            className="flex items-center gap-1 rounded-lg bg-zinc-200/70 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 transition-all disabled:opacity-50 dark:bg-[#2A2A2E] dark:text-[#A1A1AA] dark:hover:bg-[#3A3A3E]">
                            {escalating ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />} Escalate
                          </button>
                          {showEscalate && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-[#2A2A2E] dark:bg-[#202024]">
                              {severityOrder.filter((s) => severityOrder.indexOf(s) > severityOrder.indexOf(current.severity)).map((s) => (
                                <button key={s} onClick={(e) => { e.stopPropagation(); handleEscalate(s); }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-[#A1A1AA] dark:hover:bg-[#2A2A2E]">
                                  <ArrowUp size={12} className="text-orange-500" /> {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-[#A1A1AA]">Affected</p><p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{current.affected_ticket_count || "N/A"} tickets</p></div>
                  {current.owner_user_id && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-[#A1A1AA]">Owner</p><p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{current.owner_user_id}</p></div>}
                  {current.opened_at && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-[#A1A1AA]">Opened</p><p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{format(new Date(current.opened_at), "MMM d, HH:mm")}</p></div>}
                  {current.resolved_at && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-[#A1A1AA]">Resolved</p><p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">{format(new Date(current.resolved_at), "MMM d, HH:mm")}</p></div>}
                </div>

                {relatedSignal && (
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024] flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted dark:text-[#A1A1AA]">Linked Signal</p>
                      <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">{relatedSignal.name || relatedSignal.summary || relatedSignal.id}</p>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${relatedSignal.status === "resolved" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                      {relatedSignal.status || "pending"}
                    </span>
                  </div>
                )}

                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <ExternalLink size={12} /> Engineering
                    </h3>
                    <div className="flex items-center gap-2">
                      {current.linearIssueId && (
                        <button onClick={handleFetchLinear} disabled={syncingLinear}
                          className="flex items-center gap-1 rounded-lg bg-white dark:bg-[#202024] px-2.5 py-1 text-[10px] font-medium text-zinc-600 dark:text-[#A1A1AA] hover:bg-zinc-100 dark:hover:bg-[#2A2A2E] transition-all border border-zinc-200 dark:border-[#2A2A2E] disabled:opacity-50">
                          {syncingLinear ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Sync
                        </button>
                      )}
                      {current.linearIssueUrl && (
                        <a href={current.linearIssueUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-[#202024] px-2.5 py-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-zinc-200 dark:border-[#2A2A2E]">
                          <ExternalLink size={10} /> Open Linear
                        </a>
                      )}
                    </div>
                  </div>

                  {current.linearIssueId ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Issue</p>
                          <p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA]">{current.linearIssueIdentifier || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Status</p>
                          <p className={`text-xs font-medium ${current.linearStatus === "Done" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-[#FAFAFA]"}`}>
                            {current.linearStatus || "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Priority</p>
                          <p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA]">{current.linearPriority || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Last Sync</p>
                          <p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA]">{timeAgo(current.linearSyncedAt) || "—"}</p>
                        </div>
                      </div>
                      {current.linearAssignee && (
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Assignee</p>
                          <p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA]">{current.linearAssignee}</p>
                        </div>
                      )}
                      {linearIsDone && current.status !== "resolved" && current.status !== "closed" && (
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-2.5 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Linear issue is Done. Ready to resolve.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={handleSyncLinear} disabled={syncingLinear || !current.linearIssueId}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all disabled:opacity-50">
                          {syncingLinear ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync Now
                        </button>
                        <a href={current.linearIssueUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#202024] border border-zinc-200 dark:border-[#2A2A2E] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#2A2A2E] transition-all">
                          <ExternalLink size={12} /> View in Linear
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500 dark:text-[#A1A1AA]">This incident has not been escalated to engineering.</p>
                      <button onClick={handleCreateLinearIssue} disabled={creatingLinear || (current.linearIssueId && !current.linearIssueUrl)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${canCreateLinearIssue
                          ? "bg-indigo-600 text-white hover:bg-indigo-500"
                          : "bg-zinc-200 dark:bg-[#2A2A2E] text-zinc-500 dark:text-[#71717A] cursor-not-allowed"}`}
                        title={!canCreateLinearIssue ? "Only Support Managers can escalate incidents to Engineering." : undefined}>
                        {creatingLinear ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                        {current.linearIssueId ? "Open Linear" : creatingLinear ? "Creating..." : "Create Linear Issue"}
                      </button>
                      {!canCreateLinearIssue && (
                        <p className="text-[10px] text-zinc-400 dark:text-[#71717A]">Only Support Managers can escalate incidents to Engineering.</p>
                      )}
                    </div>
                  )}
                </div>

                {current.linearIssueId && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA] flex items-center gap-1.5">
                      <MessageSquare size={12} /> Engineering Notes
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add an engineering note (synced to Linear)..."
                        className="flex-1 rounded-xl border border-zinc-200 dark:border-[#2A2A2E] bg-zinc-50 dark:bg-[#202024] px-3 py-2 text-sm text-zinc-900 dark:text-[#FAFAFA] placeholder:text-zinc-400 dark:placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }} />
                      <button onClick={handleAddComment} disabled={!commentText.trim() || sendingComment}
                        className="flex items-center gap-1 rounded-xl bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all disabled:opacity-50">
                        {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Send
                      </button>
                    </div>
                  </div>
                )}

                {current.description && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA]">Description</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-600 dark:bg-[#202024] dark:text-[#A1A1AA]">{current.description}</p></div>
                )}
                {current.blast_radius && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA]">Blast Radius</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-[#202024] dark:text-[#A1A1AA]">{current.blast_radius}</p></div>
                )}
                {relatedTickets.length > 0 && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA]">Related Tickets ({relatedTickets.length})</p>
                    <div className="space-y-2">{relatedTickets.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-900 dark:text-[#FAFAFA]">{t.title || t.customer_name || t.id}</p><p className="text-xs text-muted dark:text-[#A1A1AA]">{t.customer_name || ""}</p></div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}</div></div>
                )}
                {current.resolution_notes && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA]">Resolution Notes</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-[#202024] dark:text-[#A1A1AA]">{current.resolution_notes}</p></div>
                )}

                {current.linearHistory && current.linearHistory.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-[#A1A1AA] flex items-center gap-1.5">
                      <Clock size={12} /> Engineering Timeline
                    </p>
                    <div className="space-y-2">
                      {current.linearHistory.map((entry, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                            <RefreshCw size={11} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-900 dark:text-[#FAFAFA]">
                              Status changed to <span className="text-indigo-600 dark:text-indigo-400">{entry.to || entry.status}</span>
                            </p>
                            <p className="text-[10px] text-muted dark:text-[#A1A1AA]">{timeAgo(entry.timestamp || entry.at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
