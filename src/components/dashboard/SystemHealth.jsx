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
    color: "text-green-600",
  },
  {
    name: "Knowledge Agent",
    status: "Online",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  {
    name: "Reply Agent",
    status: "Running",
    icon: Loader2,
    color: "text-blue-600 animate-spin",
  },
  {
    name: "Memory Agent",
    status: "Waiting",
    icon: AlertTriangle,
    color: "text-yellow-600",
  },
  {
    name: "Email Connector",
    status: "Connected",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  {
    name: "Knowledge Base",
    status: "Healthy",
    icon: CheckCircle2,
    color: "text-green-600",
  },
];

export default function SystemHealth() {
  return (
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

      <h2 className="mb-6 text-lg font-semibold text-zinc-900">
        System Health
      </h2>

      <div className="space-y-4">

        {services.map((service) => {

          const Icon = service.icon;

          return (

            <div
              key={service.name}
              className="flex items-center justify-between rounded-xl bg-zinc-50 p-4"
            >

              <div className="flex items-center gap-3">

                <Icon
                  size={18}
                  className={service.color}
                />

                <span className="text-sm text-zinc-700">
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
