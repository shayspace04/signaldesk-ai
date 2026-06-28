import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import tickets from "@/data/ticketsData";

import TicketToolbar from "@/components/tickets/TicketToolbar";
import TicketFilterBar from "@/components/tickets/TicketFilterBar";
import TicketsTable from "@/components/tickets/TicketsTable";

export default function Tickets() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [status, setStatus] = useState("All");

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.customer.toLowerCase().includes(search.toLowerCase()) ||
        ticket.issue.toLowerCase().includes(search.toLowerCase()) ||
        ticket.id.toLowerCase().includes(search.toLowerCase());

      const matchesPriority =
        priority === "All" || ticket.priority === priority;

      const matchesStatus =
        status === "All" || ticket.status === status;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [search, priority, status]);

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
          Ticket Management
        </h1>

        <p className="mt-2 text-zinc-400">
          Monitor, search and manage customer support tickets.
        </p>
      </div>

      <TicketToolbar
        search={search}
        setSearch={setSearch}
      />

      <TicketFilterBar
        priority={priority}
        setPriority={setPriority}
        status={status}
        setStatus={setStatus}
      />

      <TicketsTable tickets={filteredTickets} />
    </motion.div>
  );
}