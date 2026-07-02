import { Search } from "lucide-react";
import NotificationCenter from "@/components/common/NotificationCenter";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function Header() {
  const { workspace } = useWorkspace();

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-8">

      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-muted-base w-96">

        <Search size={18} />

        <input
          type="text"
          placeholder={`Search ${workspace.name.toLowerCase()} tickets, incidents, signals...`}
          className="w-full bg-transparent outline-none placeholder:text-muted-base"
        />

      </div>

      <div className="flex items-center gap-5">

        <NotificationCenter />

        <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold bg-accent">
          {workspace.initials}
        </div>

      </div>

    </header>
  );
}
