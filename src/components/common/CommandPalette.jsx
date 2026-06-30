import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import useCommandPalette from "@/hooks/useCommandPalette";

const pages = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Tickets", path: "/tickets" },
  { name: "Signals", path: "/signals" },
  { name: "Approval Desk", path: "/approval" },
  { name: "Incidents", path: "/incidents" },
  { name: "Knowledge", path: "/knowledge" },
  { name: "Analytics", path: "/analytics" },
  { name: "Settings", path: "/settings" },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const { open, setOpen } = useCommandPalette();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-32">

      <Command className="w-[650px] rounded-2xl border border-[#EFEFEF] bg-white p-4 shadow-lg">

        <Command.Input
          placeholder="Search pages..."
          className="w-full border-none bg-transparent p-4 text-lg outline-none text-zinc-900 placeholder-zinc-400"
        />

        <Command.List>

          {pages.map((page) => (

            <Command.Item
              key={page.path}
              onSelect={() => {
                navigate(page.path);
                setOpen(false);
              }}
              className="cursor-pointer rounded-lg p-4 text-zinc-700 hover:bg-zinc-100"
            >
              {page.name}
            </Command.Item>

          ))}

        </Command.List>

      </Command>

    </div>
  );
}
