const PRIORITY_COLORS = {
  urgent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  normal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  low: "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark",
};

export default function PriorityBadge({ priority }) {
  const key = (priority || "").toLowerCase();
  const colors = PRIORITY_COLORS[key] || "bg-zinc-100 dark:bg-zinc-900/30 text-muted-base dark:text-muted-dark";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {priority}
    </span>
  );
}
