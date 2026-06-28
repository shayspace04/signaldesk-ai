import { motion } from "framer-motion";

import SignalList from "@/components/signals/SignalList";

export default function Signals() {
  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
      }}
    >
      <div>
        <h1 className="text-4xl font-bold">
          Signal Investigation
        </h1>

        <p className="mt-2 text-zinc-400">
          Investigate AI-detected anomalies, identify root causes,
          review supporting evidence, and resolve incidents before
          they impact customers.
        </p>
      </div>

      <SignalList />
    </motion.div>
  );
}