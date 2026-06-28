import { motion } from "framer-motion";
import { useState } from "react";

import incidents from "@/data/incidentsData";

import IncidentCard from "@/components/incidents/IncidentCard";
import IncidentDetails from "@/components/incidents/IncidentDetails";

export default function Incidents() {
  const [selected, setSelected] = useState(incidents[0]);

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
      }}
    >
      <div>
        <h1 className="text-4xl font-bold">
          Incident Center
        </h1>

        <p className="mt-2 text-zinc-400">
          Monitor active incidents, review AI findings, track investigation
          progress, and coordinate resolution across teams.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          {incidents.map((item) => (
            <IncidentCard
              key={item.id}
              incident={item}
              selected={selected.id === item.id}
              onSelect={setSelected}
            />
          ))}
        </div>

        <div className="col-span-8">
          <IncidentDetails incident={selected} />
        </div>
      </div>
    </motion.div>
  );
}