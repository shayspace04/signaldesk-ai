import { BrainCircuit } from "lucide-react";

export default function RecommendationCard() {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6">

      <div className="flex items-center gap-3">

        <BrainCircuit className="text-violet-600" />

        <h2 className="text-lg font-semibold text-zinc-900">

          AI Recommendation

        </h2>

      </div>

      <p className="mt-5 text-zinc-700 leading-7">

        Payment failures have increased by
        <span className="font-semibold text-zinc-900"> 41%</span> in the
        last 30 minutes.

        The AI recommends escalating this incident
        and notifying the engineering team immediately.

      </p>

      <div className="mt-6">

        <span className="rounded-full bg-violet-600 px-3 py-1 text-sm text-white">

          Confidence 97%

        </span>

      </div>

    </div>
  );
}
