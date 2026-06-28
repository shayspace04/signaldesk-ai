import ConfidenceBadge from "./ConfidenceBadge";

export default function TicketCard({ ticket }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">

      <div className="flex justify-between items-start">

        <div>
          <h2 className="text-xl font-semibold">
            {ticket.subject}
          </h2>

          <p className="text-zinc-400 mt-1">
            {ticket.customer} • {ticket.company}
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-sm font-medium
          ${
            ticket.priority === "Critical"
              ? "bg-red-500/20 text-red-400"
              : ticket.priority === "High"
              ? "bg-orange-500/20 text-orange-400"
              : "bg-blue-500/20 text-blue-400"
          }`}
        >
          {ticket.priority}
        </span>

      </div>

      <div>
        <p className="text-sm text-zinc-400 mb-2">
          Summary
        </p>

        <p className="text-zinc-200 leading-7">
          {ticket.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        <div>
          <p className="text-zinc-500 text-sm">
            Ticket ID
          </p>

          <p className="font-medium mt-1">
            {ticket.id}
          </p>
        </div>

        <div>
          <p className="text-zinc-500 text-sm">
            Assigned Agent
          </p>

          <p className="font-medium mt-1 capitalize">
            {ticket.assignedAgent}
          </p>
        </div>

        <div>
          <p className="text-zinc-500 text-sm">
            Created
          </p>

          <p className="font-medium mt-1">
            {ticket.created}
          </p>
        </div>

        <div>
          <ConfidenceBadge value={ticket.confidence} />
        </div>

      </div>

    </div>
  );
}