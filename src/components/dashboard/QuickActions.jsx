import {
  Plus,
  ShieldAlert,
  Brain,
  Ticket,
} from "lucide-react";

const actions = [
  {
    title: "Create Incident",
    icon: ShieldAlert,
  },
  {
    title: "New Ticket",
    icon: Ticket,
  },
  {
    title: "Run AI Analysis",
    icon: Brain,
  },
  {
    title: "Create Signal",
    icon: Plus,
  },
];

export default function QuickActions() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 text-xl font-semibold">

        Quick Actions

      </h2>

      <div className="grid grid-cols-2 gap-4">

        {actions.map((action) => {

          const Icon = action.icon;

          return (

            <button
              key={action.title}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-violet-500 hover:bg-zinc-800"
            >

              <Icon
                className="mb-3 text-violet-400"
                size={22}
              />

              <p>

                {action.title}

              </p>

            </button>

          );

        })}

      </div>

    </div>
  );
}