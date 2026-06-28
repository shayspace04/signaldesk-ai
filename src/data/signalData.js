const signalData = [
  {
    id: "SIG-2048",
    title: "Payment Failure Spike",
    severity: "Critical",
    confidence: 98,
    affectedUsers: 1264,
    region: "India",
    source: "Stripe API",

    summary:
      "AI detected an unusual increase in payment failures across multiple regions.",

    evidence: [
      "Payment success rate dropped from 98% to 61%",
      "Stripe timeout errors increased",
      "Refund requests increased 42%"
    ],

    rootCause:
      "Likely Stripe API timeout combined with retry failures.",

    recommendation:
      "Create an incident and notify engineering immediately."
  },

  {
    id: "SIG-2050",
    title: "CRM Sync Failure",
    severity: "High",
    confidence: 92,
    affectedUsers: 218,
    region: "Europe",
    source: "Webhook",

    summary:
      "Customer records stopped syncing.",

    evidence: [
      "Webhook retries exceeded",
      "HTTP 500 responses"
    ],

    rootCause:
      "Webhook endpoint unavailable.",

    recommendation:
      "Restart sync worker."
  }
];

export default signalData;