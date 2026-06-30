export default function TicketRow({
  ticket,
  onSelect,
}) {
  const priorityColors = {
    Critical: "bg-red-100 text-red-700",
    High: "bg-orange-100 text-orange-700",
    Medium: "bg-blue-100 text-blue-700",
    Low: "bg-green-100 text-green-700",
  };

  const statusColors = {
    "Waiting Approval": "text-yellow-600",
    "In Progress": "text-blue-600",
    Resolved: "text-green-600",
    Escalated: "text-red-600",
  };

  return (
    <tr
      onClick={() => onSelect(ticket)}
      className="cursor-pointer border-b border-[#EFEFEF] transition hover:bg-zinc-50 text-sm"
    >
      <td className="px-6 py-5 font-medium text-zinc-900">{ticket.id}</td>

      <td className="px-6 text-zinc-700">{ticket.customer}</td>

      <td className="px-6 text-zinc-700">{ticket.issue}</td>

      <td className="px-6">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            priorityColors[ticket.priority]
          }`}
        >
          {ticket.priority}
        </span>
      </td>

      <td className="px-6 text-zinc-700">{ticket.confidence}%</td>

      <td className="px-6 text-zinc-700">{ticket.sla}</td>

      <td className="px-6 text-zinc-700">{ticket.assignee}</td>

      <td className={`px-6 font-medium ${statusColors[ticket.status]}`}>
        {ticket.status}
      </td>
    </tr>
  );
}
