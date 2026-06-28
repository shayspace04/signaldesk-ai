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
    color: "bg-zinc-500",
  },
];

export default function AgentStatusBar() {
  return (
    <div className="flex flex-wrap gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

      {agents.map((agent) => (

        <div
          key={agent.name}
          className="flex items-center gap-3 rounded-xl bg-zinc-950 px-4 py-3"
        >

          <div
            className={`h-3 w-3 rounded-full ${agent.color}`}
          />

          <span>{agent.name} Agent</span>

        </div>

      ))}

    </div>
  );
}