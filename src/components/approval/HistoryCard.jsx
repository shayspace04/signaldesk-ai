import {
  CheckCircle2,
  Bot,
  Brain,
  BookOpen,
  Clock3,
} from "lucide-react";

const icons = [
  CheckCircle2,
  Brain,
  BookOpen,
  Bot,
];

const colors = [
  "text-green-400",
  "text-orange-400",
  "text-cyan-400",
  "text-violet-400",
];

export default function HistoryCard({ ticket }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">

        <Clock3 size={20} />

        AI Decision Timeline

      </h2>

      <div className="space-y-6">

        {ticket.history.map((step, index) => {

          const Icon = icons[index] || CheckCircle2;

          return (

            <div
              key={step}
              className="flex items-start gap-4"
            >

              <div
                className={`rounded-full bg-zinc-950 p-3 ${colors[index]}`}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1">

                <p className="font-medium text-white">

                  {step}

                </p>

                <p className="text-sm text-zinc-500">

                  09:2{index} AM

                </p>

              </div>

            </div>

          );

        })}

      </div>

    </div>
  );
}