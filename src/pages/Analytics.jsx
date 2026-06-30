import { motion } from "framer-motion";
import { useMemo } from "react";
import { Activity, FileText, Users } from "lucide-react";
import CountUp from "react-countup";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { format } from "date-fns";

function ChartBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-zinc-400 truncate text-right">{label}</span>
      <div className="flex-1 h-6 rounded-md bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-md transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-8 text-xs text-zinc-500 text-right">{count}</span>
    </div>
  );
}

function ActionChart({ logs }) {
  const grouped = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      const action = l.action || "unknown";
      map[action] = (map[action] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [logs]);

  const maxCount = Math.max(...grouped.map(([, c]) => c), 1);

  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">Actions by Type</h2>
      {grouped.length === 0 ? (
        <p className="text-sm text-zinc-400">No audit data.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map(([action, count]) => (
            <ChartBar key={action} label={action} count={count} max={maxCount} color="bg-violet-500" />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineChart({ logs }) {
  const grouped = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      if (!l.created_at) return;
      const day = format(new Date(l.created_at), "MMM d");
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).slice(-14);
  }, [logs]);

  const maxCount = Math.max(...grouped.map(([, c]) => c), 1);

  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">Activity Timeline</h2>
      {grouped.length === 0 ? (
        <p className="text-sm text-zinc-400">No timeline data.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map(([day, count]) => (
            <ChartBar key={day} label={day} count={count} max={maxCount} color="bg-emerald-500" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { data: tickets, loading: loadT } = useLemmaRecords("tickets", { limit: 500 });
  const { data: logs, loading: loadL } = useLemmaRecords("audit_logs", { limit: 500 });
  const { data: incidents } = useLemmaRecords("incidents", { limit: 500 });

  const resolvedTickets = tickets.filter((t) => t.status === "resolved");

  return (
    <motion.div
      className="flex flex-col min-h-full space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">Platform metrics and audit insights.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
          <Activity size={18} className="text-violet-500" />
          <p className="mt-3 text-2xl font-bold text-zinc-900">
            {loadL ? <div className="h-7 w-12 animate-pulse rounded bg-zinc-100" /> : <CountUp end={logs.length} />}
          </p>
          <p className="text-xs text-zinc-400">Total Actions</p>
        </div>
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
          <FileText size={18} className="text-blue-500" />
          <p className="mt-3 text-2xl font-bold text-zinc-900">
            {loadT ? <div className="h-7 w-12 animate-pulse rounded bg-zinc-100" /> : <CountUp end={tickets.length} />}
          </p>
          <p className="text-xs text-zinc-400">Total Tickets</p>
        </div>
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
          <Activity size={18} className="text-green-500" />
          <p className="mt-3 text-2xl font-bold text-zinc-900"><CountUp end={resolvedTickets.length} /></p>
          <p className="text-xs text-zinc-400">Resolved</p>
        </div>
        <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
          <Users size={18} className="text-amber-500" />
          <p className="mt-3 text-2xl font-bold text-zinc-900"><CountUp end={incidents.length} /></p>
          <p className="text-xs text-zinc-400">Incidents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionChart logs={logs} />
        <TimelineChart logs={logs} />
      </div>
    </motion.div>
  );
}
