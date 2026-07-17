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

export function generateTicket(workspace, idx, scenario) {
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
    assigned_to: pick(ASSIGNEES),
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
/* MEMORY ENTRIES (Knowledge Base Articles)                            */
/* Each entry: { title, summary, body, root_cause, resolution,        */
/*               category, tags, confidence, customers_affected,       */
/*               resolution_time_hours, severity, preventive_actions,  */
/*               symptoms, captured_at }                               */
/* ------------------------------------------------------------------ */

const CORALLY_MEMORY = [
  {
    title: "CRM Sync Failure Resolution Guide",
    summary: "Comprehensive guide for diagnosing and resolving CRM synchronization failures across Salesforce and HubSpot integrations, including API gateway timeouts, duplicate records, and webhook failures.",
    body: "CRM synchronization failures at Corally typically manifest as partner data not reflecting across systems, duplicate records created after sync, and webhook timeouts on partner updates. The root cause is often an API gateway configuration issue, expired OAuth tokens, or connection pool exhaustion in the integration layer. Step-by-step: (1) Verify API gateway health and recent configuration changes, (2) Check OAuth token expiry for each integration, (3) Review webhook delivery logs for timeout patterns, (4) Inspect deduplication rules for race conditions, (5) Validate partner credentials and API permissions. Post-resolution, always run a full sync reconciliation job to identify any remaining discrepancies.",
    root_cause: "CRM sync failures are predominantly caused by API gateway configuration drift during maintenance windows, expired OAuth tokens not triggering automatic refresh, and connection pool exhaustion under peak partner load. The integration layer uses a shared connection pool that is insufficient during high-volume sync windows.",
    resolution: "Roll back any recent API gateway configuration changes, refresh OAuth tokens for all affected integrations, increase the connection pool size from 10 to 50 for the integration service, and trigger a full re-sync job. For duplicate records, run the deduplication merge job which consolidates records based on partner ID and preserves the complete audit trail.",
    category: "CRM Sync",
    tags: ["integration", "salesforce", "hubspot", "api-gateway", "oauth", "reconciliation"],
    confidence: 95,
    customers_affected: 12,
    resolution_time_hours: 3.5,
    severity: "critical",
    preventive_actions: "Implement API gateway change management with peer review for all configuration changes. Add OAuth token expiry monitoring with proactive refresh alerts. Set up connection pool utilization dashboards with PagerDuty alerting at 80% threshold. Schedule weekly sync health check jobs.",
    symptoms: "Partner data not appearing in portal after CRM sync, 503 errors from integration API, duplicate partner records, webhook callback timeouts exceeding 30 seconds, sync job failure rate above 5%.",
  },
  {
    title: "Partner Onboarding Invite Delivery Troubleshooting",
    summary: "Diagnosis and resolution of partner invite email delivery failures, including SMTP relay misconfiguration, DKIM/SPF record issues, and invite link expiration problems.",
    body: "Partner onboarding invite failures occur when invite emails fail to deliver or invite links expire before the partner accesses them. The primary causes are upstream SMTP relay misconfiguration (affecting delivery), missing or incorrect DKIM/SPF DNS records (causing spam filtering), and invite link TTL being too short for partners who don't check email immediately. Resolution: (1) Verify SMTP relay configuration and check delivery logs for bounce codes, (2) Validate DKIM/SPF/DMARC DNS records using dig, (3) Check invite link expiry settings in the partner portal config, (4) Re-queue failed invitations after fixing delivery issues, (5) Monitor delivery success rate post-fix to ensure above 99%.",
    root_cause: "SMTP relay configuration was updated during a routine infrastructure upgrade, causing the DKIM signing key to be rotated without updating the DNS records. Additionally, the invite link default TTL was set to 24 hours which is insufficient for partners in different time zones who may not check email immediately.",
    resolution: "Update DKIM and SPF DNS records with the new signing key, extend invite link TTL from 24 to 72 hours, and re-queue all failed invitations from the past 48 hours. Add invite delivery monitoring with real-time alerts for delivery failures.",
    category: "Partner Onboarding",
    tags: ["email", "smtp", "dkim", "spf", "onboarding", "invite"],
    confidence: 92,
    customers_affected: 8,
    resolution_time_hours: 2.0,
    severity: "high",
    preventive_actions: "Automate DKIM key rotation with DNS record updates. Add SMTP relay health checks every 5 minutes. Implement invite delivery tracking with email open/click analytics. Set up weekly onboarding pipeline health reports.",
    symptoms: "Partner invite emails not arriving in inbox, invites going to spam folder, invite link expired when clicked, partner onboarding stuck at 'invite sent' status for more than 4 hours.",
  },
  {
    title: "Billing Discrepancy Investigation Protocol",
    summary: "Standard operating procedure for investigating and resolving billing discrepancies including invoice mismatches, double charges, and commission calculation errors for partners.",
    body: "Billing discrepancies at Corally fall into three categories: invoice amount mismatches (billed amount doesn't match contract terms), double charges (same line item billed twice), and commission calculation errors (partner commissions not matching agreement). Investigation protocol: (1) Verify the contract terms in the CRM against the billing system, (2) Check the billing period and proration logic for mid-cycle changes, (3) Review invoice line items for duplicate entries, (4) Validate commission rates against the active partner agreement, (5) Check for manual adjustments or credits that may have been applied incorrectly. Always issue a credit note for confirmed overcharges and adjust future invoices.",
    root_cause: "Billing discrepancies are most commonly caused by proration errors during plan upgrades/downgrades, manual billing adjustments bypassing the approval workflow, and commission rate table sync issues between CRM and billing systems.",
    resolution: "For proration errors: recalculate the prorated amount using the correct upgrade date and issue a credit note for the difference. For double charges: reverse the duplicate transaction and add a deduplication check. For commission errors: sync the rate table from CRM to billing and recalculate commissions.",
    category: "Billing",
    tags: ["invoice", "commission", "proration", "credits", "billing"],
    confidence: 90,
    customers_affected: 6,
    resolution_time_hours: 4.0,
    severity: "high",
    preventive_actions: "Add billing pre-validation checks before invoice generation. Implement proration calculator with unit tests covering all scenarios. Require manager approval for all manual billing adjustments. Schedule daily billing reconciliation jobs.",
    symptoms: "Invoice amount doesn't match contract, partner reporting incorrect charges, commission payout mismatch, duplicate line items on invoice, missing credits or adjustments.",
  },
  {
    title: "OAuth and SSO Authentication Troubleshooting",
    summary: "Guide for resolving partner authentication issues including OAuth token validation failures, SSO redirect loops, password reset failures, and MFA enrollment problems.",
    body: "Authentication issues in the partner portal affect partner access to dashboards, APIs, and onboarding workflows. Common issues include OAuth token validation failures (often caused by certificate expiry), SSO login redirect loops (incorrect redirect URI configuration), password reset failures (email delivery or token expiry), and MFA enrollment loops (incorrect identity provider configuration). Resolution approach: (1) Check certificate expiry dates for token signing and SSL, (2) Verify identity provider configuration including redirect URIs and allowed callback URLs, (3) Test password reset flow end-to-end, (4) Validate MFA enrollment workflow with test accounts, (5) Review authentication logs for error patterns.",
    root_cause: "The token signing certificate expired during a weekend without monitoring alerts configured. The SSO redirect loop was caused by an incorrect post-login redirect URI that pointed to the wrong environment, and the MFA enrollment issue was caused by a missing allowed callback URL in the identity provider configuration.",
    resolution: "Rotate the token signing certificate and update all affected services. Correct the SSO redirect URI configuration to point to the correct environment post-login URL. Add the missing callback URL to the identity provider. Force token refresh for all active sessions.",
    category: "User Access",
    tags: ["oauth", "sso", "mfa", "authentication", "certificate", "identity-provider"],
    confidence: 88,
    customers_affected: 15,
    resolution_time_hours: 2.5,
    severity: "critical",
    preventive_actions: "Set up certificate expiry monitoring with 30-day advance alerts. Implement automated certificate rotation. Add authentication health checks every 5 minutes. Create a runbook for SSO configuration changes.",
    symptoms: "Unable to login via SSO, OAuth token validation errors, infinite redirect loop after login, password reset email not received, MFA enrollment failing repeatedly.",
  },
  {
    title: "API Gateway Performance Optimization",
    summary: "Best practices and troubleshooting for Corally API gateway performance including rate limiting, response time degradation, and webhook reliability improvements.",
    body: "API gateway performance issues affect all partner integrations and internal services. This knowledge article covers rate limit tuning, response time optimization, webhook reliability improvements, and payload validation. Key areas: (1) Rate limit configuration should be per-partner with burst allowance, (2) Response time degradation often indicates database query issues downstream, (3) Webhook reliability requires retry with exponential backoff and dead-letter queues, (4) Payload validation should happen at the gateway level before reaching backend services. Optimizations: implement request collapsing for frequent identical requests, enable response caching for GET endpoints, and use circuit breakers for downstream service failures.",
    root_cause: "API response time degradation was caused by N+1 query patterns in the partner data endpoint and insufficient database connection pooling. Webhook failures were caused by missing retry logic and no dead-letter queue for failed deliveries.",
    resolution: "Optimize database queries with eager loading and appropriate indexes. Increase database connection pool. Implement webhook retry with exponential backoff (3 retries: 10s, 30s, 60s) and a dead-letter queue for inspection. Add circuit breaker pattern to isolate downstream failures.",
    category: "API",
    tags: ["api-gateway", "rate-limiting", "webhook", "performance", "circuit-breaker"],
    confidence: 93,
    customers_affected: 20,
    resolution_time_hours: 6.0,
    severity: "high",
    preventive_actions: "Implement load testing as part of CI/CD pipeline. Add API performance monitoring with percentile-based alerting. Set up webhook delivery tracking dashboard. Conduct quarterly API gateway capacity reviews.",
    symptoms: "API response times exceeding 5 seconds, rate limit errors on legitimate traffic, webhooks not reaching partner endpoints, 502/503 errors from gateway, intermittent timeouts.",
  },
];

const FOXO_MEMORY = [
  {
    title: "Appointment Booking System Recovery",
    summary: "Complete recovery procedure for the patient appointment booking system when it fails at confirmation step, including slot management, reminder delivery, and queue processing fixes.",
    body: "The Foxo appointment booking system allows patients to select available slots but fails at the booking confirmation step. This affects all departments including cardiology, primary care, and radiology. The failure chain: (1) Slot selection queries the availability cache, (2) Booking confirmation attempts to write to the database, (3) A race condition between the cache read and database write causes optimistic locking failures, (4) The booking is rolled back without user-facing error. Recovery: (1) Flush the availability cache to force fresh reads from the database, (2) Increase the optimistic lock retry count from 3 to 10, (3) Add a booking confirmation timeout of 30 seconds with clear user feedback, (4) Re-process any pending bookings in the queue. Also check the SMS reminder service which may be backlogged and causing duplicate reminder scheduling.",
    root_cause: "Race condition in the booking confirmation path where availability cache is read before the database write completes, causing optimistic locking failures. The SMS reminder backlog compounded the issue by scheduling duplicate reminders which consumed additional system resources.",
    resolution: "Fix the optimistic locking retry mechanism to handle concurrent booking attempts. Add a distributed lock on the slot ID during the booking transaction. Clear and rebuild the availability cache. Re-process failed bookings from the dead-letter queue. Scale SMS reminder workers to clear the backlog.",
    category: "Appointment",
    tags: ["booking", "scheduling", "concurrency", "optimistic-lock", "cache", "sms"],
    confidence: 94,
    customers_affected: 45,
    resolution_time_hours: 4.0,
    severity: "critical",
    preventive_actions: "Implement distributed locking for slot booking transactions. Add cache invalidation on booking events. Set up booking success rate monitoring with real-time dashboards. Add load testing for concurrent booking scenarios. Implement circuit breaker for SMS delivery failures.",
    symptoms: "Patient selects available slot but booking does not confirm, error at final booking step, appointment slot double-booked, SMS reminder not sent or duplicate reminders, same-day queue not updating in real-time.",
  },
  {
    title: "E-Prescription Service Troubleshooting",
    summary: "Diagnosis and resolution guide for the e-prescription service when it fails to load in pharmacy systems, including API timeouts, database connection issues, and renewal request routing failures.",
    body: "E-prescription issues at Foxo manifest as pharmacies unable to load or process electronic prescriptions, controlled substance prescriptions requiring manual override, and renewal requests not reaching doctor inboxes. The prescription service depends on (1) The EHR system generating the prescription, (2) The pharmacy integration service that formats and transmits to pharmacy systems, (3) The routing service that delivers renewal requests to the correct provider inbox. Each link in this chain must be verified. Resolution steps: (1) Check EHR prescription generation logs for errors, (2) Verify pharmacy integration service is running and has database connectivity, (3) Review message queue for prescription routing backlog, (4) Check provider inbox routing rules for correct assignment, (5) Validate the controlled substance override workflow permissions.",
    root_cause: "The e-prescription service was experiencing database connection pool exhaustion due to a sudden increase in renewal requests. The connection pool was configured for 20 concurrent connections but peak demand required 50+ during business hours, causing timeouts and failed prescriptions.",
    resolution: "Increase database connection pool from 20 to 100. Optimize prescription query with appropriate indexes. Add connection pool monitoring with auto-scaling based on demand. Implement request queuing with priority levels (urgent prescriptions get priority). Restart failed pharmacy integration service workers.",
    category: "Prescription",
    tags: ["e-prescription", "pharmacy", "ehr", "database", "connection-pool", "routing"],
    confidence: 91,
    customers_affected: 30,
    resolution_time_hours: 3.0,
    severity: "critical",
    preventive_actions: "Set up connection pool utilization monitoring with auto-scaling. Implement health checks for all prescription service dependencies. Add load testing for prescription volume spikes. Create fallback manual prescription workflow for system degradation scenarios.",
    symptoms: "Pharmacy cannot load electronic prescriptions, prescription page times out, controlled substance prescription errors, renewal request not reaching doctor, prescription loading indefinitely.",
  },
  {
    title: "HL7 Interface and Patient Record Sync Guide",
    summary: "Standard operating procedure for resolving HL7 message feed issues that cause patient demographic updates, medical record synchronization, and lab result import failures.",
    body: "Patient record synchronization issues at Foxo involve the HL7 interface that connects the EHR system with ancillary systems including labs, pharmacies, and patient portals. Common failure modes: (1) ADT (Admission, Discharge, Transfer) messages not reaching downstream systems, (2) Patient demographic updates not persisting across systems, (3) Lab results from Quest Diagnostics not importing, (4) Patient portal not reflecting latest health records. The HL7 message processing pipeline includes message receipt, validation, transformation, and routing. Failures at any stage cause data staleness. Resolution: (1) Check HL7 message queue for backlog, (2) Verify message validation rules and schema compatibility, (3) Review transformation mappings for recent changes, (4) Test message routing to each downstream system, (5) Implement message replay for failed messages.",
    root_cause: "An HL7 message schema update from the EHR vendor changed the patient identifier format from alphanumeric to purely numeric, causing validation failures at the HL7 interface layer. The interface was rejecting all messages with the new format until the validation rules were updated.",
    resolution: "Update HL7 message validation rules to accept both alphanumeric and numeric patient identifiers. Re-process all failed messages from the dead-letter queue. Verify downstream system compatibility with the new format. Add schema version detection and automatic validation rule switching.",
    category: "Patient",
    tags: ["hl7", "ehr", "interoperability", "patient-records", "integration", "adt"],
    confidence: 89,
    customers_affected: 25,
    resolution_time_hours: 5.0,
    severity: "high",
    preventive_actions: "Implement HL7 schema version detection with automatic validation rule switching. Add message format change monitoring with proactive alerts. Set up end-to-end message delivery testing for all patient record updates. Create schema change impact assessment process.",
    symptoms: "Patient demographic changes not saving, lab results not appearing in EHR, patient portal showing outdated information, ADT notifications not received, patient profile shows duplicated records across systems.",
  },
  {
    title: "Lab Report Processing Pipeline Recovery",
    summary: "Procedures for recovering the lab report processing pipeline including PDF upload failures, auto-import stalls, critical result alert failures, and format parsing errors.",
    body: "The lab report processing pipeline handles multiple input channels: direct PDF uploads from hospital labs, auto-import from Quest Diagnostics and LabCorp, and HL7 ORU messages. Failures include PDF uploads failing with date parsing errors, auto-import jobs stalling mid-process, critical lab result alerts not triggering for abnormal values, and report display issues in the patient portal. The pipeline architecture: Ingest → Validate → Parse → Store → Alert. Each stage has independent failure modes. Resolution approach: (1) Check file format and size limits for PDF uploads, (2) Verify auto-import API connectivity and authentication, (3) Review alert threshold configuration for critical results, (4) Check report display rendering logic for compatibility issues, (5) Re-process failed jobs from the pipeline after fixes are applied.",
    root_cause: "The PDF upload date parser was using a US date format (MM/DD/YYYY) but hospital labs were submitting dates in international format (DD/MM/YYYY), causing parsing failures for dates where both month and day were <= 12. The auto-import stall was caused by an API rate limit change from the lab provider.",
    resolution: "Update the date parser to auto-detect format based on the locale or accept DD/MM/YYYY format for EU-based labs. Implement date format validation with clear error messages. Contact Quest Diagnostics to update the API rate limit. Re-process all failed uploads with the fixed parser.",
    category: "Lab Reports",
    tags: ["lab", "pdf", "quest-diagnostics", "upload", "parsing", "alerts"],
    confidence: 87,
    customers_affected: 18,
    resolution_time_hours: 4.0,
    severity: "high",
    preventive_actions: "Add date format auto-detection with multiple format fallback. Implement upload format validation before processing. Set up auto-import health monitoring with provider connectivity checks. Add critical result alert testing suite with simulated lab values.",
    symptoms: "Lab report upload fails at 99% complete, auto-import jobs stuck 'processing', critical lab value with no alert triggered, report dates displayed incorrectly, lab results not showing in patient portal.",
  },
  {
    title: "Insurance Verification and Claims Processing",
    summary: "Complete guide for resolving insurance eligibility verification timeouts, claim submission rejections, prior authorization delays, and copay calculator inaccuracies.",
    body: "Insurance-related issues at Foxo include eligibility verification API timeouts (affecting appointment booking), claim submission rejections due to formatting errors, prior authorization requests stuck in pending, and copay calculator showing incorrect amounts. The insurance integration uses a clearinghouse service that connects to major payers (UnitedHealthcare, Aetna, Cigna, Blue Cross). Resolution: (1) Test clearinghouse API connectivity and authentication, (2) Verify claim format compatibility with payer requirements, (3) Check prior authorization status polling interval, (4) Review copay calculation logic against latest fee schedules, (5) Implement claim submission validation to check common rejection reasons before submission.",
    root_cause: "The clearinghouse API was experiencing latency due to a batch eligibility verification job running during peak hours. Claim submissions were rejected due to an NPI number format change required by Medicare. Prior authorization polls were using a 30-minute interval instead of checking status callbacks.",
    resolution: "Schedule batch eligibility verification jobs during off-peak hours. Update NPI number format to comply with new Medicare requirements. Implement webhook-based prior authorization status updates instead of polling. Re-submit rejected claims after format corrections.",
    category: "Insurance",
    tags: ["eligibility", "claims", "prior-authorization", "clearinghouse", "copay"],
    confidence: 86,
    customers_affected: 22,
    resolution_time_hours: 5.5,
    severity: "high",
    preventive_actions: "Implement claim pre-validation before submission to check for common rejection reasons. Add clearinghouse response time monitoring. Schedule batch jobs during off-peak hours. Set up prior authorization webhook integration with payer systems.",
    symptoms: "Insurance verification timing out during appointment booking, claim rejected by payer with formatting errors, prior authorization stuck in pending for over 24 hours, copay calculator shows incorrect patient responsibility.",
  },
];

const BINOCS_MEMORY = [
  {
    title: "Financial Report Generation Failure Recovery",
    summary: "Standard recovery procedures for financial report generation failures including quarterly statements, fund performance reports, investor letters, and tax lot accounting reports.",
    body: "Binocs financial report generation failures affect quarterly statements, fund performance reports, investor letters, portfolio valuation summaries, and tax lot accounting. The generation pipeline: Data Aggregation → Calculation Engine → Template Rendering → PDF Generation → Distribution. Failures can occur at any stage. Resolution steps: (1) Check data aggregation queries for timeout issues on the portfolio database, (2) Verify calculation engine versions and parameter configurations, (3) Test template rendering with sample data, (4) Check PDF generation service disk space and memory, (5) Review distribution list and delivery configuration. Common causes include database query timeouts on large portfolios, calculation engine version mismatches, and template syntax errors after updates.",
    root_cause: "Data aggregation queries were timing out because the portfolio database had grown significantly without corresponding query optimization. The aggregation query for quarterly statements was performing a full table scan on a table with 2M+ records without appropriate indexes. The calculation engine version mismatch occurred during a deployment that updated the engine but not its configuration parameters.",
    resolution: "Optimize aggregation queries with appropriate composite indexes on portfolio_id, period, and status columns. Increase query timeout from 30s to 120s. Roll back the calculation engine to the version matching current configuration parameters. Re-process all failed report generation jobs.",
    category: "Financial Report",
    tags: ["reporting", "financial", "portfolio", "pdf", "aggregation", "performance"],
    confidence: 93,
    customers_affected: 10,
    resolution_time_hours: 6.0,
    severity: "critical",
    preventive_actions: "Implement query performance monitoring with automatic optimization recommendations. Add calculation engine versioning with configuration compatibility checks. Set up report generation health checks. Schedule regular database maintenance and index optimization.",
    symptoms: "Report generation fails with timeout error, quarterly statements not appearing in portfolio view, incorrect IRR calculations, PDF generation fails, investor letter shows incomplete data.",
  },
  {
    title: "OCR Document Processing Pipeline Guide",
    summary: "Troubleshooting guide for the OCR document processing pipeline including scanned PDF failures, language pack corruption, image quality issues, and AI scoring engine inconsistencies.",
    body: "The OCR pipeline at Binocs processes scanned due diligence documents, contracts, and financial statements. It uses Tesseract OCR with language-specific packs and an AI scoring engine for document classification and risk assessment. Failure modes: (1) OCR returning empty or garbled text for scanned PDFs, (2) Language pack corruption causing character recognition errors, (3) Low-quality scans producing unusable output, (4) AI scoring engine returning inconsistent risk scores for similar documents, (5) Due diligence checklist auto-population missing required fields. Resolution: (1) Verify OCR service health and language pack integrity, (2) Check input image quality (minimum 300 DPI required), (3) Test with known good documents to isolate pipeline issues, (4) Review AI model version and training data freshness, (5) Check document classification rules for recent changes.",
    root_cause: "A language pack update was applied without verification, causing the Russian and Arabic OCR packs to become corrupted. Additionally, the AI scoring model was serving from staging artifacts instead of production, causing score inconsistencies. The in-memory cache for classification rules was not invalidated after rule updates.",
    resolution: "Restore OCR language packs from verified backup. Re-deploy the AI scoring model from the production artifact repository. Invalidate the classification rules cache. Re-process all documents that failed during the incident window. Validate OCR output quality with automated accuracy checks.",
    category: "Document Review",
    tags: ["ocr", "scanning", "ai-scoring", "pdf", "due-diligence", "classification"],
    confidence: 90,
    customers_affected: 8,
    resolution_time_hours: 5.0,
    severity: "high",
    preventive_actions: "Implement OCR language pack integrity verification with checksums before deployment. Add AI model deployment validation tests. Set up OCR output quality monitoring with automated sample testing. Create document processing pipeline health dashboard.",
    symptoms: "OCR returns garbled text for scanned documents, AI risk scores inconsistent for similar documents, due diligence checklist fields not auto-populating, document classification incorrect, PDF upload processing stuck.",
  },
  {
    title: "Client Portal Access and Authentication Issues",
    summary: "Resolution procedures for client portal authentication problems including MFA enrollment loops, SSO session timeouts, IP whitelist enforcement failures, and dashboard loading performance.",
    body: "Client portal access issues at Binocs affect LP (Limited Partner) investors accessing their portfolio dashboards, document rooms, and reporting. Issues include MFA enrollment loops after password reset, SSO session timeouts too aggressive for document review sessions, IP whitelist not being enforced for admin accounts, and dashboard loading extremely slowly. The portal uses OAuth 2.0 with Okta as the identity provider, with MFA via authenticator app or SMS. Resolution: (1) Verify Okta integration configuration including redirect URIs, (2) Check session timeout policies for different user roles, (3) Validate IP whitelist enforcement logic, (4) Review dashboard performance optimization settings, (5) Test authentication flow end-to-end with each user role.",
    root_cause: "The MFA enrollment loop was caused by a stale session cookie that did not clear after password reset, causing the Okta integration to attempt MFA enrollment with an invalid session token. The SSO session timeout was set to 15 minutes which is too short for document review sessions that require extended reading time. The IP whitelist was implemented in the application layer but not enforced at the load balancer level for admin accounts.",
    resolution: "Fix the password reset flow to clear session cookies before redirecting to MFA enrollment. Extend SSO session timeout from 15 to 60 minutes for document review roles. Implement IP whitelist enforcement at the load balancer level for all accounts. Optimize dashboard queries with caching.",
    category: "Login",
    tags: ["portal", "sso", "mfa", "okta", "authentication", "performance"],
    confidence: 88,
    customers_affected: 15,
    resolution_time_hours: 4.0,
    severity: "high",
    preventive_actions: "Add Okta integration health checks with end-to-end authentication testing. Implement role-based session timeout configuration. Add IP whitelist enforcement audit logs. Set up portal performance monitoring with synthetic user sessions.",
    symptoms: "MFA enrollment loop after password reset, session expires during document review, IP whitelist not blocking unauthorized access attempts, dashboard takes over 30 seconds to load, SSO login fails with generic error.",
  },
  {
    title: "Portfolio Data Processing and Valuation Guide",
    summary: "Standard operating procedures for resolving portfolio data processing delays including financial upload timeouts, valuation model update failures, holding period return discrepancies, and data reconciliation mismatches.",
    body: "Portfolio data processing at Binocs handles company financial uploads, valuation model calculations, holding period return tracking, and fund administrator data reconciliation. Failure modes: (1) Portfolio company financial upload timing out for large datasets, (2) Valuation model not updating with latest comparable multiples, (3) Holding period return calculation discrepancies between internal and administrator data, (4) Fund administrator data reconciliation mismatch. The processing pipeline uses a batch job architecture with staging, validation, calculation, and publication phases. Resolution: (1) Check upload file size limits and chunking configuration, (2) Verify comparable multiples data source freshness, (3) Compare calculation methodologies between internal and administrator systems, (4) Reconcile data using the fund administrator's source data as the reference, (5) Re-process any failed batch jobs.",
    root_cause: "Large financial uploads were timing out because the file upload service had a 10MB limit without chunked upload support. The valuation model was using stale comparable multiples because the data feed from the third-party provider had a configuration error. The holding period return discrepancy was caused by different day-count conventions between internal (30/360) and administrator (actual/365) calculations.",
    resolution: "Implement chunked upload with 25MB chunks for large financial files. Fix the comparable multiples data feed configuration. Align day-count conventions with the fund administrator's methodology. Re-process valuation models and reconcile holding period returns.",
    category: "Portfolio",
    tags: ["portfolio", "valuation", "upload", "reconciliation", "financial-data"],
    confidence: 91,
    customers_affected: 10,
    resolution_time_hours: 8.0,
    severity: "high",
    preventive_actions: "Implement large file upload with chunking and progress tracking. Add data source freshness monitoring with proactive alerts. Align calculation methodologies with fund administrators. Set up daily data reconciliation jobs with exception reporting.",
    symptoms: "Financial upload timing out for files over 10MB, valuation model shows outdated multiples, holding period return differs from administrator report, fund administrator reconciliation shows mismatches, portfolio data processing taking over 6 hours.",
  },
  {
    title: "Risk Assessment and ESG Compliance Guide",
    summary: "Guide for troubleshooting risk assessment and ESG compliance scoring issues including concentration risk reports showing zeros, ESG module returning no data, stress test failures, and GDPR deletion process errors.",
    body: "Risk assessment at Binocs covers portfolio concentration risk, ESG compliance scoring, stress test scenario simulation, and regulatory compliance (GDPR). Issues include: (1) Portfolio concentration risk report showing zeros for all metrics, (2) ESG compliance scoring module returning no data, (3) Stress test scenario simulation failing to execute, (4) GDPR data deletion request not processing automatically. The risk assessment engine uses Monte Carlo simulations for stress testing, a third-party ESG data provider, and a rules engine for compliance workflows. Resolution: (1) Verify source data availability and quality for risk calculations, (2) Check ESG data provider API connectivity and subscription status, (3) Review stress test parameter files for syntax errors, (4) Check workflow automation rules for GDPR processing, (5) Re-run risk calculations after data issues are resolved.",
    root_cause: "The concentration risk report was showing zeros because a schema migration renamed the portfolio_allocation field without updating the risk calculation queries. The ESG module returned no data because the third-party API key had expired without notification. The stress test failure was caused by a dividing by zero error in the scenario configuration file.",
    resolution: "Update risk calculation queries to use the new portfolio_allocation field name. Renew the ESG data provider API key and re-pull historical ESG data. Fix the stress test scenario configuration to prevent divide-by-zero. Execute GDPR deletion requests manually and fix the automation rules.",
    category: "Risk Assessment",
    tags: ["risk", "esg", "stress-test", "gdpr", "compliance", "portfolio"],
    confidence: 85,
    customers_affected: 7,
    resolution_time_hours: 6.0,
    severity: "high",
    preventive_actions: "Add schema migration impact analysis with automatic query validation. Implement API key expiry monitoring with 30-day renewal alerts. Add stress test parameter validation before execution. Set up automated compliance workflow testing suite.",
    symptoms: "Concentration risk report shows zeros, ESG scores not available for any portfolio company, stress test simulation fails to run, GDPR deletion requests stuck in manual review, compliance dashboard showing incomplete data.",
  },
];

const ZAP_MEMORY = [
  {
    title: "CRM Data Synchronization Best Practices",
    summary: "Comprehensive guide for diagnosing CRM data synchronization issues including contact sync delays, lead enrichment failures, deal stage webhook problems, and identity resolution graph errors.",
    body: "Zap's CRM synchronization platform connects customer data across Salesforce, HubSpot, and other CRM platforms. Issues include contact sync delays exceeding 45 minutes, lead enrichment data not populating, deal stage changes not triggering webhooks, and identity resolution graph returning disconnected nodes. The sync engine uses an event-driven architecture with change data capture (CDC) from source CRMs, transformation pipelines, and target API delivery. Resolution: (1) Check CDC connector health for each source CRM, (2) Review transformation pipeline logs for mapping errors, (3) Verify target API rate limits and endpoint health, (4) Check identity resolution rules for correct matching logic, (5) Monitor sync latency percentile distributions. For identity resolution specifically, verify that the matching rule set includes email, domain, and company name with appropriate confidence thresholds.",
    root_cause: "Contact sync delays were caused by a CDC connector backlog due to a spike in CRM updates from a bulk import job. Lead enrichment failures occurred because the enrichment provider API was deprecated without notification. Identity resolution graph issues were caused by a rule update that changed the matching threshold from 80% to 95%, causing legitimate matches to be rejected.",
    resolution: "Scale CDC connector workers to clear the backlog. Migrate to the updated enrichment provider API with new authentication. Adjust identity resolution matching threshold back to 80% and re-run the merge job. Clear the sync backlog and verify all pending syncs complete within expected latency.",
    category: "CRM",
    tags: ["crm", "salesforce", "hubspot", "cdc", "identity-resolution", "enrichment"],
    confidence: 94,
    customers_affected: 18,
    resolution_time_hours: 4.5,
    severity: "high",
    preventive_actions: "Implement CDC connector backlog monitoring with auto-scaling. Add enrichment provider health checks with fallback providers. Version identity resolution rule sets with A/B comparison testing. Set up sync latency SLAs with PagerDuty alerting at threshold breaches.",
    symptoms: "CRM contact sync delayed over 30 minutes, lead enrichment not populating fields, deal stage changes not triggering webhooks, customer profiles showing disconnected identities, duplicate contacts created after merge.",
  },
  {
    title: "API Rate Limiting and Performance Optimization",
    summary: "Troubleshooting and optimization guide for API rate limit exhaustion, response pagination issues, GraphQL subscription failures, and event stream processing lag.",
    body: "Zap's API platform serves customer data export, enrichment, and real-time event streaming. Common issues: rate limit exhaustion on data export endpoints, REST API returning inconsistent pagination results, GraphQL subscriptions not delivering real-time updates, and event stream processing lag exceeding 30 minutes. The API layer uses a token bucket rate limiting algorithm with per-customer buckets. The event stream uses Kafka with consumer groups for processing. Resolution: (1) Analyze rate limit consumption patterns per customer, (2) Verify pagination cursor implementation for consistency, (3) Check GraphQL subscription resolver performance and batching, (4) Review Kafka consumer lag and partition assignment, (5) Adjust rate limits based on customer tier and usage patterns. For rate limits specifically, consider adding burst allowance and proactive warning headers.",
    root_cause: "Rate limit exhaustion was caused by a customer integration that was not respecting the 429 response and retrying aggressively without backoff. Pagination inconsistency was caused by data changes between cursor-based pages. GraphQL subscription failures were caused by a connection pool leak in the subscription resolver. Event stream lag was caused by an undersized consumer group with insufficient partitions.",
    resolution: "Implement per-customer rate limiting with burst allowance (2x base rate for 30-second bursts). Add rate limit warning headers (X-RateLimit-Remaining) for proactive client handling. Fix pagination by implementing snapshot-based cursors. Fix the connection pool leak in GraphQL subscription resolvers. Scale event stream consumer group with more partitions and consumers.",
    category: "API",
    tags: ["rate-limiting", "pagination", "graphql", "kafka", "event-stream", "performance"],
    confidence: 92,
    customers_affected: 25,
    resolution_time_hours: 5.0,
    severity: "critical",
    preventive_actions: "Add rate limit usage analytics dashboard for customers. Implement API response caching for frequently accessed endpoints. Add connection pool monitoring with auto-recovery. Set up Kafka consumer lag alerting with threshold-based scaling.",
    symptoms: "API returns 429 Too Many Requests, paginated results missing or duplicated entries, real-time subscriptions not receiving updates, event stream processing lag over 15 minutes, API response times exceeding 3 seconds.",
  },
  {
    title: "Data Import Pipeline Troubleshooting",
    summary: "Complete troubleshooting guide for the data import pipeline including CSV/JSON import job failures, column mapping issues, historical data backfill failures, and S3 export job errors.",
    body: "Zap's data import pipeline ingests customer data via CSV/JSON uploads, API integrations, and S3 exports. Issues include import jobs stuck in queued state, CSV column mappings not saving on re-import, historical data backfill failing at specific completion percentages, and S3 export jobs failing with access denied errors. The pipeline stages: Upload → Validation → Column Mapping → Transformation → Ingestion → Verification. Each stage has specific failure modes. Resolution: (1) Check the import job queue depth and worker availability, (2) Verify CSV headers match expected schema with case-insensitive comparison, (3) Review column mapping persistence logic in the database, (4) Check backfill job logs for specific error at failure point, (5) Verify S3 bucket permissions and IAM role configuration for export jobs. For backfill jobs, the failure at 73% suggests a data-specific issue that triggers only for certain records.",
    root_cause: "Import jobs were getting stuck due to a worker pool exhaustion from large backfill jobs consuming all available workers. Column mapping was not persisting because the save operation was using an incorrect primary key that collided for concurrent users. The backfill failure at 73% was caused by a specific batch containing malformed date values in the source data. S3 export failures were caused by an IAM role permissions boundary that was not updated after a bucket policy change.",
    resolution: "Implement job queue prioritization with dedicated worker pools for different job types. Fix column mapping persistence with correct composite key (customer_id + import_id). Skip malformed date records with logging in backfill jobs. Update IAM role permissions boundary to allow the new S3 bucket policy.",
    category: "Data Import",
    tags: ["import", "csv", "backfill", "s3", "pipeline", "etl"],
    confidence: 90,
    customers_affected: 12,
    resolution_time_hours: 6.0,
    severity: "high",
    preventive_actions: "Implement import job queue monitoring with per-priority worker allocation. Add CSV validation before import with detailed error reporting. Implement checkpoints for backfill jobs to resume from failure point. Set up S3 bucket policy compliance scanning.",
    symptoms: "Import job stuck in queued state for over 2 hours, CSV column mapping lost after page refresh, backfill job fails at same percentage consistently, S3 export fails with AccessDenied error, import validation showing false positives.",
  },
  {
    title: "Webhook Reliability and Delivery Guide",
    summary: "Comprehensive guide for ensuring webhook reliability including signature validation, retry mechanism improvements, deduplication, payload size optimization, and delivery monitoring.",
    body: "Webhook reliability at Zap ensures customer integrations receive real-time event notifications. Issues include webhook signature validation failing intermittently, retry mechanism not honoring exponential backoff, duplicate webhook events sent for single actions, and payload size limits too low for large customer records. The webhook system architecture: Event Source → Filtering → Signing → Delivery Queue → Retry Engine → Dead Letter Queue. Resolution: (1) Verify webhook signature generation uses consistent HMAC algorithm and key, (2) Check for clock skew between Zap servers and customer servers affecting timestamp validation, (3) Review retry queue configuration for proper exponential backoff intervals, (4) Investigate duplicate event sources (CDC vs API should not both fire), (5) Analyze payload size distribution and adjust limits accordingly. For signature validation, implement timestamp leeway window of 5 minutes to accommodate clock skew.",
    root_cause: "Intermittent signature validation failures were caused by clock skew between Zap's servers (using NTP) and customer servers (some without NTP sync), causing the timestamp in the signature to fall outside the validation window. The retry mechanism was using fixed 5-minute intervals instead of exponential backoff. Duplicate events were caused by both CDC triggers and API write triggers firing for the same data change.",
    resolution: "Implement 5-minute timestamp leeway for signature validation. Send NTP synchronization recommendations to customers. Configure retry with exponential backoff: 1min, 5min, 15min, 30min, 60min with max 5 retries. Fix duplicate event source by adding idempotency keys and deduplication at the delivery queue level. Increase payload size limit from 1MB to 5MB with chunked delivery for larger payloads.",
    category: "Webhook",
    tags: ["webhook", "signature", "retry", "deduplication", "delivery", "payload"],
    confidence: 88,
    customers_affected: 15,
    resolution_time_hours: 4.0,
    severity: "high",
    preventive_actions: "Add webhook signature validation with configurable timestamp leeway. Implement customer NTP sync recommendations in onboarding. Add webhook delivery health dashboard with real-time monitoring. Set up deduplication monitoring to detect duplicate event sources.",
    symptoms: "Webhook signature validation fails intermittently, webhooks not retried after initial failure, duplicate webhook events for single action, webhook payload truncated or rejected, webhook delivery latency exceeding 30 seconds.",
  },
  {
    title: "Analytics and Segmentation Performance Guide",
    summary: "Troubleshooting guide for analytics dashboard performance including stale data displays, segmentation query timeouts, attribution report errors, and segment membership update failures.",
    body: "Zap's analytics platform provides customer 360 dashboards, segmentation queries, attribution reports, and segment membership management. Issues include dashboard showing stale data from previous day, segmentation queries timing out on large customer bases, attribution reports showing negative conversion values, and segment membership not updating on profile changes. The analytics pipeline: Data Collection → Stream Processing → Data Warehouse → ETL → Reporting Layer. Each stage can introduce delays or errors. Resolution: (1) Check the data warehouse refresh job status and failure logs, (2) Review segmentation query execution plans for full table scans, (3) Verify attribution calculation logic for edge cases with lookback windows, (4) Check segment membership trigger configuration for profile change events, (5) Monitor ETL pipeline lag between source data and reporting layer. For dashboard staleness, the data warehouse refresh job may be failing silently.",
    root_cause: "Dashboard data staleness was caused by a nightly data warehouse refresh job that was failing silently due to a disk space issue on the staging server. Segmentation queries were timing out because a recent schema change removed an index on the customer_events table. Negative attribution values were caused by a bug in the lookback window calculation that double-counted returns. Segment membership lag was caused by an event stream processing consumer that was not triggering on all profile change event types.",
    resolution: "Free up disk space on the staging server and restart the warehouse refresh job. Add the missing index on customer_events table (event_type, customer_id, timestamp). Fix attribution lookback window calculation to properly handle returns. Update segment membership triggers to handle all profile change event types.",
    category: "Analytics",
    tags: ["dashboard", "segmentation", "attribution", "etl", "data-warehouse", "performance"],
    confidence: 87,
    customers_affected: 20,
    resolution_time_hours: 5.0,
    severity: "high",
    preventive_actions: "Implement warehouse refresh job health monitoring with failure alerts. Add query performance monitoring with index recommendations. Set up attribution calculation test suite with known scenarios. Add ETL pipeline lag monitoring with tiered alerting thresholds.",
    symptoms: "Dashboard shows data from yesterday not today, segmentation query times out after 60 seconds, attribution report shows negative conversion values, segment membership not updating after profile changes, ETL pipeline lag over 4 hours.",
  },
];

const YESMADAM_MEMORY = [
  {
    title: "Payment Gateway Failure Recovery",
    summary: "Complete guide for diagnosing and resolving payment gateway failures including double charges, OTP payment failures, UPI stuck transactions, and incorrect service add-on charges.",
    body: "Payment gateway issues at YesMadam affect booking completion and customer trust. Common issues include customers charged twice for single bookings, payments deducted after OTP verification but booking shows as failed, UPI payments stuck in processing for over 24 hours, and service add-on charges not itemized in invoices. The payment flow: Booking Initiation → Payment Gateway → OTP/Biometric Verification → Bank Confirmation → Webhook → Booking Confirmation. Failures typically occur at the webhook stage where the bank confirmation is not received by the system. Resolution: (1) Check payment gateway webhook logs for delivery failures, (2) Verify webhook signature validation configuration, (3) Query the payment gateway API for transaction status using the gateway transaction ID, (4) Reconcile failed bookings against bank statement to identify captured but unconfirmed transactions, (5) Manually confirm bookings where payment was captured but webhook was lost. For double charges, immediately initiate a refund for the duplicate transaction and verify via the payment gateway dashboard.",
    root_cause: "The most common root cause is the payment confirmation webhook not being received from the payment gateway due to network timeouts or webhook delivery failures. This results in the booking remaining in 'pending' state despite the payment being captured by the bank. Double charges are caused by users clicking the pay button multiple times due to perceived timeouts, combined with insufficient idempotency on the payment creation endpoint.",
    resolution: "Implement webhook retry with acknowledgment mechanism. Add idempotency keys for payment creation to prevent duplicates. Build a reconciliation job that matches bank statement transactions against pending bookings and auto-confirms matches. For affected customers: reconcile the transaction manually and either confirm the booking or initiate a refund within 24 hours.",
    category: "Payment",
    tags: ["payment", "gateway", "webhook", "otp", "upi", "reconciliation"],
    confidence: 95,
    customers_affected: 35,
    resolution_time_hours: 3.0,
    severity: "critical",
    preventive_actions: "Implement idempotency keys on all payment endpoints. Add webhook delivery monitoring with automatic retry and escalation. Build automated reconciliation job that runs every 15 minutes. Implement client-side rate limiting to prevent duplicate payment submissions.",
    symptoms: "Customer charged twice for single booking, payment deducted but booking shows as failed, UPI payment stuck in processing, service add-on charges not itemized in invoice, booking not confirmed after successful payment.",
  },
  {
    title: "Refund Processing and SLA Management",
    summary: "Standard operating procedures for refund processing including delayed refund investigations, partial refund calculations, cancellation fee waivers, and refund status communication.",
    body: "Refund processing at YesMadam covers service cancellations, failed bookings, and customer satisfaction refunds. Issues include refunds pending for over 8 days, refund amounts not reflecting in bank accounts after processing, partial refunds for service downgrades calculated incorrectly, and cancellation fee waivers not applied for loyalty members. The refund pipeline: Request Submission → Validation → Approval (auto/manual) → Payment Gateway Refund API → Bank Processing (3-5 business days) → Confirmation. Delays typically occur at the manual approval step for amounts exceeding a threshold. Resolution: (1) Check refund request status in the system, (2) Review approval queue for manual review requirements, (3) Verify refund amount calculation against booking value and cancellation policy, (4) Check payment gateway refund API response for confirmation, (5) Communicate estimated bank processing timeline to customer. For refunds not reflecting in bank, provide the refund reference number and gateway transaction ID for the customer to share with their bank.",
    root_cause: "Refund delays are caused by manual review requirements for amounts exceeding the auto-approval threshold of ₹2000, combined with insufficient staffing during peak periods. Incorrect partial refunds are caused by a proration bug that uses the wrong divisor when calculating the refund for unused service periods. Loyalty member cancellation fee waivers are not applying because the loyalty tier check happens before the cancellation policy lookup.",
    resolution: "Increase auto-approval threshold from ₹2000 to ₹5000 for standard refunds. Add staff scheduling optimization based on refund volume forecasts. Fix partial refund proration calculation to use correct service period divisor. Fix loyalty member fee waiver logic to check tier before applying cancellation fees. Clear the manual approval backlog and process all pending refunds.",
    category: "Refund",
    tags: ["refund", "cancellation", "payment", "loyalty", "approval", "sla"],
    confidence: 92,
    customers_affected: 20,
    resolution_time_hours: 48.0,
    severity: "high",
    preventive_actions: "Implement automated refund processing for amounts under ₹5000. Add refund SLA monitoring with escalation for requests exceeding 48 hours. Fix partial refund calculation with comprehensive test coverage. Implement loyalty member auto-waiver for cancellation fees.",
    symptoms: "Refund pending for over 48 hours, refund processed but not in bank account, partial refund amount incorrect, cancellation fee charged to loyalty member, refund status not communicated to customer.",
  },
  {
    title: "Beautician Dispatch and No-Show Resolution",
    summary: "Guide for resolving beautician dispatch system issues including no-shows, scheduling gaps, rating posting failures, and attendance marking problems.",
    body: "Beautician dispatch at YesMadam coordinates service professionals to customer appointments. Issues include beauticians not arriving for scheduled appointments (no-shows), preferred beauticians not appearing in available slots, ratings and reviews not posting after service completion, and beautician attendance not marked in the system after service. The dispatch system: Customer Booking → Beautician Assignment → Notification → Dispatch → Check-in → Service → Check-out → Feedback. Failures at the notification or check-in stage cause no-shows and unmarked attendance. Resolution: (1) Check beautician assignment algorithm for conflicts, (2) Verify notification delivery (SMS/push/in-app) to assigned beautician, (3) Review beautician check-in GPS validation, (4) Check rating submission pipeline for errors, (5) Manually beautician attendance if system mark fails. For no-shows, immediately dispatch an alternative beautician if available, or offer rescheduling with compensation.",
    root_cause: "Beautician no-shows are primarily caused by notification delivery failures (SMS not reaching due to DLT template issues, push notifications not delivered due to app background state). Preferred beautician not showing in slots occurs when the beautician's availability is not correctly synced from their calendar. Rating posting failures occur when the feedback service call times out during peak hours.",
    resolution: "Implement notification delivery tracking with fallback channels (SMS + push + in-app notification). Fix beautician calendar sync to update availability in real-time. Increase rating service timeout and implement async rating processing with retry. For affected customers: re-dispatch or reschedule with service credit compensation.",
    category: "Beautician",
    tags: ["dispatch", "no-show", "scheduling", "notification", "rating", "attendance"],
    confidence: 89,
    customers_affected: 15,
    resolution_time_hours: 2.0,
    severity: "high",
    preventive_actions: "Implement multi-channel notification with delivery tracking. Add beautician check-in GPS verification with auto-escalation for late check-ins. Set up rating service health monitoring. Implement no-show auto-detection with immediate dispatch escalation.",
    symptoms: "Beautician did not arrive for scheduled appointment, preferred beautician not available in slot selection, rating/review not posting after service, beautician attendance not marked, no notification received by beautician.",
  },
  {
    title: "Wallet and Cashback System Guide",
    summary: "Complete troubleshooting guide for the wallet and cashback system including balance discrepancies, top-up processing failures, double deductions, referral reward tracking issues, and gift card redemption errors.",
    body: "YesMadam's wallet system stores customer balances, processes top-ups, credits cashback from referrals, and handles gift card redemptions. Issues include wallet balance showing incorrect amounts after UPI top-ups, wallet amounts deducted twice for single service bookings, cashback not credited after referral completion, gift card redemption failing with invalid code errors, and referral tracking links expiring before use. The wallet system uses an event-sourced architecture where every transaction is recorded as an event and the current balance is computed as the sum of all events. Resolution: (1) Check wallet transaction log for missing or duplicate events, (2) Verify UPI webhook processing for top-up confirmations, (3) Review referral completion criteria and cashback trigger configuration, (4) Check gift card code validation logic, (5) Replay wallet events to recompute balance if inconsistencies found. For UPI top-ups specifically, the webhook from the payment gateway may be delayed or lost.",
    root_cause: "Wallet balance discrepancies are caused by UPI payment webhooks that are delayed or lost, resulting in top-up transactions being recorded as 'pending' permanently. Double wallet deductions are caused by a race condition where the booking service deducts the wallet balance twice for concurrent booking requests. Gift card redemption failures are caused by the code validation logic being case-sensitive while customers enter codes in lowercase.",
    resolution: "Implement UPI webhook retry with reconciliation job that cross-references bank statement. Add distributed locking for wallet deduction operations. Fix gift card code validation to be case-insensitive. Reconcile all pending wallet transactions and recompute affected balances. Clear the gift card redemption backlog.",
    category: "Wallet",
    tags: ["wallet", "cashback", "upi", "gift-card", "referral", "transaction"],
    confidence: 88,
    customers_affected: 25,
    resolution_time_hours: 4.0,
    severity: "high",
    preventive_actions: "Implement wallet event replay capability for balance reconciliation. Add UPI webhook health monitoring with automatic retry. Implement distributed locking for all wallet operations. Add gift card code validation with case-insensitive matching.",
    symptoms: "Wallet balance incorrect after top-up, wallet deducted twice for single booking, cashback not received after referral, gift card says invalid code, referral link expired before use.",
  },
  {
    title: "Booking and Rescheduling Service Guide",
    summary: "Standard operating procedures for booking and rescheduling issues including booking confirmations after payment, reschedule option availability, same-day booking visibility, subscription cancellation processing, and festive offer discount applications.",
    body: "Booking and rescheduling at YesMadam covers the full lifecycle of service appointments. Issues include bookings not confirming after payment (booking screen shows failed but payment captured), reschedule option greyed out in the app, same-day bookings not appearing in beautician schedules, subscription cancellations not taking effect after request, and festive offer discounts not applying at checkout. The booking lifecycle: Browse → Select Service → Select Slot → Payment → Confirmation → Reminder → Service → Completion. Resolution: (1) Check booking confirmation status in the system (may need manual confirmation), (2) Verify reschedule window configuration (may be disabled within 2 hours of appointment), (3) Check beautician schedule sync for same-day bookings, (4) Review subscription cancellation workflow for pending renewals, (5) Verify discount coupon validity, usage limits, and minimum order value requirements. For bookings that don't confirm after payment, the webhook processing is the most common failure point.",
    root_cause: "Booking not confirming after payment is the same payment webhook issue described in the Payment guide. Reschedule option greyed out when it should be available is caused by a timezone bug that compares the appointment time in UTC instead of the customer's local timezone. Same-day bookings not appearing in beautician schedules are caused by the schedule cache that is updated daily at midnight instead of in real-time. Subscription cancellations not taking effect are caused by the cancellation being applied to the next billing cycle but the subscription system showing the current cycle as active.",
    resolution: "Fix payment webhook processing (refer to Payment Gateway guide). Fix timezone handling in reschedule availability check to use customer local time. Implement real-time schedule cache invalidations on same-day bookings. Fix subscription cancellation display to show 'Cancellation Pending - Active until end of billing cycle'. Apply festive discounts that were missed due to coupon code case-sensitivity.",
    category: "Booking",
    tags: ["booking", "reschedule", "subscription", "discount", "timezone", "confirmation"],
    confidence: 91,
    customers_affected: 30,
    resolution_time_hours: 3.5,
    severity: "high",
    preventive_actions: "Implement booking-payment reconciliation job running every 5 minutes. Add timezone-aware scheduling throughout the booking system. Implement real-time schedule cache invalidation for same-day bookings. Add subscription cancellation confirmation with clear active-until messaging.",
    symptoms: "Booking not confirmed after payment deduction, reschedule option unavailable when expected, same-day booking not visible to beautician, subscription still active after cancellation request, festival discount not applied at checkout.",
  },
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
/* WORKSPACE NAME MAP                                                  */
/* ------------------------------------------------------------------ */

export const WORKSPACE_NAMES = {
  signaldesk: "SignalDesk",
  corally: "Corally",
  foxo: "Foxo",
  binocs: "Binocs",
  zap: "Zap",
  yesmadam: "YesMadam",
};

/* ------------------------------------------------------------------ */
/* CUSTOMER EMAIL → WORKSPACE INFERENCE MAP                            */
/* ------------------------------------------------------------------ */

export const EMAIL_TO_WORKSPACE = {};
Object.entries(CUSTOMERS).forEach(([ws, customers]) => {
  customers.forEach((c) => {
    EMAIL_TO_WORKSPACE[c.email.toLowerCase()] = ws;
  });
});

/* ------------------------------------------------------------------ */
/* EXPORT                                                              */
/* ------------------------------------------------------------------ */

export const WORKSPACE_SEEDS = {
  corally: {
    tickets: CORALLY_TICKETS,
    signals: CORALLY_SIGNALS,
    incidents: CORALLY_INCIDENTS,
    drafts: DRAFT_BODIES.corally,
    memoryEntries: CORALLY_MEMORY,
  },
  foxo: {
    tickets: FOXO_TICKETS,
    signals: FOXO_SIGNALS,
    incidents: FOXO_INCIDENTS,
    drafts: DRAFT_BODIES.foxo,
    memoryEntries: FOXO_MEMORY,
  },
  binocs: {
    tickets: BINOCS_TICKETS,
    signals: BINOCS_SIGNALS,
    incidents: BINOCS_INCIDENTS,
    drafts: DRAFT_BODIES.binocs,
    memoryEntries: BINOCS_MEMORY,
  },
  zap: {
    tickets: ZAP_TICKETS,
    signals: ZAP_SIGNALS,
    incidents: ZAP_INCIDENTS,
    drafts: DRAFT_BODIES.zap,
    memoryEntries: ZAP_MEMORY,
  },
  yesmadam: {
    tickets: YESMADAM_TICKETS,
    signals: YESMADAM_SIGNALS,
    incidents: YESMADAM_INCIDENTS,
    drafts: DRAFT_BODIES.yesmadam,
    memoryEntries: YESMADAM_MEMORY,
  },
};

export function getWorkspaceSeed(workspaceId) {
  return WORKSPACE_SEEDS[workspaceId] || null;
}
