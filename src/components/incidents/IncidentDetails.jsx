import IncidentTimeline from "./IncidentTimeline";

export default function IncidentDetails({ incident }) {

    return (

        <div className="space-y-6">

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <h1 className="text-3xl font-bold">

                    {incident.title}

                </h1>

                <p className="mt-4 text-zinc-400">

                    {incident.summary}

                </p>

                <div className="grid grid-cols-4 gap-4 mt-8">

                    <div>

                        <p className="text-zinc-500">

                            Severity

                        </p>

                        <h3>{incident.severity}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500">

                            Status

                        </p>

                        <h3>{incident.status}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500">

                            Users

                        </p>

                        <h3>{incident.affected}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500">

                            Owner

                        </p>

                        <h3>{incident.owner}</h3>

                    </div>

                </div>

            </div>

            <IncidentTimeline incident={incident}/>

        </div>

    );

}