import {
    Activity,
    Ticket,
    ShieldAlert,
    Brain,
} from "lucide-react";

export const stats = [
    {
        title: "Active Signals",
        value: "42",
        change: "+18%",
        positive: true,
        icon: Activity,
        color: "text-green-400",
    },

    {
        title: "Open Tickets",
        value: "18",
        change: "-7%",
        positive: false,
        icon: Ticket,
        color: "text-blue-400",
    },

    {
        title: "Critical Incidents",
        value: "4",
        change: "+33%",
        positive: true,
        icon: ShieldAlert,
        color: "text-red-400",
    },

    {
        title: "AI Confidence",
        value: "96%",
        change: "+4%",
        positive: true,
        icon: Brain,
        color: "text-violet-400",
    },
];