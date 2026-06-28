import { FileText } from "lucide-react";

export default function EvidencePanel({ signal }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-cyan-400" />

        <h2 className="text-xl font-semibold">
          Evidence
        </h2>
      </div>

      <div className="space-y-3">
        {signal.evidence.map((item) => (
          <div
            key={item}
            className="rounded-xl bg-zinc-950 border border-zinc-800 p-4"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}