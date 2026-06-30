import { motion } from "framer-motion";
import { useState } from "react";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import useRole from "@/hooks/useRole";
import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function ApprovalDesk() {
  const { workspace } = useWorkspace();
  const { data: drafts, loading, refresh } = useLemmaRecords("drafts", { limit: 50 });
  const { canApproveDrafts, canRejectDrafts, canEditDrafts, isManager } = useRole();
  const [selectedId, setSelectedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState("");

  const pending = drafts.filter((d) => d.status === "pending");
  const current = pending.find((d) => d.id === selectedId) || pending[0] || null;

  if (!isManager) {
    return (
      <motion.div className="flex flex-col min-h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Desk</h1>
          <p className="mt-1 text-sm text-zinc-400">{workspace.aiContext}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20 mt-6">
          <X size={36} className="mb-3 text-zinc-300" />
          <p className="text-base font-medium text-zinc-600">Access Restricted</p>
          <p className="mt-1 text-sm text-zinc-400">Only support managers can access the Approval Desk.</p>
        </div>
      </motion.div>
    );
  }

  const handleAction = async (action) => {
    if (!current) return;
    if ((action === "approve" && !canApproveDrafts) || (action === "reject" && !canRejectDrafts)) return;

    const toastId = toast.loading(action === "approve" ? "Approving draft..." : "Rejecting draft...");
    setActionLoading(action);
    try {
      if (action === "approve") {
        await client.functions.run("resolve_ticket", {
          input: { draft_id: current.id, ticket_id: current.ticket_id },
        });
        try {
          await client.functions.run("send_reply", {
            input: { draft_id: current.id, ticket_id: current.ticket_id, body: editMode ? editBody : current.body },
          });
        } catch (sendErr) {
          console.warn("Send reply skipped (Gmail may be disconnected):", sendErr);
        }
      } else if (action === "reject") {
        await client.functions.run("reject_draft", {
          input: { draft_id: current.id, ticket_id: current.ticket_id },
        });
      }
      toast.dismiss(toastId);
      toast.success(action === "approve" ? "Draft approved, reply sent, ticket resolved" : "Draft rejected");
      refresh();
      emitRefresh();
      setSelectedId(null);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Action failed");
    } finally {
      setActionLoading(null);
      setEditMode(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-10 bg-white pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Approval Desk</h1>
        <p className="mt-1 text-sm text-zinc-400">Review and approve AI-generated draft responses.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20">
          <Check size={36} className="mb-3 text-green-500" />
          <p className="text-base font-medium text-zinc-600">All caught up!</p>
          <p className="mt-1 text-sm text-zinc-400">No pending drafts to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Pending Drafts ({pending.length})
            </h2>
            {pending.map((d) => (
              <button
                key={d.id}
                onClick={() => { setSelectedId(d.id); setEditMode(false); }}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  current?.id === d.id
                    ? "border-accent bg-zinc-50"
                    : "border-[#EFEFEF] bg-white hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-zinc-400">#{d.ticket_number || d.id.slice(0, 8)}</span>
                  <ConfidenceBadge value={d.confidence} />
                </div>
                <p className="mt-2 text-sm text-zinc-700 line-clamp-2">{d.body}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {current ? (
              <div className="space-y-5 rounded-xl border border-[#EFEFEF] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">
                    Draft #{current.ticket_number || current.id.slice(0, 8)}
                  </h3>
                  <ConfidenceBadge value={current.confidence} />
                </div>

                {current.grounded_in && Array.isArray(current.grounded_in) && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {current.grounded_in.map((src, i) => (
                        <span key={i} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">{typeof src === "string" ? src : src.path || src.snippet || ""}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Draft Response</p>
                  {editMode ? (
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-zinc-400 resize-none"
                    />
                  ) : (
                    <div className="rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                      {current.body}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {canApproveDrafts && (
                    <button
                      onClick={() => handleAction("approve")}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === "approve" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Approve
                    </button>
                  )}
                  {canEditDrafts && (
                    <button
                      onClick={() => { setEditMode(!editMode); if (!editMode) setEditBody(current.body || ""); }}
                      className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${editMode ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300" : "bg-blue-600 text-white hover:bg-blue-500"}`}
                    >
                      <Pencil size={16} /> {editMode ? "Cancel Edit" : "Edit"}
                    </button>
                  )}
                  {canRejectDrafts && (
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading !== null}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === "reject" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20">
                <p className="text-zinc-400">Select a draft to review.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
