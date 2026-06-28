import WorkflowNode from "./WorkflowNode";
import { workflowNodes } from "@/data/workflowData";

export default function WorkflowCanvas() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

      <h2 className="mb-8 text-2xl font-bold">
        Live AI Workflow
      </h2>

      <div className="grid grid-cols-3 gap-6">

        {workflowNodes.map(node => (
          <WorkflowNode
            key={node.id}
            node={node}
          />
        ))}

      </div>

    </div>
  );
}