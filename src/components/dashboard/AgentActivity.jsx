import activityData from "@/data/activityData";

export default function AgentActivity() {
  return (
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

      <h2 className="text-lg font-semibold text-zinc-900 mb-6">
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
                className={`rounded-xl bg-zinc-100 p-3 ${agent.color}`}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1">

                <div className="flex justify-between">

                  <h3 className="font-medium text-zinc-900">
                    {agent.title}
                  </h3>

                  <span className="text-xs text-zinc-400">
                    {agent.time}
                  </span>

                </div>

                <p className="text-sm text-zinc-500 mt-1">
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
