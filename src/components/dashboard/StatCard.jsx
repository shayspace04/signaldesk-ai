import CountUp from "react-countup";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function StatCard({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  color = "text-violet-400",
}) {
  const numericValue = Number(String(value).replace("%", ""));

  return (
    <Card className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500 hover:shadow-xl hover:shadow-violet-500/10">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-zinc-400">
            {title}
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-white">
            {value}
          </h2>

        </div>

        <div className={`rounded-xl bg-zinc-900 p-3 ${color}`}>
          {Icon && <Icon size={26} />}
        </div>

      </div>

      <div className="mt-6 flex items-center gap-2">

        {positive ? (
          <ArrowUpRight className="text-green-500" size={16} />
        ) : (
          <ArrowDownRight className="text-red-500" size={16} />
        )}

        <span
          className={`font-medium ${
            positive ? "text-green-500" : "text-red-500"
          }`}
        >
          {change}
        </span>

        <span className="text-sm text-zinc-500">
          vs last week
        </span>

      </div>

    </Card>
  );
}