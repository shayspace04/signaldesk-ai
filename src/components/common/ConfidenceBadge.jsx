export default function ConfidenceBadge({ value }) {
  const num = Number(value) || 0;
  let colors = "bg-red-100 text-red-700";
  if (num >= 90) colors = "bg-green-100 text-green-700";
  else if (num >= 70) colors = "bg-yellow-100 text-yellow-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {num}%
    </span>
  );
}
