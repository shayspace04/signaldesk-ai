import { useState } from "react";

import TicketRow from "./TicketRow";
import TicketDrawer from "./TicketDrawer";

export default function TicketsTable({ tickets }) {
  const [selectedTicket, setSelectedTicket] = useState(null);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#EFEFEF] bg-white">

        <table className="w-full">

          <thead className="bg-zinc-50">

            <tr className="border-b border-[#EFEFEF] text-left text-xs uppercase tracking-wide text-zinc-500">

              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Customer</th>
              <th className="px-6 py-4 font-medium">Issue</th>
              <th className="px-6 py-4 font-medium">Priority</th>
              <th className="px-6 py-4 font-medium">AI</th>
              <th className="px-6 py-4 font-medium">SLA</th>
              <th className="px-6 py-4 font-medium">Assignee</th>
              <th className="px-6 py-4 font-medium">Status</th>

            </tr>

          </thead>

          <tbody>

            {tickets.length === 0 ? (

              <tr>

                <td
                  colSpan={8}
                  className="py-12 text-center text-zinc-400"
                >
                  No tickets found.
                </td>

              </tr>

            ) : (

              tickets.map((ticket) => (

                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onSelect={setSelectedTicket}
                />

              ))

            )}

          </tbody>

        </table>

      </div>

      {selectedTicket && (
        <TicketDrawer
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </>
  );
}
