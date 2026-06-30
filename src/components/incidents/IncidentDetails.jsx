import IncidentTimeline from "./IncidentTimeline";

export default function IncidentDetails({ incident }) {

    return (

        <div className="space-y-6">

            <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

                <h1 className="text-3xl font-bold text-zinc-900">

                    {incident.title}

                </h1>

                <p className="mt-4 text-zinc-500">

                    {incident.summary}

                </p>

                <div className="grid grid-cols-4 gap-4 mt-8">

                    <div>

                        <p className="text-zinc-500 text-sm">

                            Severity

                        </p>

                        <h3 className="text-zinc-900 font-medium">{incident.severity}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500 text-sm">

                            Status

                        </p>

                        <h3 className="text-zinc-900 font-medium">{incident.status}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500 text-sm">

                            Users

                        </p>

                        <h3 className="text-zinc-900 font-medium">{incident.affected}</h3>

                    </div>

                    <div>

                        <p className="text-zinc-500 text-sm">

                            Owner

                        </p>

                        <h3 className="text-zinc-900 font-medium">{incident.owner}</h3>

                    </div>

                </div>

            </div>

            <IncidentTimeline incident={incident}/>

        </div>

    );

}
