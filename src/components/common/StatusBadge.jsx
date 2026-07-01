const STATUS_LABELS = {
  closed: "Resolved",
  memory: "Resolved",
};

const STATUS_COLORS = {
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  memory: "bg-green-100 text-green-700",
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  triaged: "bg-yellow-100 text-yellow-700",
  waiting_approval: "bg-purple-100 text-purple-700",
  open: "bg-blue-100 text-blue-700",
  investigating: "bg-yellow-100 text-yellow-700",
  monitoring: "bg-cyan-100 text-cyan-700",
  closed: "bg-zinc-100 text-zinc-500 dark:text-[#A1A1AA]",
  in_progress: "bg-yellow-100 text-yellow-700",
  escalated: "bg-orange-100 text-orange-700",
  sent: "bg-emerald-100 text-emerald-700",
};

export default function StatusBadge({ status }) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_");
  const colors = STATUS_COLORS[key] || "bg-zinc-100 text-zinc-500 dark:text-[#A1A1AA]";
  const label = STATUS_LABELS[key] || status;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
