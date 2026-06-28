export default function IncidentTimeline({ incident }) {

    return (

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <h2 className="text-xl font-semibold mb-6">

                Timeline

            </h2>

            <div className="space-y-5">

                {incident.timeline.map((step, index) => (

                    <div
                        key={step}
                        className="flex gap-4"
                    >

                        <div className="w-3 h-3 rounded-full bg-violet-500 mt-2"/>

                        <div>

                            <p>

                                {step}

                            </p>

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