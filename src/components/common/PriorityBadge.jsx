const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-zinc-100 text-zinc-500 dark:text-[#A1A1AA]",
};

export default function PriorityBadge({ priority }) {
  const key = (priority || "").toLowerCase();
  const colors = PRIORITY_COLORS[key] || "bg-zinc-100 text-zinc-500 dark:text-[#A1A1AA]";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {priority}
    </span>
  );
}
