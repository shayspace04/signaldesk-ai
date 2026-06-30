import { useEffect, useState, startTransition } from "react";
import { Loader2 } from "lucide-react";
import client from "@/lib/lemmaClient";

const DEFAULT_STEPS = [
  "Ticket Created",
  "AI Triage Complete",
  "Knowledge Search",
  "Reply Generated",
  "Awaiting Review",
];

export default function TicketTimeline({ ticketId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) {
      startTransition(() => setLoading(false));
      return;
    }
    let cancelled = false;
    startTransition(() => setLoading(true));
    client.records
      .list("audit_logs", { filter: { ticket_id: ticketId }, sort: [{ field: "created_at", direction: "asc" }], limit: 50 })
      .then((res) => {
        if (!cancelled) startTransition(() => setLogs(res.data ?? []));
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setLogs([]));
      })
      .finally(() => {
        if (!cancelled) startTransition(() => setLoading(false));
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const items = logs.length > 0 ? logs.map((l) => l.action || l.event || l.description) : DEFAULT_STEPS;

  return (
    <div className="rounded-xl border border-[#EFEFEF] bg-white p-6">
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">Timeline</h2>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((event, index) => (
            <div key={`${event}-${index}`} className="flex gap-4">
              <div className="mt-2 h-3 w-3 rounded-full bg-violet-500" />
              <div>
                <p className="text-zinc-900">{event}</p>
                <span className="text-sm text-zinc-400">Step {index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
