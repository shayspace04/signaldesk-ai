import { useState } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Ticket,
} from "lucide-react";

const notifications = [
  {
    id: 1,
    icon: AlertTriangle,
    color: "text-red-400",
    title: "Critical Signal Detected",
    description: "Payment Failure Spike",
    time: "1 min ago",
  },
  {
    id: 2,
    icon: Brain,
    color: "text-violet-400",
    title: "Reply Agent Finished",
    description: "Ticket TKT-1024",
    time: "4 mins ago",
  },
  {
    id: 3,
    icon: Ticket,
    color: "text-blue-400",
    title: "New Ticket",
    description: "CRM Sync Failure",
    time: "8 mins ago",
  },
  {
    id: 4,
    icon: CheckCircle2,
    color: "text-green-400",
    title: "Approval Completed",
    description: "Response sent successfully",
    time: "10 mins ago",
  },
];

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-xl bg-zinc-900 p-3 hover:bg-zinc-800"
      >
        <Bell size={20} />

        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
      </button>

      {open && (

        <div className="absolute right-0 top-14 z-50 w-[380px] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">

          <div className="border-b border-zinc-800 p-5">

            <h2 className="text-lg font-semibold">
              Notifications
            </h2>

          </div>

          <div className="max-h-[500px] overflow-auto">

            {notifications.map((item) => {

              const Icon = item.icon;

              return (

                <div
                  key={item.id}
                  className="cursor-pointer border-b border-zinc-800 p-5 transition hover:bg-zinc-900"
                >

                  <div className="flex gap-4">

                    <Icon
                      size={20}
                      className={item.color}
                    />

                    <div>

                      <h3 className="font-medium">
                        {item.title}
                      </h3>

                      <p className="text-sm text-zinc-400">
                        {item.description}
                      </p>

                      <span className="mt-1 block text-xs text-zinc-500">
                        {item.time}
                      </span>

                    </div>

                  </div>

                </div>

              );

            })}

          </div>

        </div>

      )}

    </div>
  );
}