import RootCausePanel from "./RootCausePanel";
import EvidencePanel from "./EvidencePanel";
import RecommendationPanel from "./RecommendationPanel";
import ImpactPanel from "./ImpactPanel";

export default function SignalDetails({ signal }) {

  return (

    <div className="space-y-6">

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

        <h1 className="text-3xl font-bold">

          {signal.title}

        </h1>

        <p className="mt-4 text-zinc-400">

          {signal.summary}

        </p>

      </div>

      <RootCausePanel signal={signal} />

      <EvidencePanel signal={signal} />

      <ImpactPanel signal={signal} />

      <RecommendationPanel signal={signal} />

    </div>

  );

}