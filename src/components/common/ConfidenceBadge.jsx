export default function ConfidenceBadge({ value }) {
  const num = Number(value) || 0;
  let colors = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  if (num >= 90) colors = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  else if (num >= 70) colors = "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {num}%
    </span>
  );
}
