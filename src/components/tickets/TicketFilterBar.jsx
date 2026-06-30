export default function TicketFilterBar({
  priority,
  setPriority,
  status,
  setStatus,
}) {
  return (
    <div className="flex gap-4">

      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="rounded-lg border border-[#EFEFEF] bg-white px-4 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-300"
      >
        <option value="All">All Priorities</option>
        <option>Critical</option>
        <option>High</option>
        <option>Medium</option>
      </select>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg border border-[#EFEFEF] bg-white px-4 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-300"
      >
        <option value="All">All Status</option>
        <option>Waiting Approval</option>
        <option>In Progress</option>
        <option>Resolved</option>
        <option>Escalated</option>
      </select>

    </div>
  );
}
