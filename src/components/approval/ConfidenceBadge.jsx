export default function ConfidenceBadge({ value }) {

  const color =
    value >= 95
      ? "bg-green-500"
      : value >= 80
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">

      <div
        className={`w-3 h-3 rounded-full ${color}`}
      />

      <span className="text-sm text-zinc-600">
        {value}% Confidence
      </span>

    </div>
  );
}
