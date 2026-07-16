import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ShieldAlert, CheckCircle2, Loader2, ArrowUp, ExternalLink, RefreshCw, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useLinearSync, SYNC_STATUS } from "@/hooks/useLinearSync";
import { useRefreshListener, emitRefresh } from "@/lib/refreshEvents";
import useRole from "@/hooks/useRole";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import client from "@/lib/lemmaClient";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";
import { workspaceFilter } from "@/lib/workspaceConfig";
import { createNotification } from "@/lib/notifications";
import { escalateIncident } from "@/lib/incidentWorkflow";
import { deriveWorkflowStage } from "@/lib/workflowStage";

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

export default function Incidents() {
  const { workspace } = useWorkspace();
  const recordFilters = workspaceFilter(workspace.id);
  const { data: incidents, loading, refresh: refreshIncidents } = useLemmaRecords("incidents", { limit: 50, sort: [{ field: "created_at", direction: "desc" }], filters: recordFilters });
  const { data: signals, refresh: refreshSignals } = useLemmaRecords("signals", { limit: 100, filters: recordFilters });
  const { data: tickets, refresh: refreshTickets } = useLemmaRecords("tickets", { limit: 200, filters: recordFilters });
  const refreshAll = useCallback(() => { refreshIncidents(); refreshSignals(); refreshTickets(); }, [refreshIncidents, refreshSignals, refreshTickets]);
  useRefreshListener(refreshAll);


  const { canCompleteApproval, canCreateLinearIssue, canResolveIncident } = useRole();
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (selected && incidents.length > 0 && !incidents.find((i) => i.id === selected.id)) {
      setSelected(null);
    }
  }, [incidents, selected]);
  useEffect(() => {
    if (selected) {
      const updated = incidents.find((i) => i.id === selected.id);
      if (updated && updated !== selected) setSelected(updated);
    }
  }, [incidents]);
  const [resolving, setResolving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [linearFilter, setLinearFilter] = useState("all");
  const { syncStatus, syncLoading, syncResult, syncError, syncLinearIssue, resetSync } = useLinearSync();
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (!showEscalate) return;
    const handler = () => setShowEscalate(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showEscalate]);

  useEffect(() => {
    resetSync();
  }, [selected]);

  const handleEscalate = async (newSeverity) => {
    if (!current || newSeverity === current.severity) return;
    setEscalating(true);
    setShowEscalate(false);
    const toastId = toast.loading(`Escalating severity to ${newSeverity}...`);
    try {
      const result = await escalateIncident(current, newSeverity);
      toast.dismiss(toastId);
      if (result.status === "escalated") {
        const msg = newSeverity === "urgent"
          ? `Severity escalated to ${newSeverity}${result.emailConfirmed ? " — Gmail alert sent" : ""}`
          : `Severity escalated to ${newSeverity}`;
        toast.success(msg);
        await createNotification({ action: "incident.severity_escalated", actor: "Support Manager", resourceType: "incident", resourceId: current.id, details: { name: current.title, severity: newSeverity }, workspaceId: workspace.id, workspaceName: workspace.name });
      } else {
        toast.info(result.reason || "No change needed");
      }
      refreshIncidents();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to escalate severity");
    } finally {
      setEscalating(false);
    }
  };

  const handleSync = async () => {
    if (!current) return;
    const toastId = toast.loading("Syncing with Linear...");
    resetSync();
    const result = await syncLinearIssue(current.id);
    toast.dismiss(toastId);
    refreshIncidents();
    if (result.status === SYNC_STATUS.SYNCED) {
      toast.success("Linear issue synced");
      await createNotification({ action: "linear.issue_created", actor: "Support Manager", resourceType: "incident", resourceId: current.id, details: { name: current.title, linearIssue: identifier }, workspaceId: workspace.id, workspaceName: workspace.name }).catch(() => {});
      emitRefresh();
    } else if (result.status === SYNC_STATUS.CONNECTOR_UNAVAILABLE) {
      toast.error("Linear connector is not configured");
    } else {
      toast.error(result.error || "Failed to create Linear issue");
    }
  };

  const handleResolve = async () => {
    if (!current || resolving) return;
    setResolving(true);
    const toastId = toast.loading("Resolving incident...");
    try {
      await client.records.update("incidents", current.id, { status: "closed", closed_at: new Date().toISOString() });
      if (current.signal_id) {
        const relatedSignals = signals.filter((s) => s.id === current.signal_id);
        for (const sig of relatedSignals) {
          await client.records.update("signals", sig.id, { status: "memory" });
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
      const cat = current.category || relatedSignal?.category || "";
      const tags = [...new Set([...(current.tags || []), ...(relatedSignal?.tags || []), "auto-generated", "incident-resolution"])];

      await client.records.create("memory_entries", {
        id: crypto.randomUUID(),
        title: current.title || `Resolved Incident — ${current.id}`,
        summary: current.summary || (current.description ? current.description.slice(0, 200) : ""),
        root_cause: current.root_cause || relatedSignal?.summary || current.description || "",
        body: current.description || "",
        recommended_action: "",
        source_signal_id: current.signal_id,
        related_incident_id: current.id,
        tags: tags,
        category: cat,
        confidence: 85,
        captured_at: new Date().toISOString(),
        created_by: "Support Manager",
        workspaceId: workspace.id,
        workspaceName: workspace.name,
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

  useEffect(() => {
    if (current) {

    }
  }, [current]);

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
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Incidents</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">Track and investigate active incidents.</p>
        </div>
        <div className="flex items-center gap-2">
          {[{ value: "all", label: "All" }, { value: "escalated", label: "Escalated" }, { value: "not_escalated", label: "Not Escalated" }].map((f) => (
            <button key={f.value} onClick={() => setLinearFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${linearFilter === f.value ? "bg-zinc-900 text-white" : "text-muted-base hover:bg-zinc-100 dark:hover:bg-[#27272A]"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024]" />)}</div>
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-[#202024] lg:col-span-3" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border dark:border-border-dark bg-zinc-50/50 py-20 dark:bg-[#202024]/50">
          <ShieldAlert size={36} className="mb-4 text-muted dark:text-muted-dark" />
          <p className="text-secondary-body font-medium">No incidents</p>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{workspace.name} &mdash; all systems operational.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            {filtered.map((inc) => (
              <button key={inc.id} onClick={() => setSelected(inc)}
                className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${current?.id === inc.id ? "border-border dark:border-border-dark bg-zinc-50 shadow-sm dark:bg-[#202024]" : "border-border dark:border-border-dark bg-card hover:border-zinc-200 dark:hover:border-[#2A2A2E] hover:shadow-card"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-primary">{inc.title || inc.id}</h3>
                  <PriorityBadge priority={inc.severity} />
                </div>
                <p className="mt-1.5 text-xs text-muted dark:text-muted-dark">
                  {inc.affected_ticket_count != null ? `${inc.affected_ticket_count} tickets` : ""}{inc.affected_customer_count != null ? ` · ${inc.affected_customer_count} customers` : ""}{inc.status ? ` · ${inc.status}` : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {inc.linearIssueIdentifier ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300">
                      <ExternalLink size={10} /> {inc.linearIssueIdentifier}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted dark:text-muted-dark">Not Escalated</span>
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
              <div className="space-y-5 rounded-xl border border-border dark:border-border-dark bg-card p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-primary">{current.title || current.id}</h2>
                      {current.linearIssueIdentifier && (
                        <a href={current.linearIssueUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                          <ExternalLink size={12} /> Linear {current.linearIssueIdentifier}
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted dark:text-muted-dark">{current.summary || ""}</p>
                    {current.root_cause && current.root_cause !== current.summary && (
                      <p className="mt-1 text-xs text-muted dark:text-muted-dark italic">{current.root_cause.slice(0, 200)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <StatusBadge status={current.status} />
                    {canResolveIncident && current.status !== "resolved" && current.status !== "closed" && linearIsDone && (
                      <button onClick={handleResolve} disabled={resolving}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-all disabled:opacity-50">
                        {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Resolve
                      </button>
                    )}

                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {current.category && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-muted-dark">Category</p><p className="mt-1 text-sm font-medium text-primary">{current.category}</p></div>}
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024] relative">
                    <p className="text-xs text-muted dark:text-muted-dark">Severity</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PriorityBadge priority={current.severity} />
                      {canCompleteApproval && current.status !== "resolved" && current.status !== "closed" && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setShowEscalate(!showEscalate); }} disabled={escalating}
                            className="flex items-center gap-1 rounded-lg bg-zinc-200/70 px-2 py-1 text-xs font-medium text-secondary-body dark:bg-[#2A2A2E] hover:bg-zinc-200 transition-all disabled:opacity-50">
                            {escalating ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />} Escalate
                          </button>
                          {showEscalate && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-xl border border-border bg-card p-1 shadow-lg dark:border-border-dark dark:bg-[#202024]">
                              {severityOrder.filter((s) => severityOrder.indexOf(s) > severityOrder.indexOf(current.severity)).map((s) => (
                                <button key={s} onClick={(e) => { e.stopPropagation(); handleEscalate(s); }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-body dark:hover:bg-[#2A2A2E]">
                                  <ArrowUp size={12} className="text-orange-500 dark:text-orange-400" /> {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                    <p className="text-xs text-muted dark:text-muted-dark">Affected</p>
                    <p className="mt-1 text-sm font-medium text-primary">{current.affected_ticket_count != null ? current.affected_ticket_count : "N/A"} tickets</p>
                    {current.affected_customer_count != null && <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{current.affected_customer_count} customers</p>}
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                    <p className="text-xs text-muted dark:text-muted-dark">Alert</p>
                    {current.email_sent ? (
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Email sent
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-muted dark:text-muted-dark">Not sent</p>
                    )}
                  </div>
                  {current.owner_user_id && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-muted-dark">Owner</p><p className="mt-1 text-sm font-medium text-primary">{current.owner_user_id}</p></div>}
                  {current.opened_at && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-muted-dark">Opened</p><p className="mt-1 text-sm font-medium text-primary">{format(new Date(current.opened_at), "MMM d, HH:mm")}</p></div>}
                  {current.resolved_at && <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]"><p className="text-xs text-muted dark:text-muted-dark">Resolved</p><p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">{format(new Date(current.resolved_at), "MMM d, HH:mm")}</p></div>}
                </div>

                  {relatedSignal && (
                  <div className="rounded-xl bg-zinc-50 p-3 dark:bg-[#202024] flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted dark:text-muted-dark">Linked Signal</p>
                      <p className="mt-0.5 text-sm font-medium text-primary">{relatedSignal.name || relatedSignal.summary || relatedSignal.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${deriveWorkflowStage(relatedSignal) === "incident_created" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : deriveWorkflowStage(relatedSignal) === "approved" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" : deriveWorkflowStage(relatedSignal) === "review" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" : "bg-zinc-100 dark:bg-[#202024] text-zinc-600 dark:text-muted-dark"}`}>
                        {deriveWorkflowStage(relatedSignal).charAt(0).toUpperCase() + deriveWorkflowStage(relatedSignal).slice(1)}
                      </span>
                      <StatusBadge status={relatedSignal.status} />
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <ExternalLink size={12} /> Engineering
                    </h3>
                    <div className="flex items-center gap-2">
                      {current.linearIssueUrl && (
                        <a href={current.linearIssueUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-[#202024] px-2.5 py-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-border dark:border-border-dark">
                          <ExternalLink size={10} /> Open Linear
                        </a>
                      )}
                    </div>
                  </div>

                  {current.linearIssueId ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Synced to Linear</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-muted dark:text-muted-dark">Issue Key</p>
                          <p className="text-xs font-medium text-primary">{current.linearIssueIdentifier || current.linearKey || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-muted dark:text-muted-dark">Status</p>
                          <p className={`text-xs font-medium ${(current.linearStatus || "Todo") === "Done" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
                            {current.linearStatus || "Todo"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-muted dark:text-muted-dark">Issue URL</p>
                          <p className="text-xs font-medium text-primary truncate max-w-[160px]">{current.linearIssueUrl || current.linearUrl || "—"}</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-[#202024] p-2.5">
                          <p className="text-[10px] text-muted dark:text-muted-dark">Last Synced</p>
                          <p className="text-xs font-medium text-primary">{timeAgo(current.linearSyncedAt || current.lastSyncedAt) || "just now"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleSync} disabled={syncLoading}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all disabled:opacity-50">
                          {syncLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync Now
                        </button>
                        {(current.linearIssueUrl || current.linearUrl) && (
                          <a href={current.linearIssueUrl || current.linearUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#202024] border border-border dark:border-border-dark px-3 py-1.5 text-xs font-medium text-body dark:hover:bg-[#2A2A2E] transition-all">
                            <ExternalLink size={12} /> Open in Linear
                          </a>
                        )}
                      </div>
                    </div>
                  ) : syncStatus === SYNC_STATUS.CONNECTING ? (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Connecting to Linear...</span>
                    </div>
                  ) : syncStatus === SYNC_STATUS.CONNECTOR_UNAVAILABLE ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Not Escalated</span></div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Linear connector is not configured.</p>
                      <button onClick={handleSync} disabled={syncLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-all disabled:opacity-50">
                        {syncLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Retry Sync
                      </button>
                    </div>
                  ) : syncStatus === SYNC_STATUS.ERROR ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><span className="text-xs font-semibold text-red-700 dark:text-red-300">Sync Failed</span></div>
                      <p className="text-xs text-red-600 dark:text-red-400">{syncError || "Unknown error"}</p>
                      <button onClick={handleSync} disabled={syncLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-all disabled:opacity-50">
                        {syncLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-base">Not Escalated</span>
                      </div>
                      <button onClick={handleSync} disabled={syncLoading}
                        className="w-full rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 py-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all disabled:opacity-50">
                        {syncLoading ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                        Escalate to Linear
                      </button>
                      {!canCreateLinearIssue && (
                        <p className="text-[10px] text-muted dark:text-muted-dark">Only Support Managers can escalate incidents to Engineering.</p>
                      )}
                    </div>
                  )}
                </div>

                {current.linearIssueId && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark flex items-center gap-1.5">
                      <MessageSquare size={12} /> Engineering Notes
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add an engineering note (synced to Linear)..."
                        className="flex-1 rounded-xl border border-border dark:border-border-dark bg-zinc-50 dark:bg-[#202024] px-3 py-2 text-sm text-primary placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }} />
                      <button onClick={handleAddComment} disabled={!commentText.trim() || sendingComment}
                        className="flex items-center gap-1 rounded-xl bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all disabled:opacity-50">
                        {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Send
                      </button>
                    </div>
                  </div>
                )}

                {current.description && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">Description</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-secondary-body dark:bg-[#202024]">{current.description}</p></div>
                )}
                {current.blast_radius && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">Blast Radius</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm text-secondary-body dark:bg-[#202024]">{current.blast_radius}</p></div>
                )}
                {relatedTickets.length > 0 && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">Related Tickets ({relatedTickets.length})</p>
                    <div className="space-y-2">{relatedTickets.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm text-primary">{t.title || t.customer_name || t.id}</p><p className="text-xs text-muted dark:text-muted-dark">{t.customer_name || ""}</p></div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}</div></div>
                )}
                {current.resolution_notes && (
                  <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">Resolution Notes</p>
                    <p className="rounded-xl bg-zinc-50 p-3 text-sm text-secondary-body dark:bg-[#202024]">{current.resolution_notes}</p></div>
                )}

                {current.linearHistory && current.linearHistory.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark flex items-center gap-1.5">
                      <Clock size={12} /> Engineering Timeline
                    </p>
                    <div className="space-y-2">
                      {current.linearHistory.map((entry, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-[#202024]">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                            <RefreshCw size={11} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-primary">
                              Status changed to <span className="text-indigo-600 dark:text-indigo-400">{entry.to || entry.status}</span>
                            </p>
                            <p className="text-[10px] text-muted dark:text-muted-dark">{timeAgo(entry.timestamp || entry.at)}</p>
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
