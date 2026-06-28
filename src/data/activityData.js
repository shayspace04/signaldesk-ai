import {
  Brain,
  Bot,
  BookOpen,
  ShieldAlert,
  Mail,
  CheckCircle2,
} from "lucide-react";

const activityData = [
  {
    id: 1,
    icon: Brain,
    color: "text-orange-400",
    title: "Triage Agent",
    description: "Classified ticket as Critical",
    time: "09:21 AM",
    status: "completed",
  },
  {
    id: 2,
    icon: BookOpen,
    color: "text-cyan-400",
    title: "Knowledge Agent",
    description: "Retrieved 4 policy documents",
    time: "09:22 AM",
    status: "completed",
  },
  {
    id: 3,
    icon: Bot,
    color: "text-violet-400",
    title: "Reply Agent",
    description: "Generated customer response",
    time: "09:23 AM",
    status: "running",
  },
  {
    id: 4,
    icon: Mail,
    color: "text-blue-400",
    title: "Approval Queue",
    description: "Waiting for human approval",
    time: "09:24 AM",
    status: "waiting",
  },
  {
    id: 5,
    icon: CheckCircle2,
    color: "text-green-400",
    title: "Memory Agent",
    description: "Will learn after resolution",
    time: "--",
    status: "pending",
  },
];

export default activityData;