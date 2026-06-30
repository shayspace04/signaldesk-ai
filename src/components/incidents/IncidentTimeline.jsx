export default function IncidentTimeline({ incident }) {

    return (

        <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

            <h2 className="text-lg font-semibold text-zinc-900 mb-6">

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

                            <p className="text-zinc-900">

                                {step}

                            </p>

                            <span className="text-sm text-zinc-400">

                                Step {index + 1}

                            </span>

                        </div>

                    </div>

                ))}

            </div>

        </div>

    );

}
