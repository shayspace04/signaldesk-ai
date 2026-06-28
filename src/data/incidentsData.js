const incidents = [
  {
    id: "INC-1001",
    title: "Payment Gateway Failure",
    severity: "Critical",
    status: "Investigating",
    owner: "Engineering",
    affected: 1246,
    started: "09:14 AM",

    timeline: [
      "Signal detected",
      "AI grouped related tickets",
      "Root cause identified",
      "Incident created",
      "Engineering notified"
    ],

    summary:
      "Multiple payment failures detected across all regions. AI grouped 18 related tickets into a single incident."
  },

  {
    id: "INC-1002",
    title: "CRM Sync Failure",
    severity: "High",
    status: "Monitoring",
    owner: "Platform Team",
    affected: 212,

    started: "11:22 AM",

    timeline: [
      "Webhook failures",
      "Retry exhausted",
      "Worker restarted"
    ],

    summary:
      "CRM synchronization delayed because webhook retries exceeded limits."
  }
];

export default incidents;