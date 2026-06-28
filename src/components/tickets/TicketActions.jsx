import { toast } from "sonner";

export default function TicketActions() {

    return (

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <h2 className="mb-6 text-xl font-semibold">

                Actions

            </h2>

            <div className="grid grid-cols-2 gap-4">

                <button

                    onClick={() => toast.success("Ticket Assigned")}

                    className="rounded-lg bg-violet-600 py-3"

                >

                    Assign

                </button>

                <button

                    onClick={() => toast.success("Ticket Resolved")}

                    className="rounded-lg bg-green-600 py-3"

                >

                    Resolve

                </button>

                <button

                    onClick={() => toast.warning("Incident Escalated")}

                    className="rounded-lg bg-yellow-600 py-3"

                >

                    Escalate

                </button>

                <button

                    onClick={() => toast.error("Ticket Closed")}

                    className="rounded-lg bg-red-600 py-3"

                >

                    Close

                </button>

            </div>

        </div>

    );

}