const CUSTOMERS = {
  corally: [
    { name: "Acme Partners", email: "ops@acmepartners.com" },
    { name: "NexusConnect Inc", email: "support@nexusconnect.io" },
    { name: "DataBridge Solutions", email: "eng@databridge.io" },
    { name: "PinnacleCRM", email: "help@pinnaclecrm.com" },
    { name: "SynergyCloud", email: "admin@synergycloud.io" },
    { name: "VelocityPartners", email: "ops@velocitypartners.com" },
    { name: "OmniChannel Inc", email: "support@omnichannel.io" },
    { name: "FusionLayer", email: "dev@fusionlayer.com" },
    { name: "Atlas Partners", email: "partner@atlaspartners.io" },
    { name: "Cortex Integrations", email: "eng@cortexintegrations.com" },
  ],
  foxo: [
    { name: "City General Hospital", email: "it@citygeneral.com" },
    { name: "WellCare Clinics", email: "support@wellcareclinics.com" },
    { name: "MediConnect", email: "ops@mediconnect.io" },
    { name: "HealthFirst Medical", email: "admin@healthfirstmed.com" },
    { name: "PrimePath Labs", email: "lab@primepathlabs.com" },
    { name: "Apollo Health Systems", email: "help@apollohs.com" },
    { name: "Redwood Medical Group", email: "support@redwoodmed.com" },
    { name: "Sunrise Cardiology", email: "it@sunrisecardio.com" },
    { name: "Mercy Health Network", email: "ops@mercyhealth.net" },
    { name: "Peak Diagnostics", email: "lab@peakdiagnostics.com" },
  ],
  binocs: [
    { name: "SilverPoint Capital", email: "ops@silverpointcap.com" },
    { name: "Atlas Equity Group", email: "compliance@atlas-equity.com" },
    { name: "Meridian Ventures", email: "support@meridian.vc" },
    { name: "PineBrook Advisory", email: "admin@pinebrookadvisory.com" },
    { name: "Summit PE Partners", email: "deals@summitpe.com" },
    { name: "Horizon Family Office", email: "it@horizonfo.com" },
    { name: "Crestview Investments", email: "ops@crestviewinv.com" },
    { name: "NorthStar Asset Mgmt", email: "support@northstaram.com" },
    { name: "BayFront Capital", email: "compliance@bayfrontcap.com" },
    { name: "RidgeLine Financial", email: "admin@ridgelinefin.com" },
  ],
  zap: [
    { name: "RetailMax Inc", email: "eng@retailmax.com" },
    { name: "DataDriven Co", email: "ops@datadriven.co" },
    { name: "CustomerFirst", email: "support@customerfirst.io" },
    { name: "OmniRetail", email: "it@omniretail.com" },
    { name: "InsightHub", email: "admin@insighthub.io" },
    { name: "MarketPulse Analytics", email: "eng@marketpulse.com" },
    { name: "BrandWise Solutions", email: "ops@brandwise.io" },
    { name: "EcomMetrics", email: "support@ecommetrics.com" },
    { name: "SegmentFlow", email: "dev@segmentflow.io" },
    { name: "Clarity Data", email: "admin@claritydata.com" },
  ],
  yesmadam: [
    { name: "Priya Sharma", email: "priya.sharma@gmail.com" },
    { name: "Ananya Reddy", email: "ananya.reddy@yahoo.com" },
    { name: "Neha Kapoor", email: "neha.kapoor@outlook.com" },
    { name: "Riya Mehta", email: "riya.mehta@gmail.com" },
    { name: "Kavita Singh", email: "kavita.singh@icloud.com" },
    { name: "Sneha Patel", email: "sneha.patel@hotmail.com" },
    { name: "Deepa Nair", email: "deepa.nair@gmail.com" },
    { name: "Anjali Deshmukh", email: "anjali.deshmukh@yahoo.com" },
    { name: "Pooja Iyer", email: "pooja.iyer@outlook.com" },
    { name: "Meera Joshi", email: "meera.joshi@gmail.com" },
  ],
};

