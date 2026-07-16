import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Trash2, Loader2, CheckCircle2, AlertCircle, Database, FlaskConical } from "lucide-react";
import { launchEnterpriseDemo, clearEnterpriseDemo, DEMO_COMPLETE_EVENT } from "@/lib/enterpriseDemoLoader";

export default function EnterpriseDemo() {
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [clearCount, setClearCount] = useState(null);

  const handleLaunch = async () => {
    setLoading(true); setError(null); setResult(null); setClearCount(null);
    try {
      const r = await launchEnterpriseDemo((wsId, wsName, step, total, msg, pct) => {
        setProgress({ wsId, wsName, msg, pct });
      });
      setResult(r);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleClear = async () => {
    setClearing(true); setError(null); setClearCount(null);
    try {
      const count = await clearEnterpriseDemo((step, total, msg, pct) => {
        setProgress({ msg, pct });
      });
      setClearCount(count);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setClearing(false);
      setProgress(null);
    }
  };

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
            Creates ~190 deterministic tickets across 5 workspaces with signals, incidents,
            knowledge articles, engineering handoffs, and approval drafts — all pre-populated with
            realistic AI-generated values. Uses direct record insertion, no production functions.
          </p>
          <button
            onClick={handleLaunch}
            disabled={loading || clearing}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            {loading ? "Launching..." : "Launch Enterprise Demo"}
          </button>
          {progress && loading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted dark:text-muted-dark mb-1.5">
                <span>{progress.wsName && `${progress.wsName}: `}{progress.msg}</span>
                <span>{progress.pct != null ? `${progress.pct}%` : ""}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-[#202024] overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress.pct || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border dark:border-border-dark bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={18} className="text-red-500" />
            <h2 className="text-lg font-semibold text-primary">Clear Demo Data</h2>
          </div>
          <p className="text-sm text-muted dark:text-muted-dark mb-6 leading-relaxed">
            Removes only the records created by the enterprise demo loader. Uses an ID registry
            to track exactly which records to delete — production data is never touched.
          </p>
          <button
            onClick={handleClear}
            disabled={loading || clearing}
            className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-red-200 dark:border-red-900/50 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-all"
          >
            {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {clearing ? "Clearing..." : "Clear Demo Data"}
          </button>
          {clearCount != null && (
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 text-center">
              Deleted {clearCount} demo records
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Error</p>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-mono">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">Demo Complete</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {result.map((r) => (
              <div key={r.workspaceName} className="rounded-lg bg-white dark:bg-[#202024] p-4">
                <h3 className="text-sm font-semibold text-primary mb-2">{r.workspaceName}</h3>
                {r.error ? (
                  <p className="text-xs text-red-500">{r.error}</p>
                ) : (
                  <div className="space-y-1 text-xs text-muted dark:text-muted-dark">
                    <p>Total records restored: {r.totalRecords}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
