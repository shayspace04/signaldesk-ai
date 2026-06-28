export default function TicketRow({
  ticket,
  onSelect,
}) {
  const priorityColors = {
    Critical: "bg-red-500/20 text-red-400",
    High: "bg-orange-500/20 text-orange-400",
    Medium: "bg-blue-500/20 text-blue-400",
    Low: "bg-green-500/20 text-green-400",
  };

  const statusColors = {
    "Waiting Approval": "text-yellow-400",
    "In Progress": "text-blue-400",
    Resolved: "text-green-400",
    Escalated: "text-red-400",
  };

  return (
    <tr
      onClick={() => onSelect(ticket)}
      className="cursor-pointer border-b border-zinc-800 transition hover:bg-zinc-800/40"
    >
      <td className="px-6 py-5 font-medium">{ticket.id}</td>

      <td className="px-6">{ticket.customer}</td>

      <td className="px-6">{ticket.issue}</td>

      <td className="px-6">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            priorityColors[ticket.priority]
          }`}
        >
          {ticket.priority}
        </span>
      </td>

      <td className="px-6">{ticket.confidence}%</td>

      <td className="px-6">{ticket.sla}</td>

      <td className="px-6">{ticket.assignee}</td>

      <td className={`px-6 ${statusColors[ticket.status]}`}>
        {ticket.status}
      </td>
    </tr>
  );
}