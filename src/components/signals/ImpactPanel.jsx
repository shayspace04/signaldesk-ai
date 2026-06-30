import { Users, Globe, Server } from "lucide-react";

export default function ImpactPanel({ signal }) {
  return (
    <div className="rounded-2xl border border-[#EFEFEF] bg-white p-6">

      <h2 className="mb-6 text-xl font-semibold text-zinc-900">

        Impact Assessment

      </h2>

      <div className="grid grid-cols-3 gap-6">

        <div className="rounded-xl bg-zinc-50 p-5">

          <Users className="mb-3 text-violet-500" />

          <p className="text-zinc-500">

            Users

          </p>

          <h3 className="mt-2 text-2xl font-bold text-zinc-900">

            {signal.affectedUsers}

          </h3>

        </div>

        <div className="rounded-xl bg-zinc-50 p-5">

          <Globe className="mb-3 text-blue-500" />

          <p className="text-zinc-500">

            Region

          </p>

          <h3 className="mt-2 text-2xl font-bold text-zinc-900">

            {signal.region}

          </h3>

        </div>

        <div className="rounded-xl bg-zinc-50 p-5">

          <Server className="mb-3 text-orange-500" />

          <p className="text-zinc-500">

            Source

          </p>

          <h3 className="mt-2 text-xl font-bold text-zinc-900">

            {signal.source}

          </h3>

        </div>

      </div>

    </div>
  );
}
