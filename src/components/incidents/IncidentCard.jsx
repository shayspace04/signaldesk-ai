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
                    ? "border-violet-500 bg-violet-50"
                    : "border-[#EFEFEF] bg-white hover:border-zinc-300"
            }

            `}

        >

            <h3 className="font-semibold text-zinc-900">

                {incident.title}

            </h3>

            <p className="mt-2 text-zinc-500">

                {incident.summary}

            </p>

            <div className="mt-4 flex justify-between">

                <span className="text-red-600 font-medium">

                    {incident.severity}

                </span>

                <span className="text-zinc-400 text-sm">

                    {incident.status}

                </span>

            </div>

        </button>

    );

}