const ASSIGNEES = ["Triage Agent", "Reply Agent", "Knowledge Agent", "Support Manager", "Senior Agent"];
const PRIORITIES = ["urgent", "high", "normal", "low"];
const STATUSES = ["open", "pending", "waiting_on_customer", "escalated", "resolved", "closed"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function hoursAgo(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString(); }
function minutesAgo(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString(); }

function realisticDate(dayOffset, hourOffset) {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(d.getHours() - hourOffset + Math.floor(Math.random() * 4));
  d.setMinutes(Math.floor(Math.random() * 60));
  return d.toISOString();
}

function generateTicket(workspace, idx, scenario) {
  const customers = CUSTOMERS[workspace] || CUSTOMERS.corally;
  const customer = customers[idx % customers.length];
  const priority = scenario.priority || pick(PRIORITIES);
  const daysOld = Math.floor(Math.random() * 28) + 1;
  const isOlder = idx < 5;
  const created = isOlder ? realisticDate(28 + idx, 0) : realisticDate(daysOld, 0);
  const isResolved = scenario.status === "resolved" || (!scenario.forceOpen && idx > 15 && Math.random() < 0.4);
  const status = scenario.status || (isResolved ? pick(["resolved", "closed"]) : pick(STATUSES.slice(0, 4)));
  return {
    title: scenario.title,
    customer_name: customer.name,
    customer_email: customer.email,
    body: scenario.body || generateBody(scenario.title, scenario.category),
    priority,
    category: scenario.category,
    channel: "email",
    created_at: created,
    status,
    assignee: pick(ASSIGNEES),
  };
}

function generateBody(title, category) {
  const negativeSuffixes = [
    ` This is incredibly frustrating and we are extremely disappointed with the lack of progress.`,
    ` We are seriously considering switching to a competitor if this is not resolved immediately. This is the worst experience we have had with your platform.`,
    ` This has been a terrible experience for our team. We feel completely let down by the support process.`,
    ` We are furious about the repeated failures. This feels like a scam and we want to escalate this to management.`,
    ` This is unacceptable. We are exploring alternatives and may have to cancel our contract if this persists.`,
  ];
  const negativeCategory = ["Billing", "Refund", "Cancellation", "Booking", "Payment", "Wallet"].includes(category);

  const phrases = {
    "CRM Sync": `We are experiencing issues with our CRM synchronization. The system fails to sync partner data after multiple retry attempts. Our team has verified the API credentials are correct on our end. This is affecting our ability to manage partner relationships effectively.`,
    "Partner Onboarding": `The partner onboarding workflow seems to be stuck. Our partner submitted all required documentation three days ago but the status still shows as pending review. We need this resolved urgently as it is blocking our go-live timeline.`,
    "API": `The API endpoint is returning inconsistent results. We are seeing intermittent 502 errors and the response times have degraded significantly over the past 24 hours. Our integration team needs stable API access to proceed with the deployment.`,
    "Billing": `There appears to be a discrepancy in our latest invoice. The amount billed does not match the agreed-upon pricing in our contract. We have attached the relevant documentation for your reference. Please investigate and correct at the earliest.`,
    "Appointment": `Our patients are reporting that they are unable to book appointments through the portal. The system shows availability but fails to confirm the booking at the final step. This has been going on for the past few hours and is affecting our daily operations.`,
    "Prescription": `Several of our doctors have reported that the prescription module is not loading patient histories. The page hangs indefinitely and times out. This is critical as patients are waiting for their repeat prescriptions.`,
    "Lab Reports": `Our lab is unable to upload test results to the platform. The upload process reaches 99% and then fails without any error message. We have tried multiple file formats and sizes with the same result.`,
    "Insurance": `Insurance verification requests are timing out consistently. Our billing team cannot verify patient coverage which is delaying appointments. This started after the latest system update.`,
    "Financial Report": `The quarterly financial report generation is failing. The system throws an error when trying to aggregate the portfolio data. We need this report for an upcoming investor meeting and are on a tight deadline.`,
    "Document Review": `The AI document review process is returning inaccurate risk scores for several due diligence submissions. The scoring seems inconsistent with our historical data. We need the model recalibrated or reviewed.`,
    "Data Import": `The data import job has been stuck in processing state for over six hours. The source CSV is well-formed and within the size limits. Previous imports of similar size completed within minutes.`,
    "Booking": `I tried to book a beauty package through the app but the payment keeps failing. The amount was deducted from my bank but the booking is not confirmed in the app. I have screenshots of the transaction.`,
    "Refund": `I requested a refund for a service package eight days ago and there has been no update. My previous refunds were processed within 48 hours. I would like an immediate resolution to this matter.`,
    "Wallet": `My wallet balance is showing an incorrect amount. I added funds through UPI yesterday and the transaction was successful, but the balance has not been updated. The amount is reflecting in my bank statement.`,
    default: `We are reaching out regarding an ongoing issue with the ${category?.toLowerCase() || "service"} functionality. The problem has been affecting our workflow for the past few hours. Our team has performed basic troubleshooting steps including clearing cache and restarting the system, but the issue persists. We request immediate assistance to resolve this matter.`,
  };
  let body = phrases[category] || phrases.default;
  if (negativeCategory) {
    body += pick(negativeSuffixes);
  }
  return body;
}

function generateDraftBody(ticketTitle, workspace) {
  const contexts = {
    corally: "Thank you for reaching out regarding this partner integration issue. Our team has identified the root cause and is deploying a fix. We expect the CRM sync to be fully operational within the next hour. We apologize for the disruption to your workflow.",
    foxo: "We understand the urgency of this patient care issue. Our engineering team has reviewed the ticket and identified that the appointment scheduling service requires a cache refresh. We are rolling out a fix now and will monitor closely.",
    binocs: "Thank you for flagging this due diligence processing issue. Our AI pipeline team has identified a configuration error in the report generation module. We are applying a hotfix and will verify the output before marking this as resolved.",
    zap: "We appreciate you bringing this data integration issue to our attention. Our team has traced the problem to a recent API deployment. We are rolling back the change and restoring the previous stable version immediately.",
    yesmadam: "We sincerely apologize for the inconvenience caused. Our team has escalated this to the payments team and we are prioritizing your case. We will ensure the refund is processed within the next 24 hours and keep you updated at every step.",
  };
  return `Dear Customer,\n\n${contexts[workspace] || contexts.corally}\n\nBest regards,\nSupport Team`;
}

/* ------------------------------------------------------------------ */
/* WORKSPACE TICKET SCENARIOS                                         */
/* Each entry: { title, category, priority?, status?, body?, forceOpen? } */
/* ------------------------------------------------------------------ */

const CORALLY_TICKETS = [
  // CRM Sync cluster (for signal)
  { title: "Salesforce partner sync failing", category: "CRM Sync", priority: "urgent" },
  { title: "HubSpot deal data not reflecting in partner portal", category: "CRM Sync", priority: "high" },
  { title: "CRM webhook timeout on partner update", category: "CRM Sync", priority: "high" },
  { title: "Duplicate partner records created after CRM sync", category: "CRM Sync", priority: "normal" },
  { title: "CRM integration returning 503 errors", category: "CRM Sync", priority: "urgent", status: "escalated" },
  // Partner Onboarding cluster
  { title: "Partner invite emails not being delivered", category: "Partner Onboarding", priority: "urgent" },
  { title: "Onboarding verification link expired prematurely", category: "Partner Onboarding", priority: "high" },
  { title: "Bulk partner import job failed mid-process", category: "Partner Onboarding", priority: "high" },
  // Contract cluster
  { title: "Enterprise invoice amount does not match contract terms", category: "Contract", priority: "high" },
  { title: "Contract renewal auto-approved without VP sign-off", category: "Contract", priority: "urgent", status: "escalated" },
  { title: "Partner tier upgrade not reflected in billing", category: "Contract", priority: "normal" },
  // API cluster
  { title: "OAuth authentication failure for partner API", category: "API", priority: "urgent" },
  { title: "Rate limit exceeded on partner data export", category: "API", priority: "high" },
  { title: "API response payload missing expected fields", category: "API", priority: "normal" },
  // Billing cluster
  { title: "Revenue dashboard showing incorrect MRR figures", category: "Billing", priority: "high" },
  { title: "Partner commission calculation error in Q3 report", category: "Billing", priority: "urgent" },
  { title: "Invoice #INV-8934 double-charged for enterprise plan", category: "Billing", priority: "high" },
  // User Access cluster
  { title: "Partner admin unable to reset password", category: "User Access", priority: "normal" },
  { title: "SSO login redirect loop for enterprise users", category: "User Access", priority: "high" },
  { title: "New partner user cannot access shared dashboard", category: "User Access", priority: "normal" },
  // Mixed
  { title: "Custom integration webhook not firing on deal close", category: "API", priority: "normal" },
  { title: "Partner portal search results inconsistent", category: "Partner Onboarding", priority: "low" },
  { title: "Data migration from legacy system stalled", category: "CRM Sync", priority: "high", status: "resolved" },
  { title: "Trial partner account incorrectly flagged as inactive", category: "User Access", priority: "low" },
  { title: "Invoice PDF generation failing for EU partners", category: "Billing", priority: "normal" },
  { title: "Partner referral tracking links returning 404", category: "Partner Onboarding", priority: "high", status: "resolved" },
  { title: "SLA breach notification not sent for critical ticket", category: "API", priority: "urgent", status: "escalated" },
  { title: "Multi-tenant partner environment isolation issue", category: "CRM Sync", priority: "urgent" },
];

const FOXO_TICKETS = [
  // Appointment cluster
  { title: "Patient unable to book appointment via patient portal", category: "Appointment", priority: "urgent" },
  { title: "Appointment slot double-booking in cardiology", category: "Appointment", priority: "high" },
  { title: "Automated appointment reminders not sending SMS", category: "Appointment", priority: "high" },
  { title: "Same-day appointment queue not updating in real-time", category: "Appointment", priority: "normal", status: "escalated" },
  // Prescription cluster
  { title: "E-prescription not loading in pharmacy system", category: "Prescription", priority: "urgent" },
  { title: "Controlled substance prescription requires manual override", category: "Prescription", priority: "high" },
  { title: "Prescription renewal request not reaching doctor inbox", category: "Prescription", priority: "high" },
  // Patient cluster
  { title: "Patient profile showing duplicated records after merge", category: "Patient", priority: "high" },
  { title: "Patient demographics update not persisting across visits", category: "Patient", priority: "normal" },
  { title: "Patient PHI data export failing for insurance audit", category: "Patient", priority: "urgent", status: "escalated" },
  // Lab Reports cluster
  { title: "Lab report PDF upload failing with date parsing error", category: "Lab Reports", priority: "high" },
  { title: "Critical lab result alert not triggered for abnormal value", category: "Lab Reports", priority: "urgent" },
  { title: "Lab report auto-import from Quest Diagnostics stalled", category: "Lab Reports", priority: "normal" },
  // Doctor cluster
  { title: "Doctor availability calendar not syncing with scheduling", category: "Doctor", priority: "high" },
  { title: "Locum tenens provider unable to access patient panel", category: "Doctor", priority: "normal" },
  { title: "Physician referral form submission failing with 422", category: "Doctor", priority: "normal" },
  // Insurance cluster
  { title: "Insurance eligibility verification API timeout", category: "Insurance", priority: "urgent" },
  { title: "Claim submission rejected due to formatting error", category: "Insurance", priority: "high" },
  { title: "Prior authorization request stuck in pending state", category: "Insurance", priority: "high" },
  // Mixed
  { title: "Telehealth video consultation dropped mid-session", category: "Appointment", priority: "urgent", status: "escalated" },
  { title: "HL7 message feed from lab delayed by 4 hours", category: "Lab Reports", priority: "high" },
  { title: "Patient intake form not populating from waiting room tablet", category: "Patient", priority: "normal", status: "resolved" },
  { title: "Multi-factor auth failing for remote physician login", category: "Doctor", priority: "high" },
  { title: "Insurance copay calculator showing incorrect amounts", category: "Insurance", priority: "normal" },
  { title: "ADT admit/discharge notifications not reaching PCP", category: "Patient", priority: "normal" },
  { title: "Medication interaction check not flagging known contraindication", category: "Prescription", priority: "urgent" },
  { title: "ER wait time board not updating in patient app", category: "Appointment", priority: "low" },
];

const BINOCS_TICKETS = [
  // Financial Report cluster
  { title: "Q3 financial statements missing from portfolio view", category: "Financial Report", priority: "urgent" },
  { title: "Fund performance report showing incorrect IRR calculation", category: "Financial Report", priority: "high" },
  { title: "Quarterly investor letter PDF generation failed", category: "Financial Report", priority: "high" },
  // Document Review cluster
  { title: "AI risk scoring engine returning inconsistent results", category: "Document Review", priority: "urgent" },
  { title: "Document OCR pipeline failed for scanned PDFs", category: "Document Review", priority: "high" },
  { title: "Due diligence checklist auto-population incomplete", category: "Document Review", priority: "normal" },
  // Portfolio cluster
  { title: "Portfolio company financial upload timing out", category: "Portfolio", priority: "high" },
  { title: "Portfolio valuation model not updating with latest multiples", category: "Portfolio", priority: "urgent" },
  { title: "Holding period return calculation discrepancy", category: "Portfolio", priority: "normal" },
  // Client cluster
  { title: "Client investor dashboard loading extremely slowly", category: "Client", priority: "high" },
  { title: "LP capital call notification not delivered via email", category: "Client", priority: "high" },
  { title: "Client document watermark not applying on download", category: "Client", priority: "normal" },
  // Risk Assessment cluster
  { title: "Portfolio concentration risk report showing zeros", category: "Risk Assessment", priority: "urgent" },
  { title: "ESG compliance scoring module returned no data", category: "Risk Assessment", priority: "high" },
  { title: "Stress test scenario simulation failing to execute", category: "Risk Assessment", priority: "high", status: "escalated" },
  // Login cluster
  { title: "Client portal MFA enrollment loop after password reset", category: "Login", priority: "high" },
  { title: "SSO session timeout too aggressive for document review", category: "Login", priority: "normal" },
  { title: "IP whitelist not being enforced for admin accounts", category: "Login", priority: "urgent" },
  // Mixed
  { title: "Data room permission sync delayed by 6 hours", category: "Client", priority: "normal" },
  { title: "Deal flow pipeline export missing custom fields", category: "Portfolio", priority: "normal", status: "resolved" },
  { title: "Restricted stock unit valuation model error", category: "Financial Report", priority: "high" },
  { title: "Fund administrator data reconciliation mismatch", category: "Portfolio", priority: "high" },
  { title: "Tax lot accounting report not generating", category: "Financial Report", priority: "urgent", status: "escalated" },
  { title: "Board pack auto-generation skipping appendix pages", category: "Document Review", priority: "normal", status: "resolved" },
  { title: "GDPR data deletion request not processing automatically", category: "Risk Assessment", priority: "high" },
  { title: "Audit trail export missing user activity timestamps", category: "Client", priority: "normal" },
];

const ZAP_TICKETS = [
  // CRM Sync cluster
  { title: "CRM contact sync delayed by over 45 minutes", category: "CRM", priority: "high" },
  { title: "Lead enrichment data not populating in Salesforce", category: "CRM", priority: "high" },
  { title: "CRM deal stage change not triggering webhook", category: "CRM", priority: "normal" },
  // API cluster
  { title: "API rate limit exceeded for customer data export", category: "API", priority: "urgent" },
  { title: "REST API endpoint returning inconsistent pagination", category: "API", priority: "high" },
  { title: "GraphQL subscription not delivering real-time updates", category: "API", priority: "normal" },
  // Webhook cluster
  { title: "Webhook signature validation failing intermittently", category: "Webhook", priority: "urgent" },
  { title: "Webhook retry mechanism not honoring exponential backoff", category: "Webhook", priority: "high" },
  { title: "Duplicate webhook events sent for single customer action", category: "Webhook", priority: "normal" },
  // Data Import cluster
  { title: "Customer data import job stuck in queued state", category: "Data Import", priority: "high" },
  { title: "CSV import column mapping not saving on re-import", category: "Data Import", priority: "normal" },
  { title: "Historical data backfill job failed at 73% completion", category: "Data Import", priority: "urgent" },
  // Analytics cluster
  { title: "Customer 360 dashboard showing stale data from yesterday", category: "Analytics", priority: "high" },
  { title: "Segmentation query timing out on large customer base", category: "Analytics", priority: "high" },
  { title: "Attribution report showing negative conversion values", category: "Analytics", priority: "urgent" },
  // Integrations cluster
  { title: "Slack integration not posting new customer alerts", category: "Integrations", priority: "normal" },
  { title: "Market automation (HubSpot) sync broken after API update", category: "Integrations", priority: "high" },
  { title: "Zendesk integration creating duplicate customer tickets", category: "Integrations", priority: "high" },
  // Mixed
  { title: "Customer profile merge tool producing duplicates", category: "CRM", priority: "high" },
  { title: "Event stream processing lag of over 30 minutes", category: "API", priority: "urgent", status: "escalated" },
  { title: "Data enrichment provider returning stale firmographic data", category: "Data Import", priority: "normal", status: "resolved" },
  { title: "Webhook payload size limit too low for large customer records", category: "Webhook", priority: "normal" },
  { title: "Segment membership not updating on profile change", category: "Analytics", priority: "high" },
  { title: "S3 export job failing with access denied error", category: "Data Import", priority: "urgent", status: "escalated" },
  { title: "Custom attribute mapping lost after schema migration", category: "Integrations", priority: "normal" },
  { title: "Customer identity resolution graph returning disconnected nodes", category: "CRM", priority: "high" },
];

const YESMADAM_TICKETS = [
  // Booking cluster
  { title: "Beauty package booking not confirming after payment", category: "Booking", priority: "urgent" },
  { title: "Appointment reschedule option greyed out in app", category: "Booking", priority: "high" },
  { title: "Same-day booking not appearing in beautician schedule", category: "Booking", priority: "high" },
  // Beautician cluster
  { title: "Beautician did not show up for scheduled appointment", category: "Beautician", priority: "urgent" },
  { title: "Preferred beautician not listed in available slots", category: "Beautician", priority: "normal" },
  { title: "Beautician rating and review not posting after service", category: "Beautician", priority: "normal" },
  // Refund cluster
  { title: "Refund for cancelled package pending for 8 days", category: "Refund", priority: "urgent" },
  { title: "Refund amount processed but not reflecting in bank", category: "Refund", priority: "high" },
  { title: "Partial refund for service downgrade calculated incorrectly", category: "Refund", priority: "high" },
  // Payment cluster
  { title: "Customer charged twice for single booking transaction", category: "Payment", priority: "urgent" },
  { title: "Payment deducted after OTP but booking shows as failed", category: "Payment", priority: "urgent" },
  { title: "UPI payment stuck in processing for over 24 hours", category: "Payment", priority: "high" },
  // Wallet cluster
  { title: "Wallet cashback not credited after referral completion", category: "Wallet", priority: "normal" },
  { title: "Wallet balance showing incorrect after top-up via UPI", category: "Wallet", priority: "high" },
  { title: "Wallet amount deducted twice for single service booking", category: "Wallet", priority: "urgent" },
  // Cancellation cluster
  { title: "Booking auto-cancelled without customer notification", category: "Cancellation", priority: "high" },
  { title: "Cancellation fee waived not applied for loyalty member", category: "Cancellation", priority: "normal" },
  { title: "Subscription cancellation not taking effect after request", category: "Cancellation", priority: "high" },
  // Mixed
  { title: "Beauty package activation code not delivered via SMS", category: "Booking", priority: "high" },
  { title: "Service add-on charges not itemized in invoice", category: "Payment", priority: "normal", status: "resolved" },
  { title: "Festive offer discount not applying at checkout", category: "Booking", priority: "high" },
  { title: "Gift card redemption failing with invalid code error", category: "Payment", priority: "normal" },
  { title: "Beautician attendance not marked in system after service", category: "Beautician", priority: "low" },
  { title: "Membership tier benefits not reflecting after upgrade", category: "Cancellation", priority: "normal" },
  { title: "Referral reward tracking link expired before use", category: "Wallet", priority: "low", status: "resolved" },
  { title: "Booked slot auto-released 10 minutes before appointment", category: "Booking", priority: "urgent", status: "escalated" },
];

/* ------------------------------------------------------------------ */
/* SIGNALS                                                             */
/* ------------------------------------------------------------------ */

function generateSignal(name, summary, category, workspace) {
  return { name, summary, category, workspace };
}

const CORALLY_SIGNALS = [
  generateSignal("CRM Sync Failure Spike", "Multiple partner reports of CRM synchronization failures. Over 8 related tickets filed in the past 48 hours indicating a systemic issue with the integration layer.", "CRM Sync", "corally"),
  generateSignal("Partner Invite Failures", "Partner onboarding invitations failing to deliver via email. Pattern suggests upstream SMTP relay issue affecting partner enablement pipeline.", "Partner Onboarding", "corally"),
  generateSignal("OAuth Authentication Errors", "Intermittent OAuth token validation failures affecting partner API access. Multiple partners reporting login disruptions.", "API", "corally"),
  generateSignal("Billing Discrepancy Trend", "Growing number of billing-related tickets including invoice mismatches and commission calculation errors affecting partner trust.", "Billing", "corally"),
];

const FOXO_SIGNALS = [
  generateSignal("Appointment Booking Failures", "Patients unable to complete appointment bookings across multiple departments. System allows selection but fails at confirmation step.", "Appointment", "foxo"),
  generateSignal("Prescription API Errors", "E-prescription service returning timeout errors affecting pharmacy systems. Impacting patient medication fulfillment.", "Prescription", "foxo"),
  generateSignal("Patient Record Sync Failures", "Patient demographic and medical record updates not persisting across systems. Potential HL7 interface issue.", "Patient", "foxo"),
  generateSignal("Lab Result Processing Delays", "Lab report upload and auto-import pipeline experiencing significant delays affecting diagnostic turnaround times.", "Lab Reports", "foxo"),
];

const BINOCS_SIGNALS = [
  generateSignal("Report Generation Failures", "Multiple report types failing to generate including quarterly financial statements, investor letters, and fund performance reports.", "Financial Report", "binocs"),
  generateSignal("OCR Processing Errors", "Document OCR pipeline failing to process scanned PDFs affecting due diligence document review workflow.", "Document Review", "binocs"),
  generateSignal("Client Login Instability", "Client portal experiencing authentication issues including MFA loops and SSO session timeouts affecting LP access.", "Login", "binocs"),
  generateSignal("Portfolio Data Processing Delays", "Portfolio company financial data upload and valuation model updates experiencing systemic processing delays.", "Portfolio", "binocs"),
];

const ZAP_SIGNALS = [
  generateSignal("CRM Sync Degradation", "Customer data synchronization across CRM platforms experiencing delays and incomplete data transfer affecting sales workflows.", "CRM", "zap"),
  generateSignal("API Rate Limit Exhaustion", "Multiple customers hitting API rate limits on data export endpoints indicating need for capacity review.", "API", "zap"),
  generateSignal("Data Import Pipeline Failures", "Customer data import jobs failing or getting stuck at various stages affecting data freshness and analytics.", "Data Import", "zap"),
  generateSignal("Webhook Reliability Issues", "Webhook delivery and signature validation failures affecting customer integration reliability.", "Webhook", "zap"),
];

const YESMADAM_SIGNALS = [
  generateSignal("Beautician No-Show Spike", "Multiple customer reports of beauticians not arriving for scheduled appointments indicating scheduling or dispatch system failure.", "Beautician", "yesmadam"),
  generateSignal("Payment Gateway Failures", "Payment processing failures including double charges, failed OTP verification, and stuck transactions affecting booking completion.", "Payment", "yesmadam"),
  generateSignal("Refund Processing Delays", "Refund requests taking significantly longer than the stated SLA causing customer dissatisfaction and escalation.", "Refund", "yesmadam"),
  generateSignal("Wallet Balance Inconsistencies", "Customer wallet balances not reflecting correct amounts after top-ups and cashback credits.", "Wallet", "yesmadam"),
];

/* ------------------------------------------------------------------ */
/* INCIDENTS                                                           */
/* ------------------------------------------------------------------ */

function generateIncident(title, summary, severity, workspace) {
  return { title, summary, severity, workspace, affected_ticket_count: 0 };
}

const CORALLY_INCIDENTS = [
  generateIncident("CRM Integration Outage", "Systemic CRM synchronization failure affecting all partner integrations. Multiple partner reports of sync failures, duplicate records, and webhook timeouts. Root cause identified as API gateway configuration error during maintenance window.", "critical", "corally"),
  generateIncident("Partner Portal Authentication Failure", "OAuth and SSO authentication services for partner portal experiencing intermittent failures. Impacting partner access to dashboards, APIs, and onboarding workflows.", "high", "corally"),
];

const FOXO_INCIDENTS = [
  generateIncident("Appointment Service Outage", "Patient appointment booking service unavailable across all departments. System allows slot selection but fails at booking confirmation. Impacting multiple healthcare facilities simultaneously.", "critical", "foxo"),
  generateIncident("Patient Data Synchronization Failure", "Patient demographic update feed stalled between EHR systems. Affecting data freshness across clinical workflows and patient portals.", "high", "foxo"),
];

const BINOCS_INCIDENTS = [
  generateIncident("Due Diligence Processing Delay", "Document review and report generation pipeline experiencing systemic backlog. Affecting multiple active due diligence engagements with upcoming investor deadlines.", "critical", "binocs"),
  generateIncident("OCR Pipeline Failure", "Document OCR processing engine not returning results for scanned due diligence documents. Manual review cannot proceed until OCR pipeline is restored.", "high", "binocs"),
];

const ZAP_INCIDENTS = [
  generateIncident("API Service Degradation", "Multiple API endpoints experiencing increased latency and timeout errors affecting customer data export and enrichment workflows.", "critical", "zap"),
  generateIncident("Customer Data Processing Failure", "Data import and CRM synchronization pipelines stalled across multiple customer accounts affecting data freshness and analytics.", "high", "zap"),
];

const YESMADAM_INCIDENTS = [
  generateIncident("Payment Gateway Failure", "Payment processing system experiencing transaction failures including double charges, OTP verification errors, and delayed settlements.", "critical", "yesmadam"),
  generateIncident("Booking Service Degradation", "Appointment booking and beautician dispatch system experiencing partial outage. Customers unable to confirm bookings after payment.", "high", "yesmadam"),
];

/* ------------------------------------------------------------------ */
/* DRAFT REPLY TEMPLATES                                               */
/* ------------------------------------------------------------------ */

const DRAFT_BODIES = {
  corally: [
    `Dear Partner,\n\nWe have identified the root cause of the CRM sync failure. A recent API gateway configuration change during our maintenance window caused the integration layer to drop connections intermittently. Our engineering team has rolled back the change and all sync jobs are now processing normally. We are monitoring closely and will conduct a post-mortem to prevent recurrence.\n\nBest regards,\nPartner Support Team`,
    `Hello,\n\nThe partner invite email delivery issue has been traced to an upstream SMTP relay configuration. Our email delivery team has updated the DKIM and SPF records, and we have re-queued all failed invitations. You should see delivery within the next 15 minutes. We apologize for the onboarding delay.\n\nBest regards,\nPartner Support Team`,
    `Dear Customer,\n\nThe OAuth authentication failures were caused by an expired certificate in our token signing service. We have rotated the certificate and all authentication flows are now operational. Partners should clear their token cache and re-authenticate. No data loss has occurred.\n\nBest regards,\nPartner Support Team`,
    `Hi there,\n\nThe duplicate partner record issue has been resolved. Our deduplication job has merged the affected records and preserved the complete audit trail. We have also added an additional validation step in the CRM sync pipeline to prevent future duplicates.\n\nBest regards,\nPartner Support Team`,
    `Dear Partner,\n\nThe invoice discrepancy has been reviewed by our billing team. The overcharge was caused by a proration error during the plan upgrade. We have issued a credit note for the difference and corrected the upcoming invoice. You will see the adjustment within 24 hours.\n\nBest regards,\nBilling Support Team`,
    `Hello,\n\nThe webhook timeout issue has been resolved. We increased the timeout threshold from 10s to 30s for partner update webhooks and added retry logic with exponential backoff. Your integration should now receive all updates reliably.\n\nBest regards,\nPartner Support Team`,
  ],
  foxo: [
    `Dear Provider,\n\nThe appointment booking issue has been identified as a session management bug in the patient portal. Our team has deployed a hotfix and confirmed that booking is now working correctly. We recommend patients clear their browser cache or re-login if they encounter any issues.\n\nBest regards,\nHealthcare Support Team`,
    `Hello,\n\nThe e-prescription loading issue was caused by a database connection pool exhaustion in the pharmacy integration service. We have scaled up the connection pool and restarted the affected service. All pending prescriptions are being processed now.\n\nBest regards,\nHealthcare Support Team`,
    `Dear Doctor,\n\nThe lab report upload failure was due to a file size validation bug that incorrectly rejected PDFs over 5MB. We have corrected the limit to 25MB and re-processed the failed uploads. Your lab results are now available in the system.\n\nBest regards,\nHealthcare Support Team`,
    `Hi,\n\nThe insurance verification timeout issue has been resolved. Our integration with the clearinghouse was experiencing latency due to a batch processing job. We have optimized the query pattern and implemented caching for frequent eligibility checks.\n\nBest regards,\nHealthcare Support Team`,
    `Dear Provider,\n\nThe patient profile duplication was caused by a race condition in the merge workflow. We have fixed the synchronization issue and the affected profiles have been consolidated. Duplicate detection has been enhanced to prevent this going forward.\n\nBest regards,\nHealthcare Support Team`,
  ],
  binocs: [
    `Dear Client,\n\nThe financial report generation failure was caused by a data aggregation query timeout on the portfolio database. We have optimized the query with appropriate indexes and increased the timeout. All pending reports have been generated successfully.\n\nBest regards,\nDue Diligence Support`,
    `Hello,\n\nThe AI risk scoring inconsistency was traced to a model version mismatch between our staging and production environments. We have synchronized the model artifacts and re-scored the affected submissions. Results now align with expected ranges.\n\nBest regards,\nDue Diligence Support`,
    `Dear Investor,\n\nThe OCR pipeline failure was caused by a corrupted language pack in the document processing service. We have restored the language pack from backup and re-processed all failed documents. Accuracy metrics remain within acceptable thresholds.\n\nBest regards,\nDue Diligence Support`,
    `Hi,\n\nThe investor dashboard performance issue was caused by a memory leak in the real-time valuation widget. We have deployed a fix and the dashboard is now loading within normal parameters. We are monitoring resource utilization closely.\n\nBest regards,\nDue Diligence Support`,
    `Dear Client,\n\nThe portfolio upload timeout issue has been resolved. The file upload service was experiencing contention due to concurrent large uploads. We have implemented a queue-based processing architecture to handle uploads more efficiently.\n\nBest regards,\nDue Diligence Support`,
    `Hello,\n\nClient portal login issues have been resolved. The MFA enrollment loop was caused by an incorrect redirect URI in the identity provider configuration. We have corrected the configuration and all authentication flows are now functioning correctly.\n\nBest regards,\nDue Diligence Support`,
  ],
  zap: [
    `Dear Customer,\n\nThe CRM sync delay was caused by a backlog in our event processing pipeline. We have scaled the consumer workers and cleared the backlog. All pending sync operations have been completed. We are adding monitoring alerts for pipeline latency.\n\nBest regards,\nCustomer Intelligence Support`,
    `Hello,\n\nThe API rate limit issue has been addressed by increasing the per-customer rate limit from 1000 to 5000 requests per minute for the data export endpoint. We have also added proactive rate limit warnings in the API response headers.\n\nBest regards,\nCustomer Intelligence Support`,
    `Dear Customer,\n\nThe data enrichment failure was caused by a third-party provider API deprecation. We have migrated to the updated API version and re-processed all pending enrichment requests. Data quality metrics have returned to normal.\n\nBest regards,\nCustomer Intelligence Support`,
    `Hi,\n\nThe webhook signature validation issue was caused by a clock skew between our server and the customer's server. We have implemented a 5-minute leeway in signature timestamp validation and added NTP sync monitoring.\n\nBest regards,\nCustomer Intelligence Support`,
    `Dear Customer,\n\nThe duplicate customer profile issue has been resolved. Our identity resolution engine was using an outdated matching rule set. We have updated the rules and the deduplication job has been run successfully. Impacted profiles have been merged.\n\nBest regards,\nCustomer Intelligence Support`,
    `Hello,\n\nThe analytics dashboard staleness was caused by a data warehouse refresh job that was failing silently. We have fixed the job and triggered a full refresh. Dashboard data is now current as of the last completed refresh cycle.\n\nBest regards,\nCustomer Intelligence Support`,
  ],
  yesmadam: [
    `Dear Customer,\n\nWe sincerely apologize for the beautician no-show experience. This was caused by a dispatch system notification failure. We have refunded the service amount to your wallet and added a complimentary service credit. The dispatch team has been alerted to ensure this does not recur.\n\nBest regards,\nCustomer Care Team`,
    `Hello,\n\nThe double charge issue has been investigated and confirmed. Our payments team has initiated a refund for the duplicate transaction. The amount will reflect in your account within 3-5 business days. We have also added a duplicate transaction check to prevent this in future.\n\nBest regards,\nCustomer Care Team`,
    `Dear Customer,\n\nWe apologize for the refund delay. Your refund request was stuck in a manual review queue due to an amount threshold flag. We have processed the refund and it will be credited to your original payment method within 48 hours. You will receive a confirmation email once processed.\n\nBest regards,\nCustomer Care Team`,
    `Hi,\n\nThe wallet balance issue has been resolved. The top-up transaction was marked as pending due to a UPI webhook delay. We have manually reconciled the transaction and your wallet balance has been updated. You can verify the balance in your wallet section.\n\nBest regards,\nCustomer Care Team`,
    `Dear Customer,\n\nThe booking auto-cancellation was caused by a payment confirmation timeout in our booking engine. We have reinstated your booking and extended the payment confirmation window to 15 minutes. No further action is needed from your end.\n\nBest regards,\nCustomer Care Team`,
    `Hello,\n\nThe beauty package activation issue has been resolved. The activation SMS was not triggered due to a DLT template registration delay with the telecom provider. We have re-sent the activation code via SMS and email. Please check your inbox for the details.\n\nBest regards,\nCustomer Care Team`,
    `Dear Customer,\n\nWe apologize for the inconvenience caused by the OTP payment failure. The transaction was captured by the bank but the confirmation webhook was not received by our system. We have reconciled the transaction and your booking is now confirmed. Thank you for your patience.\n\nBest regards,\nCustomer Care Team`,
  ],
};

/* ------------------------------------------------------------------ */
/* EXPORT                                                              */
/* ------------------------------------------------------------------ */

export const WORKSPACE_SEEDS = {
  corally: {
    tickets: CORALLY_TICKETS,
    signals: CORALLY_SIGNALS,
    incidents: CORALLY_INCIDENTS,
    drafts: DRAFT_BODIES.corally,
  },
  foxo: {
    tickets: FOXO_TICKETS,
    signals: FOXO_SIGNALS,
    incidents: FOXO_INCIDENTS,
    drafts: DRAFT_BODIES.foxo,
  },
  binocs: {
    tickets: BINOCS_TICKETS,
    signals: BINOCS_SIGNALS,
    incidents: BINOCS_INCIDENTS,
    drafts: DRAFT_BODIES.binocs,
  },
  zap: {
    tickets: ZAP_TICKETS,
    signals: ZAP_SIGNALS,
    incidents: ZAP_INCIDENTS,
    drafts: DRAFT_BODIES.zap,
  },
  yesmadam: {
    tickets: YESMADAM_TICKETS,
    signals: YESMADAM_SIGNALS,
    incidents: YESMADAM_INCIDENTS,
    drafts: DRAFT_BODIES.yesmadam,
  },
};

export function getWorkspaceSeed(workspaceId) {
  return WORKSPACE_SEEDS[workspaceId] || null;
}
