import TicketSummary from "./TicketSummary";
import TicketTimeline from "./TicketTimeline";
import TicketActions from "./TicketActions";

export default function TicketDrawer({ ticket, onClose }) {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">

      <div className="h-screen w-[540px] overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-8">

        <div className="mb-8 flex items-center justify-between">

          <div>

            <h1 className="text-2xl font-bold">
              {ticket.id}
            </h1>

            <p className="text-zinc-500">
              {ticket.customer}
            </p>

          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
          >
            Close
          </button>

        </div>

        <TicketSummary ticket={ticket} />

        <div className="mt-8">
          <TicketTimeline />
        </div>

        <div className="mt-8">
          <TicketActions />
        </div>

      </div>

    </div>
  );
}