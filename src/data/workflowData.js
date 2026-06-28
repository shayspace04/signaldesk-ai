export const workflowNodes = [
  {
    id: "signal",
    title: "Signal Detected",
    icon: "🚨",
    status: "completed",
    confidence: 100,
    runtime: "0.2s"
  },
  {
    id: "triage",
    title: "Triage Agent",
    icon: "🧠",
    status: "completed",
    confidence: 96,
    runtime: "1.1s"
  },
  {
    id: "knowledge",
    title: "Knowledge Agent",
    icon: "📚",
    status: "completed",
    confidence: 94,
    runtime: "0.9s"
  },
  {
    id: "reply",
    title: "Reply Agent",
    icon: "✍️",
    status: "running",
    confidence: 97,
    runtime: "1.8s"
  },
  {
    id: "approval",
    title: "Waiting Approval",
    icon: "👤",
    status: "waiting",
    confidence: null,
    runtime: null
  },
  {
    id: "memory",
    title: "Memory Agent",
    icon: "💾",
    status: "pending",
    confidence: null,
    runtime: null
  }
];