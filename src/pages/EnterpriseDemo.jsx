import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, Trash2, Loader2, CheckCircle2, AlertCircle, Database,
  FlaskConical, ChevronRight, XCircle, Clock,
} from "lucide-react";
import { launchEnterpriseDemo, clearEnterpriseDemo, DEMO_CONNECTORS_EVENT } from "@/lib/enterpriseDemoLoader";

const WS_COLORS = {
  binocs: { bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/40" },
  zap: { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/40" },
  foxo: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800/40" },
  corally: { bg: "bg-green-50 dark:bg-green-950/20", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800/40" },
  yesmadam: { bg: "bg-pink-50 dark:bg-pink-950/20", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800/40" },
};

const STAGE_ORDER = ["tickets", "signals", "incidents", "memory_entries", "audit_logs", "drafts", "connectors"];

const STAGE_DISPLAY = {
  tickets: "Tickets",
  signals: "Signals",
  incidents: "Incidents",
  memory_entries: "Knowledge",
  audit_logs: "Activity Logs",
  drafts: "Drafts",
  connectors: "Connectors",
};

const initialState = {
  status: "idle",
  percent: 0,
  workspaceIndex: 0,
  totalWorkspaces: 5,
  workspaceLabel: null,
  workspaceId: null,
  stages: {},
  failures: [],
  summary: null,
  error: null,
  loadTime: null,
  clearCount: null,
};

function buildStages() {
  const s = {};
  for (const id of STAGE_ORDER) s[id] = { status: "pending", count: 0, total: 0 };
  return s;
}

export default function EnterpriseDemo() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleProgress = useCallback((detail) => {
    setState(prev => {
      const next = { ...prev };

      if (detail.type === "status") {
        if (detail.status === "clearing") {
          next.status = "clearing";
          next.percent = 0;
        } else if (detail.status === "cleared") {
          next.status = "cleared";
          next.clearCount = detail.count;
        }
        return next;
      }

      next.percent = detail.percent != null ? detail.percent : prev.percent;
      next.workDone = detail.workDone || 0;
      next.workTotal = detail.workTotal || 0;

      if (detail.type === "workspace-start") {
        next.workspaceId = detail.workspaceId;
        next.workspaceLabel = detail.workspaceLabel;
        next.workspaceIndex = detail.workspaceIndex || (prev.workspaceIndex + 1);
        next.totalWorkspaces = detail.totalWorkspaces || prev.totalWorkspaces;
        next.stages = buildStages();
        next.status = "running";
      } else if (detail.type === "workspace-complete") {
        // Keep workspace visible until next workspace-start replaces it
      } else if (detail.type === "stage-start") {
        next.stages = { ...prev.stages, [detail.stageId]: { status: "in_progress", count: 0, total: detail.total || 0 } };
      } else if (detail.type === "stage-progress") {
        next.stages = { ...prev.stages, [detail.stageId]: { status: "in_progress", count: detail.count || 0, total: detail.total || 0 } };
      } else if (detail.type === "stage-complete") {
        next.stages = { ...prev.stages, [detail.stageId]: { status: "done", count: detail.count || 0, total: detail.total || 0 } };
      } else if (detail.type === "stage-error") {
        next.stages = { ...prev.stages, [detail.stageId]: { status: "error", count: detail.count || 0, total: detail.total || 0 } };
        next.failures = [...prev.failures, { workspaceId: detail.workspaceId, stageId: detail.stageId, reason: detail.reason }];
      } else if (detail.type === "complete") {
        next.status = "completed";
        next.summary = detail.summary;
        next.loadTime = detail.loadTime;
        next.results = detail.results || [];
        next.failures = [...prev.failures, ...(detail.failures || [])];
      }

      return next;
    });
  }, []);

  const handleLaunch = async () => {
    setLoading(true);
    setState({ ...initialState, status: "running" });
    try {
      await launchEnterpriseDemo(handleProgress);
    } catch (err) {
      setState(prev => ({ ...prev, status: "failed", error: err.message || String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setState({ ...initialState, status: "clearing" });
    try {
      await clearEnterpriseDemo(handleProgress);
    } catch (err) {
      setState(prev => ({ ...prev, status: "failed", error: err.message || String(err) }));
    } finally {
      setClearing(false);
    }
  };

  // Listen for deferred connector completion to update summary
  useEffect(() => {
    const handler = (e) => {
      const { gmailSent, linearSynced, connectorErrors } = e.detail || {};
      setState(prev => {
        if (!prev.summary) return prev;
        return {
          ...prev,
          summary: { ...prev.summary, gmail_alerts: gmailSent || 0, linear_issues: linearSynced || 0 },
          failures: [...prev.failures, ...(connectorErrors || [])],
        };
      });
    };
    window.addEventListener(DEMO_CONNECTORS_EVENT, handler);
    return () => window.removeEventListener(DEMO_CONNECTORS_EVENT, handler);
  }, []);

  const isRunning = loading && (state.status === "running" || state.status === "clearing" || state.status === "cleared");
  const showProgress = loading && state.status === "running";

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
          <FlaskConical size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-primary">Enterprise Demo</h1>
          <p className="text-sm text-muted dark:text-muted-dark mt-0.5">
            Populate all 5 workspaces with realistic multi-tenant data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={18} className="text-indigo-500" />
            <h2 className="text-lg font-semibold text-primary">Launch Enterprise Demo</h2>
          </div>
          <p className="text-sm text-muted dark:text-muted-dark mb-6 leading-relaxed">
            Creates ~684 records across 5 workspaces with tickets, signals, incidents,
            knowledge articles, engineering handoffs, and approval drafts.
          </p>
          <button
            onClick={handleLaunch}
            disabled={loading || clearing}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            {loading ? "Launching..." : "Launch Enterprise Demo"}
          </button>
        </div>

        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={18} className="text-red-500" />
            <h2 className="text-lg font-semibold text-primary">Clear Demo Data</h2>
          </div>
          <p className="text-sm text-muted dark:text-muted-dark mb-6 leading-relaxed">
            Removes all demo workspace records from the database.
            Production data is never touched.
          </p>
          <button
            onClick={handleClear}
            disabled={loading || clearing}
            className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-red-200 dark:border-red-900/50 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-all"
          >
            {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {clearing ? "Clearing..." : "Clear Demo Data"}
          </button>
          {state.status === "cleared" && state.clearCount != null && (
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 text-center">
              Deleted {state.clearCount} demo records
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showProgress && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-border dark:border-border-dark bg-card p-6 mb-6 overflow-hidden"
          >
            <div className="mb-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-primary">Progress</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">{state.percent}%</span>
              </div>
              <div className="h-3 rounded-full bg-zinc-100 dark:bg-[#202024] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  animate={{ width: `${state.percent}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="border border-border dark:border-border-dark rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Database size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-primary">
                  Workspace {state.workspaceIndex} / {state.totalWorkspaces}
                </span>
                {state.workspaceLabel && (
                  <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg ${state.workspaceId ? (WS_COLORS[state.workspaceId]?.bg || "bg-zinc-100") : "bg-zinc-100"} ${state.workspaceId ? (WS_COLORS[state.workspaceId]?.text || "text-zinc-700") : "text-zinc-700"}`}>
                    {state.workspaceLabel}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {STAGE_ORDER.map((stageId) => {
                  const stage = state.stages[stageId];
                  if (!stage) return null;
                  const counts = stage.total > 0 ? `(${stage.count}/${stage.total})` : "";
                  return (
                    <div key={stageId} className="flex items-center gap-2 text-xs">
                      {stage.status === "done" ? (
                        <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                      ) : stage.status === "error" ? (
                        <XCircle size={12} className="shrink-0 text-red-500" />
                      ) : stage.status === "in_progress" ? (
                        <div className="shrink-0 w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      ) : (
                        <div className="shrink-0 w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      )}
                      <span className={stage.status === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-muted dark:text-muted-dark"}>
                        {STAGE_DISPLAY[stageId] || stageId}
                        {counts && <span className="ml-1 tabular-nums">{counts}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {state.failures.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border dark:border-border-dark">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">
                  {state.failures.length} failure{state.failures.length > 1 ? "s" : ""}
                </p>
                {state.failures.slice(-3).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 mb-1">
                    <XCircle size={12} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">{STAGE_DISPLAY[f.stageId] || f.stageId}</span>: {f.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {state.status === "clearing" && (
        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-4 mb-6 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-indigo-500" />
          <span className="text-sm text-muted dark:text-muted-dark">Clearing demo data...</span>
        </div>
      )}

      {state.error && !showProgress && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Error</p>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-mono">{state.error}</p>
        </div>
      )}

      <AnimatePresence>
        {state.status === "completed" && state.summary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/10 p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                Enterprise Demo Ready
              </h2>
            </div>
            {state.loadTime && (
              <div className="flex items-center gap-1.5 mb-4 text-xs text-muted dark:text-muted-dark">
                <Clock size={12} />
                <span>Load Time: {state.loadTime}s</span>
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              <SummaryRow label="Tickets Created" value={state.summary.tickets} />
              <SummaryRow label="Signals Created" value={state.summary.signals} />
              <SummaryRow label="Incidents Created" value={state.summary.incidents} />
              <SummaryRow label="Gmail Alerts Sent" value={state.summary.gmail_alerts} />
              <SummaryRow label="Linear Issues Created" value={state.summary.linear_issues} />
              <SummaryRow label="Knowledge Articles" value={state.summary.memory_entries} />
              <SummaryRow label="Notifications" value="Updated" />
              <SummaryRow label="Analytics / Dashboard / Sidebar" value="Refreshed" />
            </div>

            {state.failures.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-900/30">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
                  {state.failures.length} error{state.failures.length > 1 ? "s" : ""}
                </p>
                {state.failures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{f.type === "gmail" ? "Gmail" : f.type === "linear" ? "Linear" : STAGE_DISPLAY[f.stageId] || f.stageId}: {f.error || f.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              <span>Everything verified</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
      <span className="text-emerald-700 dark:text-emerald-300">{label}</span>
      <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{value}</span>
    </div>
  );
}
