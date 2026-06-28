import { Users, Globe, Server } from "lucide-react";

export default function ImpactPanel({ signal }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-6 text-xl font-semibold">

        Impact Assessment

      </h2>

      <div className="grid grid-cols-3 gap-6">

        <div className="rounded-xl bg-zinc-950 p-5">

          <Users className="mb-3 text-violet-400" />

          <p className="text-zinc-500">

            Users

          </p>

          <h3 className="mt-2 text-2xl font-bold">

            {signal.affectedUsers}

          </h3>

        </div>

        <div className="rounded-xl bg-zinc-950 p-5">

          <Globe className="mb-3 text-blue-400" />

          <p className="text-zinc-500">

            Region

          </p>

          <h3 className="mt-2 text-2xl font-bold">

            {signal.region}

          </h3>

        </div>

        <div className="rounded-xl bg-zinc-950 p-5">

          <Server className="mb-3 text-orange-400" />

          <p className="text-zinc-500">

            Source

          </p>

          <h3 className="mt-2 text-xl font-bold">

            {signal.source}

          </h3>

        </div>

      </div>

    </div>
  );
}