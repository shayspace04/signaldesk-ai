import StatusBadge from "@/components/common/StatusBadge";
import PriorityBadge from "@/components/common/PriorityBadge";

export default function TicketSummary({ ticket }) {
  if (!ticket) return null;

  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{ticket.title || "Untitled"}</h2>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-zinc-400 dark:text-zinc-500">Customer</p>
          <p className="text-zinc-900 dark:text-zinc-50">{ticket.customer_name || ticket.customer_email || "-"}</p>
        </div>
        <div>
          <p className="text-zinc-400 dark:text-zinc-500">Email</p>
          <p className="text-zinc-900 dark:text-zinc-50">{ticket.customer_email || "-"}</p>
        </div>
        {ticket.category && (
          <div>
            <p className="text-zinc-400 dark:text-zinc-500">Category</p>
            <p className="text-zinc-900 dark:text-zinc-50 capitalize">{ticket.category.replace(/_/g, " ")}</p>
          </div>
        )}
        {ticket.assigned_to && (
          <div>
            <p className="text-zinc-400 dark:text-zinc-500">Assignee</p>
            <p className="text-zinc-900 dark:text-zinc-50">{ticket.assigned_to}</p>
          </div>
        )}
      </div>
      {ticket.body && (
        <div>
          <p className="mb-1 text-xs text-zinc-400 dark:text-zinc-500">Description</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-4">{ticket.body}</p>
        </div>
      )}
    </div>
  );
}
