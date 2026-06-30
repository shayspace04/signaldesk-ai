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
  "text-green-600",
  "text-orange-600",
  "text-cyan-600",
  "text-violet-600",
];

export default function HistoryCard({ ticket }) {
  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-6">

      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-zinc-900">

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
                className={`rounded-full bg-zinc-100 p-3 ${colors[index]}`}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1">

                <p className="font-medium text-zinc-900">

                  {step}

                </p>

                <p className="text-sm text-zinc-400">

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
