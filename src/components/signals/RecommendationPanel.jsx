import {
  Brain,
  ArrowRight,
} from "lucide-react";

export default function RecommendationPanel({ signal }) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6">

      <div className="flex items-center gap-3">

        <Brain className="text-violet-600" />

        <h2 className="text-xl font-semibold text-zinc-900">

          AI Recommendation

        </h2>

      </div>

      <p className="mt-6 text-zinc-700 leading-8">

        {signal.recommendation}

      </p>

      <div className="mt-8 flex gap-4">

        <button className="rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-500">

          Create Incident

        </button>

        <button className="rounded-xl border border-[#EFEFEF] bg-white px-5 py-3 text-zinc-700 hover:bg-zinc-50">

          Investigate

        </button>

        <button className="rounded-xl border border-[#EFEFEF] bg-white px-5 py-3 text-zinc-700 hover:bg-zinc-50 flex items-center gap-2">

          View Logs

          <ArrowRight size={16} />

        </button>

      </div>

    </div>
  );
}
