export default function IncidentCard({
    incident,
    selected,
    onSelect,
}) {

    return (

        <button

            onClick={() => onSelect(incident)}

            className={`w-full rounded-xl border p-5 text-left transition

            ${
                selected
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-900"
            }

            `}

        >

            <h3 className="font-semibold">

                {incident.title}

            </h3>

            <p className="mt-2 text-zinc-400">

                {incident.summary}

            </p>

            <div className="mt-4 flex justify-between">

                <span className="text-red-400">

                    {incident.severity}

                </span>

                <span className="text-zinc-500">

                    {incident.status}

                </span>

            </div>

        </button>

    );

}