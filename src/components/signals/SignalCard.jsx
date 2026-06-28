import {
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function SignalCard({
  signal,
  selected,
  onSelect,
}) {
  return (
    <button
      onClick={() => onSelect(signal)}
      className={`w-full rounded-xl border p-5 text-left transition-all duration-300

      ${
        selected
          ? "border-violet-500 bg-violet-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">

        <div>

          <h3 className="font-semibold text-white">

            {signal.title}

          </h3>

          <p className="mt-1 text-sm text-zinc-400">

            {signal.region}

          </p>

        </div>

        <AlertTriangle
          className={`${
            signal.severity === "Critical"
              ? "text-red-400"
              : "text-orange-400"
          }`}
        />

      </div>

      <div className="mt-5 flex items-center justify-between">

        <span
          className={`rounded-full px-3 py-1 text-xs

          ${
            signal.severity === "Critical"
              ? "bg-red-500/20 text-red-400"
              : "bg-orange-500/20 text-orange-400"
          }`}
        >
          {signal.severity}
        </span>

        <ArrowRight
          size={18}
          className="text-zinc-500"
        />

      </div>

    </button>
  );
}