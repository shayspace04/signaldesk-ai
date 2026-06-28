import { useState } from "react";

import TicketRow from "./TicketRow";
import TicketDrawer from "./TicketDrawer";

export default function TicketsTable({ tickets }) {
  const [selectedTicket, setSelectedTicket] = useState(null);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

        <table className="w-full">

          <thead className="bg-zinc-950">

            <tr className="border-b border-zinc-800 text-left text-sm uppercase tracking-wide text-zinc-500">

              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Issue</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">AI</th>
              <th className="px-6 py-4">SLA</th>
              <th className="px-6 py-4">Assignee</th>
              <th className="px-6 py-4">Status</th>

            </tr>

          </thead>

          <tbody>

            {tickets.length === 0 ? (

              <tr>

                <td
                  colSpan={8}
                  className="py-12 text-center text-zinc-500"
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