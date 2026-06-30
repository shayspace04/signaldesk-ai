import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TicketSummary from "./TicketSummary";
import TicketTimeline from "./TicketTimeline";
import TicketActions from "./TicketActions";
import ChurnRiskCard from "@/components/common/ChurnRiskCard";
import useRole from "@/hooks/useRole";
import client from "@/lib/lemmaClient";
import { emitRefresh } from "@/lib/refreshEvents";

export default function TicketDrawer({ ticket, onClose, onRefresh }) {
  const { canGenerateDrafts } = useRole();
  const [generating, setGenerating] = useState(false);

  const handleGenerateDraft = async () => {
    const toastId = toast.loading("Generating AI draft reply...");
    setGenerating(true);
    try {
      await client.functions.run("generate_draft_reply", {
        input: { ticket_id: ticket.id },
      });
      toast.dismiss(toastId);
      toast.success("Draft reply generated and pending approval");
      if (onRefresh) onRefresh();
      emitRefresh();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to generate draft reply");
    } finally {
      setGenerating(false);
    }
  };

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">

      <div className="h-screen w-[540px] overflow-y-auto border-l border-[#EFEFEF] bg-white p-8">

        <div className="mb-8 flex items-center justify-between">

          <div>
            <h1 className="text-xl font-bold leading-tight text-zinc-900">
              {ticket.title || ticket.id}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {ticket.customer_name || ticket.customer_email || ticket.customer}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            Close
          </button>

        </div>

        <TicketSummary ticket={ticket} />

        <div className="mt-6">
          <ChurnRiskCard ticket={ticket} />
        </div>

        {canGenerateDrafts && (
          <div className="mt-6">
            <button
              onClick={handleGenerateDraft}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              {generating ? (
                <><Loader2 size={18} className="animate-spin" /> Generating...</>
              ) : (
                <><Sparkles size={18} /> Generate AI Draft Reply</>
              )}
            </button>
          </div>
        )}

        <div className="mt-8">
          <TicketTimeline ticketId={ticket.id} />
        </div>

        <div className="mt-8">
          <TicketActions ticket={ticket} onRefresh={onRefresh} />
        </div>

      </div>

    </div>
  );
}
