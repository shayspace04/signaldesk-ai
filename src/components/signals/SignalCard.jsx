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
          ? "border-violet-500 bg-violet-50"
          : "border-[#EFEFEF] bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex items-center justify-between">

        <div>

          <h3 className="font-semibold text-zinc-900">

            {signal.title}

          </h3>

          <p className="mt-1 text-sm text-zinc-500">

            {signal.region}

          </p>

        </div>

        <AlertTriangle
          className={`${
            signal.severity === "Critical"
              ? "text-red-500"
              : "text-orange-500"
          }`}
        />

      </div>

      <div className="mt-5 flex items-center justify-between">

        <span
          className={`rounded-full px-3 py-1 text-xs

          ${
            signal.severity === "Critical"
              ? "bg-red-100 text-red-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {signal.severity}
        </span>

        <ArrowRight
          size={18}
          className="text-zinc-400"
        />

      </div>

    </button>
  );
}
