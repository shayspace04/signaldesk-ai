import {
  Brain,
  ArrowRight,
} from "lucide-react";

export default function RecommendationPanel({ signal }) {
  return (
    <div className="rounded-2xl border border-violet-700 bg-gradient-to-br from-violet-950 to-zinc-900 p-6">

      <div className="flex items-center gap-3">

        <Brain className="text-violet-400" />

        <h2 className="text-xl font-semibold">

          AI Recommendation

        </h2>

      </div>

      <p className="mt-6 text-zinc-300 leading-8">

        {signal.recommendation}

      </p>

      <div className="mt-8 flex gap-4">

        <button className="rounded-xl bg-violet-600 px-5 py-3 font-medium hover:bg-violet-500">

          Create Incident

        </button>

        <button className="rounded-xl border border-zinc-700 px-5 py-3 hover:bg-zinc-800">

          Investigate

        </button>

        <button className="rounded-xl border border-zinc-700 px-5 py-3 hover:bg-zinc-800 flex items-center gap-2">

          View Logs

          <ArrowRight size={16} />

        </button>

      </div>

    </div>
  );
}