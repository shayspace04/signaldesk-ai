const tickets = [
  {
    id: "TKT-1024",
    customer: "Foxo",
    priority: "Critical",
    subject: "Payment failures increasing",
    confidence: 97,

    description:
      "Customers are reporting payment failures during checkout across multiple regions.",

    draftReply:
      "Hi, thanks for reaching out. Our engineering team is actively investigating the payment issue. We have identified the root cause and are working on a resolution. We apologize for the inconvenience and will keep you updated.",

    knowledgeSources: [
      "Incident #INC-1001",
      "Payments Runbook",
      "Stripe Status Dashboard"
    ],

    history: [
      "Ticket Created",
      "AI Triage Completed",
      "Knowledge Retrieved",
      "Draft Generated"
    ]
  },

  {
    id: "TKT-1025",
    customer: "YesMadam",
    priority: "High",
    subject: "Beautician did not arrive",

    confidence: 92,

    description:
      "Customer reports that the assigned beautician never arrived for the appointment.",

    draftReply:
      "We sincerely apologize for the inconvenience. We've escalated this to our operations team and are arranging an immediate replacement or refund based on your preference.",

    knowledgeSources: [
      "No-show Policy",
      "Customer Compensation SOP"
    ],

    history: [
      "Ticket Created",
      "Assigned to AI",
      "Draft Generated"
    ]
  }
];

export default tickets;