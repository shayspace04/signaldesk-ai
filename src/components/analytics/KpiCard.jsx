import { useMemo } from "react";
import c from "react-countup";
const CountUp = c.default;

function Sparkline({ data, color }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = data.length * 6;
    const h = 24;
    const pts = data.map((v, i) => `${i * 6 + 2},${h - ((v - min) / range) * (h - 4) - 2}`);
    return `M${pts.join(" L")}`;
  }, [data]);

  if (!data || data.length < 2) return null;

  return (
    <svg width={data.length * 6} height={24} className="flex-shrink-0 overflow-visible">
      <path d={path} fill="none" stroke={color || "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40" />
    </svg>
  );
}

export default function KpiCard({ icon: Icon, color, value, label, loading, trend, sparklineData, onClick }) {
  const trendUp = trend?.startsWith("+");
  const trendDown = trend?.startsWith("-");
  const trendColor = trendUp ? "text-emerald-500 dark:text-emerald-400" : trendDown ? "text-red-500 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500";

  return (
    <button onClick={onClick} className="relative w-full text-left rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-sm transition-all duration-200 hover:shadow-card hover:border-zinc-300 dark:hover:border-border-dark cursor-pointer">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg bg-zinc-100 dark:bg-[#202024] p-2.5 w-fit mb-3 ${color}`}>
          {Icon && <Icon size={18} />}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            {trendUp ? "\u25B2" : trendDown ? "\u25BC" : "\u2014"}
            <span>{trend?.replace("+", "").replace("-", "")}</span>
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[28px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">
            {loading ? <div className="h-7 w-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /> : <CountUp end={value} duration={1.5} />}
          </p>
          <p className="text-sm text-muted dark:text-muted-dark mt-1">{label}</p>
        </div>
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline data={sparklineData} color={trendUp ? "#10b981" : trendDown ? "#ef4444" : "#a1a1aa"} />
        )}
      </div>
    </button>
  );
}
