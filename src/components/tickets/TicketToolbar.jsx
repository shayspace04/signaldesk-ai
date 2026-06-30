import { Search, Plus } from "lucide-react";

export default function TicketToolbar({
  search,
  setSearch,
}) {
  return (
    <div className="flex items-center justify-between">

      <div className="relative w-96">

        <Search
          className="absolute left-3 top-3.5 text-zinc-400"
          size={18}
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tickets..."
          className="w-full rounded-xl border border-[#EFEFEF] bg-white py-3 pl-10 pr-4 text-zinc-900 outline-none placeholder-zinc-400 transition focus:border-violet-500"
        />

      </div>

      <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500">

        <Plus size={18} />

        New Ticket

      </button>

    </div>
  );
}
