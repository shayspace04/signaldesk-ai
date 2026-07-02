import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { useChurnRisk } from "@/lib/churnRisk";

const LEVEL_STYLES = {
  Critical: { border: "border-red-500 dark:border-red-400", text: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950", icon: AlertTriangle },
  High: { border: "border-orange-500 dark:border-orange-400", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950", icon: AlertTriangle },
  Medium: { border: "border-yellow-500 dark:border-yellow-400", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950", icon: Clock },
  Low: { border: "border-green-500 dark:border-green-400", text: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950", icon: Clock },
};

export default function ChurnRiskCard({ ticket }) {
  const risk = useChurnRisk(ticket);

  if (!risk) return null;

  if (risk.resolved) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">Churn Risk Eliminated</span>
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
        <span className="text-2xl font-bold text-primary dark:text-zinc-50">{risk.riskPercent}%</span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-base dark:text-muted-dark">
        <Clock size={14} />
        <span>
          Estimated churn if unresolved:{" "}
          <span className="text-body dark:text-zinc-50 font-medium">{risk.remainingFormatted}</span>
        </span>
      </div>

      <div className="text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-500">
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
