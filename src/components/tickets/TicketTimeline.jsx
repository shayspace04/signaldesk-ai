const events = [
  "Ticket Created",
  "AI Triage Complete",
  "Knowledge Search",
  "Reply Generated",
  "Awaiting Review",
];

export default function TicketTimeline() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 text-xl font-semibold">
        Timeline
      </h2>

      <div className="space-y-5">

        {events.map((event, index) => (

          <div
            key={event}
            className="flex gap-4"
          >

            <div className="mt-2 h-3 w-3 rounded-full bg-violet-500" />

            <div>

              <p>{event}</p>

              <span className="text-sm text-zinc-500">
                Step {index + 1}
              </span>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}