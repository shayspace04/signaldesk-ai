import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { useChurnRisk } from "@/lib/churnRisk";

const LEVEL_STYLES = {
  Critical: { border: "border-red-500", text: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
  High: { border: "border-orange-500", text: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
  Medium: { border: "border-yellow-500", text: "text-yellow-600", bg: "bg-yellow-50", icon: Clock },
  Low: { border: "border-green-500", text: "text-green-600", bg: "bg-green-50", icon: Clock },
};

export default function ChurnRiskCard({ ticket }) {
  const risk = useChurnRisk(ticket);

  if (!risk) return null;

  if (risk.resolved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-green-600" />
          <span className="text-sm font-medium text-green-700">Churn Risk Eliminated</span>
        </div>
      </div>
    );
  }

  const styles = LEVEL_STYLES[risk.riskLevel] || LEVEL_STYLES.Low;
  const Icon = styles.icon;

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={18} className={styles.text} />
          <span className={`text-sm font-semibold ${styles.text}`}>
            {risk.riskLevel} Churn Risk
          </span>
        </div>
        <span className="text-2xl font-bold text-zinc-900 dark:text-[#FAFAFA]">{risk.riskPercent}%</span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-[#A1A1AA]">
        <Clock size={14} />
        <span>
          Estimated churn if unresolved:{" "}
          <span className="text-zinc-700 dark:text-[#FAFAFA] font-medium">{risk.remainingFormatted}</span>
        </span>
      </div>

      <div className="text-xs text-zinc-400 dark:text-[#71717A]">
        {risk.reasons.map((r, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1">·</span>}
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
