import { motion } from "framer-motion";

import TicketCard from "@/components/approval/TicketCard";
import DraftCard from "@/components/approval/DraftCard";
import HistoryCard from "@/components/approval/HistoryCard";
import ApprovalActions from "@/components/approval/ApprovalActions";

import tickets from "@/data/approvalTickets";

export default function ApprovalDesk() {
  const ticket = tickets[0];

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.35,
        ease: "easeOut",
      }}
    >
      <div>
        <h1 className="text-4xl font-bold">
          Approval Desk
        </h1>

        <p className="mt-2 text-zinc-400">
          Review, edit, approve, reject, or escalate AI-generated
          responses before they are sent to customers.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <TicketCard ticket={ticket} />

          <div className="mt-6">
            <HistoryCard ticket={ticket} />
          </div>
        </div>

        <div className="col-span-8">
          <DraftCard ticket={ticket} />

          <div className="mt-6">
            <ApprovalActions />
          </div>
        </div>
      </div>
    </motion.div>
  );
}