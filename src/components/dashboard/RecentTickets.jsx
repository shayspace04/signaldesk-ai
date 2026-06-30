import ticketData from "@/data/ticketData";

export default function RecentTickets() {
  return (
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

      <div className="flex items-center justify-between mb-6">

        <h2 className="text-lg font-semibold text-zinc-900">
          Recent Tickets
        </h2>

        <button className="text-sm text-accent hover:opacity-80">
          View All
        </button>

      </div>

      <table className="w-full">

        <thead>

          <tr className="border-b border-[#EFEFEF] text-left text-zinc-500">

            <th className="pb-3 text-xs font-medium uppercase tracking-wider">ID</th>

            <th className="pb-3 text-xs font-medium uppercase tracking-wider">Customer</th>

            <th className="pb-3 text-xs font-medium uppercase tracking-wider">Issue</th>

            <th className="pb-3 text-xs font-medium uppercase tracking-wider">Priority</th>

            <th className="pb-3 text-xs font-medium uppercase tracking-wider">Status</th>

          </tr>

        </thead>

        <tbody>

          {ticketData.map((ticket) => (

            <tr
              key={ticket.id}
              className="border-b border-[#EFEFEF] hover:bg-zinc-50 transition text-sm"
            >

              <td className="py-4 text-zinc-700">{ticket.id}</td>

              <td className="text-zinc-700">{ticket.customer}</td>

              <td className="text-zinc-700">{ticket.issue}</td>

              <td>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium

                  ${
                    ticket.priority === "Critical"
                      ? "bg-red-100 text-red-700"
                      : ticket.priority === "High"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  }

                  `}
                >
                  {ticket.priority}
                </span>

              </td>

              <td className="text-zinc-500">

                {ticket.status}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}
