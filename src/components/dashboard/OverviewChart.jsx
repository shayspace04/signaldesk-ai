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
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

      <h2 className="mb-6 text-lg font-semibold text-zinc-900">
        Signal Trend
      </h2>

      <div className="h-72">

        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={signalTrend}>

            <XAxis
              dataKey="day"
              stroke="#A1A1AA"
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #EFEFEF', borderRadius: '8px', fontSize: '13px' }}
              labelStyle={{ color: '#18181b' }}
            />

            <Line
              type="monotone"
              dataKey="signals"
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 4 }}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}
