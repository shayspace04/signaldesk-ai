import ConfidenceBadge from "./ConfidenceBadge";

export default function TicketCard({ ticket }) {
  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-6 space-y-5">

      <div className="flex justify-between items-start">

        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            {ticket.subject}
          </h2>

          <p className="text-zinc-500 mt-1">
            {ticket.customer} • {ticket.company}
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-sm font-medium
          ${
            ticket.priority === "Critical"
              ? "bg-red-100 text-red-700"
              : ticket.priority === "High"
              ? "bg-orange-100 text-orange-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {ticket.priority}
        </span>

      </div>

      <div>
        <p className="text-sm text-zinc-500 mb-2">
          Summary
        </p>

        <p className="text-zinc-700 leading-7">
          {ticket.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        <div>
          <p className="text-zinc-400 text-sm">
            Ticket ID
          </p>

          <p className="font-medium mt-1 text-zinc-900">
            {ticket.id}
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Assigned Agent
          </p>

          <p className="font-medium mt-1 text-zinc-900 capitalize">
            {ticket.assignedAgent}
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Created
          </p>

          <p className="font-medium mt-1 text-zinc-900">
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
