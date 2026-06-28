import activityData from "@/data/activityData";

export default function AgentActivity() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="text-xl font-semibold mb-6">
        AI Agent Activity
      </h2>

      <div className="space-y-5">

        {activityData.map((agent) => {

          const Icon = agent.icon;

          return (

            <div
              key={agent.id}
              className="flex items-start gap-4"
            >

              <div
                className={`rounded-xl bg-zinc-950 p-3 ${agent.color}`}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1">

                <div className="flex justify-between">

                  <h3 className="font-medium">
                    {agent.title}
                  </h3>

                  <span className="text-xs text-zinc-500">
                    {agent.time}
                  </span>

                </div>

                <p className="text-sm text-zinc-400 mt-1">
                  {agent.description}
                </p>

              </div>

            </div>

          );

        })}

      </div>

    </div>
  );
}