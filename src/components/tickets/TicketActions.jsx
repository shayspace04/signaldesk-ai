import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";

const ACTIONS = [
  { key: "assign", label: "Assign", field: "assignee", value: "me", successMsg: "Ticket assigned to you", color: "bg-violet-600 hover:bg-violet-500" },
  { key: "resolve", label: "Resolve", field: "status", value: "resolved", successMsg: "Ticket resolved", color: "bg-green-600 hover:bg-green-500" },
  { key: "escalate", label: "Escalate", field: "priority", value: "urgent", successMsg: "Ticket escalated to urgent", color: "bg-yellow-600 hover:bg-yellow-500" },
  { key: "close", label: "Close", field: "status", value: "closed", successMsg: "Ticket closed", color: "bg-red-600 hover:bg-red-500" },
];

export default function TicketActions({ ticket, onRefresh }) {
  const [loading, setLoading] = useState(null);

  const handleAction = async (action) => {
    const toastId = toast.loading(`${action.label}...`);
    setLoading(action.key);
    try {
      await client.records.update("tickets", ticket.id, { [action.field]: action.value });
      toast.dismiss(toastId);
      toast.success(action.successMsg);
      if (onRefresh) onRefresh();
      client.functions.run("detect_and_link_signal", { input: { ticket_id: ticket.id } })
        .catch(() => {})
        .finally(() => emitRefresh());
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || `Failed to ${action.key} ticket`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-6">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => handleAction(action)}
            disabled={loading !== null}
            className={`rounded-lg py-3 font-medium text-white transition disabled:opacity-50 ${action.color}`}
          >
            {loading === action.key ? <Loader2 size={18} className="mx-auto animate-spin" /> : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
