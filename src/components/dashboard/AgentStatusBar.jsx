const agents = [
  {
    name: "Triage",
    color: "bg-green-500",
  },
  {
    name: "Knowledge",
    color: "bg-green-500",
  },
  {
    name: "Reply",
    color: "bg-green-500",
  },
  {
    name: "Approval",
    color: "bg-yellow-500",
  },
  {
    name: "Memory",
    color: "bg-zinc-400",
  },
];

export default function AgentStatusBar() {
  return (
    <div className="flex flex-wrap gap-4 rounded-2xl border border-[#EFEFEF] bg-white p-5">

      {agents.map((agent) => (

        <div
          key={agent.name}
          className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3"
        >

          <div
            className={`h-3 w-3 rounded-full ${agent.color}`}
          />

          <span className="text-sm text-zinc-700">{agent.name} Agent</span>

        </div>

      ))}

    </div>
  );
}
