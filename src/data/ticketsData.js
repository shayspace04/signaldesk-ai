const tickets = [
  {
    id: "TKT-1024",
    customer: "Foxo",
    issue: "Payment failures",
    priority: "Critical",
    confidence: 97,
    sla: "12m",
    status: "Waiting Approval",
    assignee: "Reply Agent"
  },
  {
    id: "TKT-1025",
    customer: "YesMadam",
    issue: "Beautician no-show",
    priority: "High",
    confidence: 91,
    sla: "26m",
    status: "In Progress",
    assignee: "Triage Agent"
  },
  {
    id: "TKT-1026",
    customer: "Binocs",
    issue: "Dashboard bug",
    priority: "Medium",
    confidence: 88,
    sla: "1h",
    status: "Resolved",
    assignee: "Support"
  },
  {
    id: "TKT-1027",
    customer: "ZapData",
    issue: "Webhook timeout",
    priority: "Critical",
    confidence: 99,
    sla: "4m",
    status: "Escalated",
    assignee: "Knowledge Agent"
  }
];

export default tickets;