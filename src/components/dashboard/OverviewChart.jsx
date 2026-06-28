import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from "recharts";

import { signalTrend } from "@/data/chartData";

export default function OverviewChart() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 text-xl font-semibold">
        Signal Trend
      </h2>

      <div className="h-72">

        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={signalTrend}>

            <XAxis
              dataKey="day"
              stroke="#888"
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="signals"
              stroke="#8B5CF6"
              strokeWidth={3}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}