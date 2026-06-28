const approvalData = [
  {
    id: "TKT-1928",
    customer: "John Smith",
    company: "Foxo",
    subject: "Payment failures during checkout",
    priority: "Critical",
    confidence: 97,
    status: "Awaiting Approval",
    assignedAgent: "reply-agent",
    created: "2 mins ago",

    summary:
      "Customers are unable to complete payments. Failure rate has increased significantly during the last 30 minutes.",

    draftReply: `Hello John,

We have identified the issue affecting payment processing.

Our engineering team is currently investigating this as a high-priority incident.

We'll continue providing updates until the issue is resolved.

Thank you for your patience.

Regards,
Support Team`,

    knowledgeSources: [
      "KB-204 Payment Gateway Errors",
      "Incident #1843",
      "Refund Workflow Documentation"
    ],

    history: [
      "Ticket Created",
      "Triage Agent classified Critical",
      "Knowledge Agent found 3 similar incidents",
      "Reply Agent generated draft"
    ]
  },

  {
    id: "TKT-1941",
    customer: "Sarah Lee",
    company: "Binocs",
    subject: "Unable to login",
    priority: "High",
    confidence: 91,
    status: "Awaiting Approval",
    assignedAgent: "reply-agent",
    created: "12 mins ago",

    summary:
      "Customer reports authentication failures after password reset.",

    draftReply: `Hi Sarah,

Thank you for reporting the issue.

Our team has identified the authentication problem and is actively working on it.

We'll update you shortly.

Regards,
Support Team`,

    knowledgeSources: [
      "Authentication FAQ",
      "Incident #1765"
    ],

    history: [
      "Ticket Created",
      "Knowledge Retrieved",
      "Draft Generated"
    ]
  }
];

export default approvalData;