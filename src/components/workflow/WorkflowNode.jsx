import { motion } from "framer-motion";

export default function WorkflowNode({ node }) {

  const colors = {
    completed: "border-green-500 bg-green-500/10",
    running: "border-violet-500 bg-violet-500/10",
    waiting: "border-yellow-500 bg-yellow-500/10",
    pending: "border-zinc-700 bg-zinc-900"
  };

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      animate={
        node.status === "running"
          ? { scale: [1, 1.03, 1] }
          : {}
      }
      transition={{
        repeat: Infinity,
        duration: 2
      }}
      className={`rounded-2xl border p-5 ${colors[node.status]}`}
    >
      <div className="text-3xl">
        {node.icon}
      </div>

      <h3 className="mt-3 font-semibold">
        {node.title}
      </h3>

      {node.confidence && (
        <p className="mt-2 text-sm text-zinc-400">
          Confidence {node.confidence}%
        </p>
      )}

      {node.runtime && (
        <p className="text-xs text-zinc-500">
          Runtime {node.runtime}
        </p>
      )}
    </motion.div>
  );
}