import { NavLink } from "react-router-dom";

import {
    LayoutDashboard,
    ClipboardList,
    ShieldAlert,
    RadioTower,
    BookOpen,
    BarChart3,
    CheckCircle2,
    Settings
} from "lucide-react";

const items = [
    {
        name: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard",
    },
    {
        name: "Approval Desk",
        icon: CheckCircle2,
        path: "/approval",
    },
    {
        name: "Tickets",
        icon: ClipboardList,
        path: "/tickets",
    },
    {
        name: "Incidents",
        icon: ShieldAlert,
        path: "/incidents",
    },
    {
        name: "Signals",
        icon: RadioTower,
        path: "/signals",
    },
    {
        name: "Knowledge",
        icon: BookOpen,
        path: "/knowledge",
    },
    {
        name: "Analytics",
        icon: BarChart3,
        path: "/analytics",
    },
    {
        name: "Settings",
        icon: Settings,
        path: "/settings",
    },
];

export default function Sidebar() {
    return (
        <aside className="w-72 border-r border-zinc-800 bg-zinc-950">

            <div className="border-b border-zinc-800 p-6">

                <h1 className="text-2xl font-bold">

                    SignalDesk

                </h1>

                <p className="mt-1 text-sm text-zinc-500">

                    AI Operations Center

                </p>

            </div>

            <nav className="space-y-2 p-4">

                {items.map((item) => {

                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                                    isActive
                                        ? "bg-violet-600 text-white"
                                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }`
                            }
                        >
                            <Icon size={18} />

                            {item.name}
                        </NavLink>
                    );
                })}

            </nav>

        </aside>
    );
}