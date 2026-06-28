import ticketData from "@/data/ticketData";

export default function RecentTickets() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="flex items-center justify-between mb-6">

        <h2 className="text-xl font-semibold">
          Recent Tickets
        </h2>

        <button className="text-sm text-violet-400 hover:text-violet-300">
          View All
        </button>

      </div>

      <table className="w-full">

        <thead>

          <tr className="border-b border-zinc-800 text-left text-zinc-500">

            <th className="pb-3">ID</th>

            <th className="pb-3">Customer</th>

            <th className="pb-3">Issue</th>

            <th className="pb-3">Priority</th>

            <th className="pb-3">Status</th>

          </tr>

        </thead>

        <tbody>

          {ticketData.map((ticket) => (

            <tr
              key={ticket.id}
              className="border-b border-zinc-800 hover:bg-zinc-800/40 transition"
            >

              <td className="py-4">{ticket.id}</td>

              <td>{ticket.customer}</td>

              <td>{ticket.issue}</td>

              <td>

                <span
                  className={`rounded-full px-3 py-1 text-xs

                  ${
                    ticket.priority === "Critical"
                      ? "bg-red-500/20 text-red-400"
                      : ticket.priority === "High"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-blue-500/20 text-blue-400"
                  }

                  `}
                >
                  {ticket.priority}
                </span>

              </td>

              <td className="text-zinc-400">

                {ticket.status}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}