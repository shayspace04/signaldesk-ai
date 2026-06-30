import CountUp from "react-countup";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function StatCard({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
  color = "text-violet-500",
}) {
  const numericValue = Number(String(value).replace("%", ""));

  return (
    <Card className="group rounded-2xl border border-[#EFEFEF] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-zinc-500">
            {title}
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-zinc-900">
            {value}
          </h2>

        </div>

        <div className={`rounded-xl bg-zinc-100 p-3 ${color}`}>
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
            positive ? "text-green-600" : "text-red-600"
          }`}
        >
          {change}
        </span>

        <span className="text-sm text-zinc-400">
          vs last week
        </span>

      </div>

    </Card>
  );
}
