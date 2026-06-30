import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TicketCheck, Radio, ShieldAlert, FileText, Brain, X,
} from "lucide-react";
import client from "@/lib/lemmaClient";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import { format } from "date-fns";

function KpiCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 truncate">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
        </div>
        <div className={`rounded-lg bg-zinc-100 p-2 ${color} flex-shrink-0`}>
          {Icon && <Icon size={20} />}
        </div>
      </div>
    </div>
  );
}

export default function AtAGlance({ open, setOpen }) {
  const [tickets, setTickets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [signals, setSignals] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      client.records.list("tickets", { limit: 50 }),
      client.records.list("incidents", { limit: 50 }),
      client.records.list("signals", { limit: 50 }),
      client.records.list("drafts", { limit: 50 }),
      client.records.list("audit_logs", { sort: [{ field: "created_at", direction: "desc" }], limit: 10 }),
    ])
      .then(([t, i, s, d, a]) => {
        setTickets(t.items || []);
        setIncidents(i.items || []);
        setSignals(s.items || []);
        setDrafts(d.items || []);
        setAuditLogs(a.items || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const criticalIncidents = incidents.filter((i) => i.severity === "urgent" || i.severity === "critical");
  const pendingDrafts = drafts.filter((d) => d.status === "pending");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#EFEFEF] bg-white p-6 shadow-lg"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">At a Glance</h2>
                <p className="text-sm text-zinc-400">Ctrl+Shift+G to toggle</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
                  ))}
                </div>
                <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
                  <KpiCard title="Open Tickets" value={openTickets.length} icon={TicketCheck} color="text-blue-600" />
                  <KpiCard title="Active Signals" value={signals.length} icon={Radio} color="text-accent" />
                  <KpiCard title="Critical Incidents" value={criticalIncidents.length} icon={ShieldAlert} color="text-red-600" />
                  <KpiCard title="Pending Drafts" value={pendingDrafts.length} icon={FileText} color="text-amber-600" />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">Recent Tickets</h3>
                    {tickets.length === 0 ? (
                      <p className="text-sm text-zinc-400">No tickets yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {tickets.slice(0, 6).map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-zinc-50 px-3 py-2">
                            <p className="truncate text-sm text-zinc-900 min-w-0 flex-1">{t.title || t.customer_name || t.id}</p>
                            <div className="ml-2 flex items-center gap-1.5 flex-shrink-0">
                              <PriorityBadge priority={t.priority} />
                              <StatusBadge status={t.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#EFEFEF] bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">Recent Activity</h3>
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-zinc-400">No activity recorded.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2 rounded-lg border border-[#EFEFEF] bg-zinc-50 px-3 py-2">
                            <Brain size={14} className="mt-0.5 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-900">{log.action}</p>
                              <p className="text-xs text-zinc-400">
                                {log.actor_agent_name || log.actor_type || "System"}
                                {log.created_at ? ` · ${format(new Date(log.created_at), "MMM d, HH:mm")}` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#EFEFEF] bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">Active Incidents</h3>
                  {incidents.length === 0 ? (
                    <p className="text-sm text-zinc-400">No active incidents.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {incidents.slice(0, 6).map((inc) => (
                        <div key={inc.id} className="flex items-center justify-between rounded-lg border border-[#EFEFEF] bg-zinc-50 px-3 py-2">
                          <p className="truncate text-sm text-zinc-900 min-w-0 flex-1">{inc.title || inc.id}</p>
                          <div className="ml-2 flex items-center gap-1.5 flex-shrink-0">
                            <PriorityBadge priority={inc.severity} />
                            <StatusBadge status={inc.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
