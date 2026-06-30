import { motion } from "framer-motion";
import { useState } from "react";
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import { useRefreshListener } from "@/lib/refreshEvents";
import useRole from "@/hooks/useRole";
import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";
import client from "@/lib/lemmaClient";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function Incidents() {
  const { workspace } = useWorkspace();
  const { data: incidents, loading, refresh: refreshIncidents } = useLemmaRecords("incidents", { limit: 50 });
  const { data: tickets, refresh: refreshTickets } = useLemmaRecords("tickets", { limit: 200 });
  useRefreshListener(() => { refreshIncidents(); refreshTickets(); });
  const { canCompleteApproval } = useRole();
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);

  const current = selected || incidents[0] || null;

  const relatedTickets = current
    ? tickets.filter((t) => t.signal_id === current.signal_id)
    : [];

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-10 bg-white pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="mt-1 text-sm text-zinc-400">Track and investigate active incidents.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100" />)}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100 lg:col-span-3" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20">
          <ShieldAlert size={36} className="mb-3 text-zinc-300" />
          <p className="text-zinc-600 font-medium">No incidents</p>
          <p className="text-sm text-zinc-400">{workspace.name} — all systems operational.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            {incidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setSelected(inc)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    current?.id === inc.id
                      ? "border-accent bg-zinc-50"
                      : "border-[#EFEFEF] bg-white hover:bg-zinc-50"
                  }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold text-zinc-900">{inc.title || inc.id}</h3>
                  <PriorityBadge priority={inc.severity} />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  {inc.affected_ticket_count ? `${inc.affected_ticket_count} affected tickets` : ""}
                  {inc.status ? ` · ${inc.status}` : ""}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {current && (
              <div className="space-y-5 rounded-xl border border-[#EFEFEF] bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900">{current.title || current.id}</h2>
                      <p className="mt-1 text-sm text-zinc-400">{current.summary || ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={current.status} />
                      {canCompleteApproval && current.status !== "resolved" && (
                        <button
                          onClick={async () => {
                            setResolving(true);
                            try {
                              await client.records.update("incidents", current.id, { status: "resolved", resolution_notes: "Resolved by Support Manager" });
                              toast.success("Incident resolved");
                              refreshIncidents();
                              refreshTickets();
                            } catch (err) {
                              toast.error(err?.message || "Failed to resolve incident");
                            } finally {
                              setResolving(false);
                            }
                          }}
                          disabled={resolving}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <p className="text-xs text-zinc-400">Severity</p>
                    <PriorityBadge priority={current.severity} />
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <p className="text-xs text-zinc-400">Affected</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{current.affected_ticket_count || "N/A"} tickets</p>
                  </div>
                  {current.owner_user_id && (
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-400">Owner</p>
                      <p className="mt-1 text-sm font-medium text-zinc-900">{current.owner_user_id}</p>
                    </div>
                  )}
                  {current.opened_at && (
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-400">Opened</p>
                      <p className="mt-1 text-sm font-medium text-zinc-900">{format(new Date(current.opened_at), "MMM d, HH:mm")}</p>
                    </div>
                  )}
                </div>

                {current.description && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</p>
                    <p className="rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-600">{current.description}</p>
                  </div>
                )}

                {current.blast_radius && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Blast Radius</p>
                    <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{current.blast_radius}</p>
                  </div>
                )}

                {relatedTickets.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Related Tickets ({relatedTickets.length})</p>
                    <div className="space-y-2">
                      {relatedTickets.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-zinc-900">{t.title || t.customer_name || t.id}</p>
                            <p className="text-xs text-zinc-400">{t.customer_name || ""}</p>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {current.resolution_notes && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Resolution Notes</p>
                    <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{current.resolution_notes}</p>
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
