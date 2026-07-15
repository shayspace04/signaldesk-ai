const STATUS_LABELS = {
  closed: "Closed",
  memory: "Archived",
};

const STATUS_COLORS = {
  pending: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  approved: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  memory: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  new: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  in_review: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  resolved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  triaged: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  waiting_approval: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  open: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  investigating: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  monitoring: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
  closed: "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark",
  in_progress: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  escalated: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  sent: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

export default function StatusBadge({ status }) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_");
  const colors = STATUS_COLORS[key] || "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark";
  const label = STATUS_LABELS[key] || status;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
