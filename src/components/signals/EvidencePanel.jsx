import { FileText } from "lucide-react";

export default function EvidencePanel({ signal }) {
  return (
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-cyan-500" />

        <h2 className="text-xl font-semibold text-zinc-900">
          Evidence
        </h2>
      </div>

      <div className="space-y-3">
        {signal.evidence.map((item) => (
          <div
            key={item}
            className="rounded-xl bg-zinc-50 border border-[#EFEFEF] p-4 text-zinc-700"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
