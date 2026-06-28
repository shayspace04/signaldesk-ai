import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const services = [
  {
    name: "Triage Agent",
    status: "Online",
    icon: CheckCircle2,
    color: "text-green-400",
  },
  {
    name: "Knowledge Agent",
    status: "Online",
    icon: CheckCircle2,
    color: "text-green-400",
  },
  {
    name: "Reply Agent",
    status: "Running",
    icon: Loader2,
    color: "text-blue-400 animate-spin",
  },
  {
    name: "Memory Agent",
    status: "Waiting",
    icon: AlertTriangle,
    color: "text-yellow-400",
  },
  {
    name: "Email Connector",
    status: "Connected",
    icon: CheckCircle2,
    color: "text-green-400",
  },
  {
    name: "Knowledge Base",
    status: "Healthy",
    icon: CheckCircle2,
    color: "text-green-400",
  },
];

export default function SystemHealth() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 text-xl font-semibold">
        System Health
      </h2>

      <div className="space-y-4">

        {services.map((service) => {

          const Icon = service.icon;

          return (

            <div
              key={service.name}
              className="flex items-center justify-between rounded-xl bg-zinc-950 p-4"
            >

              <div className="flex items-center gap-3">

                <Icon
                  size={18}
                  className={service.color}
                />

                <span>
                  {service.name}
                </span>

              </div>

              <span className="text-zinc-400 text-sm">

                {service.status}

              </span>

            </div>

          );

        })}

      </div>

    </div>
  );
}