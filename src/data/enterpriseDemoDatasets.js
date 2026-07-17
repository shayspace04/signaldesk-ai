function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(7 + (n % 13), (n * 17) % 60, 0, 0);
  return d.toISOString();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

const BODIES = {
  "Financial Report": "Unable to generate financial reports from our portfolio. The report builder times out at step 3 of the aggregation pipeline. We have a deadline with the board this week. -- {name}",
  "Portfolio": "Our portfolio holdings page is showing stale positions. Last refresh was several days ago despite manual sync attempts. NAV discrepancy between calculated vs summed positions. -- {name}",
  "Document Review": "AI document review pipeline has stalled overnight. Uploaded fund documents stuck in pending OCR status since yesterday. -- {name}",
  "Risk Assessment": "Quarterly risk assessment returning incomplete results. Portfolio concentration analysis shows zero values across all funds. Compliance flagging as reporting risk. -- {name}",
  "Client": "Clients reporting issues with the investor portal. Dashboard widgets fail to load and document vault shows empty folders. Several LPs unable to access Q3 statements. -- {name}",
  "Login": "Intermittent login failures across our team. SSO redirect loops back to login page without authenticating. Magic links also fail to arrive for some users. -- {name}",
  "NAV Calculation": "NAV calculation for Fund III came out 2.3% lower than independent calculation. System using different valuation date for certain holdings. Audit team needs this reconciled. -- {name}",
  "OCR Processing": "Scanned PDF documents not being processed by OCR pipeline. Resubmissions remain in pending status. Document review workflow completely blocked. -- {name}",
  "API": "API integration experiencing intermittent failures. Requests to data endpoint return 503 errors during peak hours. Timeout threshold too aggressive for batch operations. -- {name}",
  "Webhook": "Webhook events not reaching our endpoint reliably. Missed order confirmations and status changes. Retry mechanism not delivering failed events. -- {name}",
  "Data Import": "Scheduled data import from S3 bucket failing since yesterday. Job errors out at about 60 percent with malformed record error. Need this for daily reconciliation. -- {name}",
  "Analytics": "Real-time analytics dashboard showing stale data. Metrics have not updated for hours despite pipeline appearing healthy. Freshness indicator shows warning state. -- {name}",
  "CRM": "Customer records not syncing between CRM and platform. Changes made over 2 hours ago still not reflected. Sync status shows healthy but data not flowing. -- {name}",
  "Integrations": "Integration with ticketing system stopped working. New tickets not appearing in SignalDesk console. Connector shows connected but no data flowing. -- {name}",
  "CRM Sync": "Partner data synchronization stalled. Salesforce updates not propagating to partner portal. Partners complaining about outdated account info. -- {name}",
  "Partner Onboarding": "New partner onboarding stuck. Invitation emails not delivering, verification workflow times out. Three partners waiting since last week. -- {name}",
  "Contract": "Contract renewal auto-approved without required VP sign-off. Billing amount does not match negotiated terms. Need correction before next invoice run. -- {name}",
  "Billing": "Latest invoice shows incorrect charges. Billed for enterprise tier but contract states growth plan pricing. Overcharge needs credit. -- {name}",
  "User Access": "Team member unable to access account after password reset. Reset link works but login shows invalid credentials error. -- {name}",
  "Appointment": "Patients cannot complete appointment bookings via portal. Form submits but appointment does not appear in schedule. Payment taken but no confirmation sent. -- {name}",
  "Prescription": "E-prescription service timing out when sending to pharmacies. System shows sent but pharmacies report nothing received. Affecting patient care. -- {name}",
  "Patient": "Patient records not updating across the system. Demographics changes in one module not reflected in others. Duplicate records created during merge operations. -- {name}",
  "Lab Reports": "Lab results uploaded through portal not being processed. Stuck in pending review status indefinitely. Auto-import from reference lab stalled since update. -- {name}",
  "Doctor": "Doctor availability calendars not syncing with scheduling. Blocked time slots showing as available to patients. Overbooking becoming serious issue. -- {name}",
  "Insurance": "Insurance eligibility checks timing out. Front desk cannot verify patient coverage before appointments. Prior authorizations stuck in queue. -- {name}",
  "Booking": "Booked beauty package this morning but not showing in appointments. Payment deducted successfully. Please check why booking was not confirmed. -- {name}",
  "Payment": "Payment for bridal makeup package failed but amount was deducted. Bank shows completed but app shows payment failed. Need urgent resolution. -- {name}",
  "Refund": "Cancelled subscription 10 days ago, refund still not processed. App shows initiated but no update. Policy says 5 to 7 business days. -- {name}",
  "Wallet": "Wallet balance showing incorrect info. Added funds via UPI this morning but balance still shows old amount. Bank reflects the transaction. -- {name}",
  "Beautician": "Assigned beautician did not show up for appointment. Waited over an hour with no cancellation notification. This has happened before. -- {name}",
  "Cancellation": "Requested subscription cancellation 3 days ago but still able to book services. Please process cancellation and confirm. -- {name}",
  "Feature Request": "Would like to see a bulk export feature for portfolio reports. Generating reports individually is very time-consuming during month-end close. -- {name}",
  "Documentation": "API documentation for webhook endpoints is unclear about the retry mechanism. Events were lost due to unexpected payload format. -- {name}",
  "Product Bug": "Identified a bug in the data export function. CSV output becomes misaligned with special characters causing issues with downstream systems. -- {name}",
  "General": "Having an issue with the platform and need assistance. Please investigate at your earliest convenience. -- {name}",
};

function ticketPriority(i, isRecurring) {
  if (isRecurring) { const c = i % 4; if (c < 2) return "high"; if (c < 3) return "urgent"; return "normal"; }
  const p = ["urgent","high","normal","low"]; return p[(i + 3) % 4];
}

function ticketStatus(i) {
  const s = ["new","triaged","triaged","waiting_approval","waiting_approval","resolved","new"];
  return s[i % 7];
}

function assignee(i) {
  const a = ["Alice Chen","Bob Martinez","Carol Singh","Dave Kim","Eve Johnson","Frank Lee","Grace Patel","Henry Zhao","Iris Wang","Jake Thompson"];
  return a[i % a.length];
}

function buildTicket(title, category, customer, opts) {
  const idx = (opts && opts.index) || 0;
  const isRecurring = !!(opts && opts.recurring);
  return {
    title: title,
    category: category,
    priority: (opts && opts.priority) || ticketPriority(idx, isRecurring),
    status: (opts && opts.status) || ticketStatus(idx),
    customer: customer,
    assigned_to: assignee(idx),
    body: (BODIES[category] || BODIES.General).replace("{name}", (customer && customer.name) || "Customer"),
    created_at: daysAgo((opts && opts.daysAgo !== undefined) ? opts.daysAgo : (idx + 1)),
    recurring: isRecurring,
  };
}


const BINOCS_CUSTOMERS = [
  { name: "SilverPoint Capital", email: "ops@silverpointcap.com", domain: "enterprise" },
  { name: "Atlas Equity Group", email: "compliance@atlas-equity.com", domain: "enterprise" },
  { name: "Meridian Ventures", email: "support@meridian.vc", domain: "enterprise" },
  { name: "PineBrook Advisory", email: "admin@pinebrookadvisory.com", domain: "enterprise" },
  { name: "Summit PE Partners", email: "deals@summitpe.com", domain: "enterprise" },
  { name: "Horizon Family Office", email: "it@horizonfo.com", domain: "family-office" },
  { name: "Crestview Investments", email: "ops@crestviewinv.com", domain: "enterprise" },
  { name: "NorthStar Asset Mgmt", email: "support@northstaram.com", domain: "enterprise" },
  { name: "BayFront Capital", email: "compliance@bayfrontcap.com", domain: "enterprise" },
  { name: "RidgeLine Financial", email: "admin@ridgelinefin.com", domain: "enterprise" },
  { name: "OakTree Fund Services", email: "ops@oaktreefund.com", domain: "fund-admin" },
  { name: "Pinnacle Wealth Group", email: "help@pinnaclewealth.com", domain: "enterprise" },
  { name: "StoneBridge Partners", email: "it@stonebridgepartners.com", domain: "enterprise" },
  { name: "ClearView Analytics", email: "support@clearviewanalytics.io", domain: "analytics" },
  { name: "Evergreen Capital Mgmt", email: "admin@evergreencap.com", domain: "enterprise" },
].map((c, i) => ({ ...c, id: "cust-binocs-" + i }));


const BINOCS_TICKETS = [
  ["Q3 financial report generation failing with portfolio aggregation timeout", "Financial Report", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["Portfolio IRR calculation returning incorrect values across multiple funds", "Financial Report", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Monthly investor letter PDF generation failed for all LP accounts", "Financial Report", { recurring: true, daysAgo: 3, priority: "urgent" }],
  ["Fund III NAV calculation off by 2.3 percent compared to independent valuation", "NAV Calculation", { recurring: true, daysAgo: 3, priority: "urgent" }],
  ["Tax lot accounting report generation stuck at 45 percent for Q3 close", "Financial Report", { recurring: true, daysAgo: 4, priority: "high" }],
  ["OCR document processing pipeline unresponsive for batch uploads", "OCR Processing", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["AI risk scoring engine returning inconsistent results across portfolios", "Risk Assessment", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Due diligence document review stalled in OCR queue for over 6 hours", "Document Review", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Quarterly risk assessment report showing zero VaR calculations", "Risk Assessment", { recurring: true, daysAgo: 5, priority: "urgent" }],
  ["Client investor dashboard loading extremely slow for LP users", "Client", { recurring: true, daysAgo: 1, priority: "high" }],
  ["Portfolio company financial upload timing out for large Excel files", "Portfolio", { daysAgo: 6, priority: "high" }],
  ["Holding period return calculation discrepancy for secondary sale", "Portfolio", { daysAgo: 7 }],
  ["ESG compliance scoring module returned no data for Q3 filings", "Risk Assessment", { daysAgo: 8, priority: "high" }],
  ["SSO session timeout too aggressive during document review sessions", "Login", { daysAgo: 9 }],
  ["Board pack auto-generation skipping appendix pages for board meeting", "Document Review", { daysAgo: 10 }],
  ["Audit trail export missing user activity timestamps for compliance", "Client", { daysAgo: 11 }],
  ["Data room permission sync delayed for new investor onboarding", "Client", { daysAgo: 12 }],
  ["Invoice for Q3 management fees showing incorrect calculation basis", "Financial Report", { daysAgo: 13, priority: "high" }],
  ["Fund administrator billed twice for same month service fee", "Client", { daysAgo: 14, priority: "high" }],
  ["Transaction fee reconciliation mismatch between portfolio statements", "Portfolio", { daysAgo: 15 }],
  ["Billing portal not showing credit note for previously invoiced overcharge", "Client", { daysAgo: 16 }],
  ["Client portal MFA enrollment loop after password reset for LP user", "Login", { daysAgo: 17, priority: "high" }],
  ["IP whitelist not being enforced for admin account access", "Login", { daysAgo: 18, priority: "urgent" }],
  ["Magic link authentication failing for international team members", "Login", { daysAgo: 19, priority: "high" }],
  ["Bulk export of portfolio reports for month-end close processing", "Feature Request", { daysAgo: 20 }],
  ["API endpoint for direct NAV data ingestion from fund administrators", "Feature Request", { daysAgo: 21 }],
  ["Custom dashboard builder for LP reporting preferences", "Feature Request", { daysAgo: 22 }],
  ["Automated compliance report scheduling and distribution", "Feature Request", { daysAgo: 23 }],
  ["API documentation missing error code references for rate limiting", "Documentation", { daysAgo: 24 }],
  ["User guide for portfolio rebalancing tool is out of date", "Documentation", { daysAgo: 25 }],
  ["Data export CSV misaligned for fund names with special characters", "Product Bug", { daysAgo: 26 }],
  ["Stress test scenario simulation engine crashing with large datasets", "Product Bug", { daysAgo: 27, priority: "urgent" }],
  ["GDPR data deletion request workflow not triggering automatic processing", "Product Bug", { daysAgo: 28, priority: "high" }],
  ["Restricted stock unit valuation model using incorrect discount rate", "Product Bug", { daysAgo: 29, priority: "high" }],
  ["Investor capital call notification not generating PDF statements", "Client", { recurring: true, daysAgo: 4, priority: "high" }],
  ["Fund performance attribution report showing negative unexplained variance", "Portfolio", { recurring: true, daysAgo: 5, priority: "high" }],
  ["LP account statement generation queued for over 3 hours", "Client", { recurring: true, daysAgo: 6, priority: "normal" }],
  ["Portfolio rebalancing model not loading latest market multiples", "Portfolio", { recurring: true, daysAgo: 7, priority: "high" }],
];


const ZAP_CUSTOMERS = [
  { name: "RetailMax Inc", email: "eng@retailmax.com", domain: "retail" },
  { name: "DataDriven Co", email: "ops@datadriven.co", domain: "analytics" },
  { name: "CustomerFirst", email: "support@customerfirst.io", domain: "saas" },
  { name: "OmniRetail", email: "it@omniretail.com", domain: "retail" },
  { name: "InsightHub", email: "admin@insighthub.io", domain: "analytics" },
  { name: "MarketPulse Analytics", email: "eng@marketpulse.com", domain: "analytics" },
  { name: "BrandWise Solutions", email: "ops@brandwise.io", domain: "marketing" },
  { name: "EcomMetrics", email: "support@ecommetrics.com", domain: "ecommerce" },
  { name: "SegmentFlow", email: "dev@segmentflow.io", domain: "data" },
  { name: "Clarity Data", email: "admin@claritydata.com", domain: "analytics" },
  { name: "NexGen Commerce", email: "engineering@nexgencommerce.com", domain: "ecommerce" },
  { name: "Velocity Retail Group", email: "ops@velocityretail.io", domain: "retail" },
  { name: "SmartShopper Analytics", email: "help@smartshopper.ai", domain: "analytics" },
  { name: "Digital Shelf Inc", email: "support@digitalshelf.io", domain: "retail" },
  { name: "PixelPath Marketing", email: "admin@pixelpath.com", domain: "marketing" },
].map((c, i) => ({ ...c, id: "cust-zap-" + i }));

const ZAP_TICKETS = [
  ["CRM contact sync delayed by over 45 minutes for bulk updates", "CRM", { recurring: true, daysAgo: 1, priority: "high" }],
  ["Customer profile merge tool producing duplicate records on sync", "CRM", { recurring: true, daysAgo: 2, priority: "high" }],
  ["REST API returning inconsistent pagination for customer list endpoint", "API", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["API rate limit exceeded during peak hours for data export requests", "API", { recurring: true, daysAgo: 3, priority: "urgent" }],
  ["Webhook signature validation failing intermittently for event deliveries", "Webhook", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["Duplicate webhook events sent for single customer purchase action", "Webhook", { recurring: true, daysAgo: 4, priority: "high" }],
  ["Event stream processing lag of over 30 minutes during peak traffic", "API", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Customer data import job stuck in queued state for scheduled imports", "Data Import", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Real-time analytics dashboard showing data from previous day", "Analytics", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Segmentation query timing out on customer base of over 2 million records", "Analytics", { recurring: true, daysAgo: 5, priority: "high" }],
  ["Lead enrichment data not populating in Salesforce after API update", "CRM", { daysAgo: 6, priority: "high" }],
  ["Historical data backfill job failed at 73 percent completion", "Data Import", { daysAgo: 7, priority: "urgent" }],
  ["Market automation HubSpot sync broken after connector update", "Integrations", { daysAgo: 8, priority: "high" }],
  ["Custom attribute mapping lost after schema migration", "Integrations", { daysAgo: 9 }],
  ["S3 export job failing with access denied error", "Data Import", { daysAgo: 10, priority: "urgent" }],
  ["Segment membership not updating on customer profile changes", "Analytics", { daysAgo: 11, priority: "high" }],
  ["Data enrichment provider returning stale firmographic data", "Data Import", { daysAgo: 12 }],
  ["Invoice for API usage tier shows incorrect overage charges", "API", { daysAgo: 13, priority: "high" }],
  ["Billing dashboard not reflecting enterprise discount", "Analytics", { daysAgo: 14 }],
  ["Data import credits consumed but import jobs failed", "Data Import", { daysAgo: 15, priority: "high" }],
  ["Double charged for monthly subscription on upgrade", "CRM", { daysAgo: 16, priority: "high" }],
  ["SSO login failing for Okta-integrated enterprise accounts", "CRM", { daysAgo: 17, priority: "high" }],
  ["API key rotation not invalidating old keys immediately", "API", { daysAgo: 18, priority: "urgent" }],
  ["Team member unable to access analytics after role change", "Analytics", { daysAgo: 19 }],
  ["Batch webhook replay capability for failed event delivery", "Feature Request", { daysAgo: 20 }],
  ["Custom data transformation pipeline for incoming imports", "Feature Request", { daysAgo: 21 }],
  ["Real-time webhook testing console in dashboard", "Feature Request", { daysAgo: 22 }],
  ["Granular RBAC for API key permissions", "Feature Request", { daysAgo: 23 }],
  ["Webhook payload schema documentation outdated", "Documentation", { daysAgo: 24 }],
  ["Rate limiting documentation missing details on burst allowance", "Documentation", { daysAgo: 25 }],
  ["Attribution report showing negative conversion values", "Product Bug", { daysAgo: 26, priority: "urgent" }],
  ["Zendesk integration creating duplicate support tickets", "Product Bug", { daysAgo: 27, priority: "high" }],
  ["CSV import column mapping not persisting on re-import", "Product Bug", { daysAgo: 28 }],
  ["GraphQL subscription not delivering real-time updates", "Product Bug", { daysAgo: 29, priority: "high" }],
  ["Webhook retry mechanism not honoring exponential backoff schedule", "Webhook", { recurring: true, daysAgo: 5, priority: "high" }],
  ["CRM deal stage change not triggering outbound webhook", "CRM", { recurring: true, daysAgo: 6 }],
  ["Slack integration not posting new customer signup alerts", "Integrations", { recurring: true, daysAgo: 7 }],
  ["Data export API response time degraded over 5 seconds", "API", { recurring: true, daysAgo: 8, priority: "high" }],
];


const FOXO_CUSTOMERS = [
  { name: "City General Hospital", email: "it@citygeneral.com", domain: "hospital" },
  { name: "WellCare Clinics", email: "support@wellcareclinics.com", domain: "clinic" },
  { name: "MediConnect", email: "ops@mediconnect.io", domain: "healthcare" },
  { name: "HealthFirst Medical", email: "admin@healthfirstmed.com", domain: "hospital" },
  { name: "PrimePath Labs", email: "lab@primepathlabs.com", domain: "lab" },
  { name: "Apollo Health Systems", email: "help@apollohs.com", domain: "hospital" },
  { name: "Redwood Medical Group", email: "support@redwoodmed.com", domain: "clinic" },
  { name: "Sunrise Cardiology", email: "it@sunrisecardio.com", domain: "clinic" },
  { name: "Mercy Health Network", email: "ops@mercyhealth.net", domain: "hospital" },
  { name: "Peak Diagnostics", email: "lab@peakdiagnostics.com", domain: "lab" },
  { name: "Valley View Medical Center", email: "help@valleyviewmed.org", domain: "hospital" },
  { name: "NorthStar Pediatrics", email: "support@northstarpediatrics.com", domain: "clinic" },
  { name: "Pacific Medical Imaging", email: "admin@pacificimaging.com", domain: "imaging" },
  { name: "Unity Health Partners", email: "ops@unityhealth.io", domain: "hospital" },
  { name: "Central Diagnostics Lab", email: "lab@centraldiagnostics.com", domain: "lab" },
].map((c, i) => ({ ...c, id: "cust-foxo-" + i }));

const FOXO_TICKETS = [
  ["Patient unable to book appointment via portal confirmation fails after payment", "Appointment", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Appointment slot double-booking in cardiology department", "Appointment", { recurring: true, daysAgo: 2, priority: "high" }],
  ["E-prescription not loading in pharmacy systems for controlled substances", "Prescription", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Prescription renewal request not reaching doctor inbox", "Prescription", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Critical lab result alert not triggering for abnormal values", "Lab Reports", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["Lab report auto-import from Quest Diagnostics stalled since update", "Lab Reports", { recurring: true, daysAgo: 4, priority: "high" }],
  ["Patient demographics update not persisting across multiple visits", "Patient", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Patient PHI data export failing for insurance audit request", "Patient", { recurring: true, daysAgo: 5, priority: "urgent" }],
  ["Doctor availability calendar not syncing with patient scheduling", "Doctor", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Insurance eligibility verification API timing out regularly", "Insurance", { recurring: true, daysAgo: 4, priority: "urgent" }],
  ["Patient profile showing duplicated records after merge operation", "Patient", { daysAgo: 6, priority: "high" }],
  ["Lab report PDF upload failing with date parsing error", "Lab Reports", { daysAgo: 7 }],
  ["Telehealth video consultation session dropped mid-appointment", "Appointment", { daysAgo: 8, priority: "urgent" }],
  ["Locum tenens provider unable to access assigned patient panel", "Doctor", { daysAgo: 9 }],
  ["Physician referral form submission failing with validation error", "Doctor", { daysAgo: 10 }],
  ["Automated appointment reminders not sending SMS notifications", "Appointment", { daysAgo: 11, priority: "high" }],
  ["Prior authorization request stuck in pending state for 5 days", "Insurance", { daysAgo: 12, priority: "high" }],
  ["Claim submission rejected due to formatting error on CMS-1500", "Insurance", { daysAgo: 13, priority: "high" }],
  ["Patient billing statement showing incorrect insurance adjustment", "Patient", { daysAgo: 14 }],
  ["Co-pay collection not reflected in patient financial records", "Patient", { daysAgo: 15 }],
  ["Insurance reimbursement amount does not match EOB explanation", "Insurance", { daysAgo: 16, priority: "high" }],
  ["Physician unable to access patient records after credential update", "Doctor", { daysAgo: 17, priority: "high" }],
  ["Patient portal MFA setup failing for elderly patients", "Patient", { daysAgo: 18 }],
  ["Staff member locked out after failed login attempts", "Doctor", { daysAgo: 19 }],
  ["Bulk lab result upload via HL7 interface", "Feature Request", { daysAgo: 20 }],
  ["Automated insurance claim resubmission for denied claims", "Feature Request", { daysAgo: 21 }],
  ["Patient self-check-in kiosk integration API", "Feature Request", { daysAgo: 22 }],
  ["Real-time pharmacy inventory integration", "Feature Request", { daysAgo: 23 }],
  ["HL7 interface documentation missing field mappings for labs", "Documentation", { daysAgo: 24 }],
  ["API reference for patient record search outdated", "Documentation", { daysAgo: 25 }],
  ["HL7 message feed from reference lab delayed by over 4 hours", "Product Bug", { daysAgo: 26, priority: "high" }],
  ["Controlled substance prescription requires manual override every time", "Product Bug", { daysAgo: 27, priority: "high" }],
  ["Appointment reschedule workflow not sending update to patient", "Product Bug", { daysAgo: 28 }],
  ["Patient alert preferences not saving after profile update", "Product Bug", { daysAgo: 29 }],
  ["Surgery scheduling conflicts due to OR availability sync failure", "Appointment", { recurring: true, daysAgo: 6, priority: "high" }],
  ["Medication reconciliation tool not pulling from pharmacy history", "Prescription", { recurring: true, daysAgo: 7, priority: "high" }],
  ["Lab reference range values not updating for new assay codes", "Lab Reports", { recurring: true, daysAgo: 8 }],
  ["Insurance plan verification failing for Medicare Advantage", "Insurance", { recurring: true, daysAgo: 9, priority: "high" }],
];


const CORALLY_CUSTOMERS = [
  { name: "Acme Partners", email: "ops@acmepartners.com", domain: "enterprise" },
  { name: "NexusConnect Inc", email: "support@nexusconnect.io", domain: "saas" },
  { name: "DataBridge Solutions", email: "eng@databridge.io", domain: "data" },
  { name: "PinnacleCRM", email: "help@pinnaclecrm.com", domain: "crm" },
  { name: "SynergyCloud", email: "admin@synergycloud.io", domain: "cloud" },
  { name: "VelocityPartners", email: "ops@velocitypartners.com", domain: "enterprise" },
  { name: "OmniChannel Inc", email: "support@omnichannel.io", domain: "retail" },
  { name: "FusionLayer", email: "dev@fusionlayer.com", domain: "integration" },
  { name: "Atlas Partners", email: "partner@atlaspartners.io", domain: "enterprise" },
  { name: "Cortex Integrations", email: "eng@cortexintegrations.com", domain: "integration" },
  { name: "Titan Distribution", email: "ops@titan-distribution.com", domain: "logistics" },
  { name: "Apex Partner Solutions", email: "help@apexpartners.io", domain: "enterprise" },
  { name: "StrataCloud Systems", email: "admin@stratacloud.com", domain: "cloud" },
  { name: "BridgePoint Technology", email: "dev@bridgepointtech.io", domain: "tech" },
  { name: "CoreVendor Network", email: "support@corevendor.net", domain: "network" },
].map((c, i) => ({ ...c, id: "cust-corally-" + i }));

const CORALLY_TICKETS = [
  ["Salesforce partner sync failing for account hierarchy updates", "CRM Sync", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["HubSpot deal data not reflecting in partner portal dashboard", "CRM Sync", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Partner invite emails not being delivered to new partners", "Partner Onboarding", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Onboarding verification link expiring before partner completes setup", "Partner Onboarding", { recurring: true, daysAgo: 3, priority: "high" }],
  ["OAuth authentication failing for partner API integrations", "API", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["Rate limit exceeded on partner data export endpoint", "API", { recurring: true, daysAgo: 4, priority: "high" }],
  ["Contract renewal auto-approved without VP-level sign-off", "Contract", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Partner tier upgrade not reflected in billing system", "Contract", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Revenue dashboard showing incorrect MRR figures for partner referrals", "Billing", { recurring: true, daysAgo: 5, priority: "high" }],
  ["Partner commission calculation error in quarterly report", "Billing", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["CRM webhook timeout on partner account update", "CRM Sync", { daysAgo: 6, priority: "high" }],
  ["Bulk partner import job failed mid-process", "Partner Onboarding", { daysAgo: 7, priority: "high" }],
  ["API response payload missing expected fields for partner profile", "API", { daysAgo: 8 }],
  ["Invoice double-charged for enterprise plan upgrade", "Billing", { daysAgo: 9, priority: "high" }],
  ["Custom integration webhook not firing on deal close event", "API", { daysAgo: 10 }],
  ["New partner user unable to access shared dashboard", "User Access", { daysAgo: 11 }],
  ["SSO login redirect loop for enterprise partner users", "User Access", { daysAgo: 12, priority: "high" }],
  ["Enterprise invoice amount does not match agreed contract terms", "Contract", { daysAgo: 13, priority: "high" }],
  ["Monthly subscription overcharged for inactive partner seats", "Billing", { daysAgo: 14 }],
  ["Credit note not applied correctly to partner account", "Billing", { daysAgo: 15 }],
  ["Payment processing fee discrepancy in partner settlement report", "Billing", { daysAgo: 16 }],
  ["Partner admin unable to reset password via self-service", "User Access", { daysAgo: 17 }],
  ["API key access revoked incorrectly during account maintenance", "API", { daysAgo: 18, priority: "urgent" }],
  ["Partner portal session timeout too short for data entry", "User Access", { daysAgo: 19 }],
  ["Automated partner onboarding checklist and tracking", "Feature Request", { daysAgo: 20 }],
  ["Multi-currency billing support for international partners", "Feature Request", { daysAgo: 21 }],
  ["Partner referral attribution API endpoint", "Feature Request", { daysAgo: 22 }],
  ["Custom pricing tier configuration per partner", "Feature Request", { daysAgo: 23 }],
  ["Partner API documentation missing rate limit headers", "Documentation", { daysAgo: 24 }],
  ["SSO integration guide outdated for Azure AD", "Documentation", { daysAgo: 25 }],
  ["Duplicate partner records created after CRM sync operation", "Product Bug", { daysAgo: 26, priority: "high" }],
  ["Partner portal search not returning results for active partners", "Product Bug", { daysAgo: 27 }],
  ["Email template for partner welcome contains broken links", "Product Bug", { daysAgo: 28 }],
  ["Partner lifecycle stage transition not triggering automation rules", "Product Bug", { daysAgo: 29, priority: "high" }],
  ["CRM sync conflict resolution creating duplicate contacts", "CRM Sync", { recurring: true, daysAgo: 6, priority: "high" }],
  ["Partner program tier benefits not applying after upgrade", "Partner Onboarding", { recurring: true, daysAgo: 7 }],
  ["Invoice generation failing for partners with multi-entity accounts", "Billing", { recurring: true, daysAgo: 8, priority: "high" }],
  ["Partner API webhook signature verification timeout", "API", { recurring: true, daysAgo: 9, priority: "high" }],
];


const YESMADAM_CUSTOMERS = [
  { name: "Priya Sharma", email: "priya.sharma@gmail.com", domain: "consumer" },
  { name: "Ananya Reddy", email: "ananya.reddy@yahoo.com", domain: "consumer" },
  { name: "Neha Kapoor", email: "neha.kapoor@outlook.com", domain: "consumer" },
  { name: "Riya Mehta", email: "riya.mehta@gmail.com", domain: "consumer" },
  { name: "Kavita Singh", email: "kavita.singh@icloud.com", domain: "consumer" },
  { name: "Sneha Patel", email: "sneha.patel@hotmail.com", domain: "consumer" },
  { name: "Deepa Nair", email: "deepa.nair@gmail.com", domain: "consumer" },
  { name: "Anjali Deshmukh", email: "anjali.deshmukh@yahoo.com", domain: "consumer" },
  { name: "Pooja Iyer", email: "pooja.iyer@outlook.com", domain: "consumer" },
  { name: "Meera Joshi", email: "meera.joshi@gmail.com", domain: "consumer" },
  { name: "Lakshmi Menon", email: "lakshmi.menon@gmail.com", domain: "consumer" },
  { name: "Shweta Gupta", email: "shweta.gupta@yahoo.com", domain: "consumer" },
  { name: "Divya Kulkarni", email: "divya.kulkarni@outlook.com", domain: "consumer" },
  { name: "Aditi Verma", email: "aditi.verma@gmail.com", domain: "consumer" },
  { name: "Rohini Nair", email: "rohini.nair@icloud.com", domain: "consumer" },
].map((c, i) => ({ ...c, id: "cust-ym-" + i }));

const YESMADAM_TICKETS = [
  ["Beauty package booking not confirming after successful payment", "Booking", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Payment deducted after OTP but booking shows as failed", "Payment", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["UPI payment stuck in processing for over 24 hours", "Payment", { recurring: true, daysAgo: 2, priority: "high" }],
  ["Beautician did not show up for scheduled appointment", "Beautician", { recurring: true, daysAgo: 3, priority: "urgent" }],
  ["Refund for cancelled package pending for over 8 days", "Refund", { recurring: true, daysAgo: 2, priority: "urgent" }],
  ["Refund processed but not reflecting in customer bank account", "Refund", { recurring: true, daysAgo: 4, priority: "high" }],
  ["Wallet balance showing incorrect after UPI top-up", "Wallet", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Wallet amount deducted twice for single booking transaction", "Wallet", { recurring: true, daysAgo: 1, priority: "urgent" }],
  ["Appointment reschedule option greyed out in customer app", "Booking", { recurring: true, daysAgo: 5, priority: "high" }],
  ["Booking auto-cancelled without customer notification", "Cancellation", { recurring: true, daysAgo: 3, priority: "high" }],
  ["Customer charged twice for single beauty package booking", "Payment", { daysAgo: 6, priority: "urgent" }],
  ["Preferred beautician not listed in available time slots", "Beautician", { daysAgo: 7 }],
  ["Partial refund for service downgrade calculated incorrectly", "Refund", { daysAgo: 8, priority: "high" }],
  ["Festive offer discount not applying at checkout", "Booking", { daysAgo: 9, priority: "high" }],
  ["Same-day booking not appearing in beautician schedule", "Booking", { daysAgo: 10 }],
  ["Beauty package activation code not delivered via SMS", "Booking", { daysAgo: 11, priority: "high" }],
  ["Beautician rating and review not posting after completed service", "Beautician", { daysAgo: 12 }],
  ["Subscription charged despite cancellation request", "Cancellation", { daysAgo: 13, priority: "high" }],
  ["Package price changed between selection and checkout", "Booking", { daysAgo: 14, priority: "high" }],
  ["Membership discount not applied to recurring booking", "Wallet", { daysAgo: 15 }],
  ["Gift card balance not applied during payment flow", "Payment", { daysAgo: 16 }],
  ["Unable to login via Google SSO after app update", "Booking", { daysAgo: 17, priority: "high" }],
  ["OTP not received for login on international number", "Booking", { daysAgo: 18 }],
  ["App crashing on launch after latest update", "Product Bug", { daysAgo: 19, priority: "urgent" }],
  ["Schedule recurring weekly beauty service booking", "Feature Request", { daysAgo: 20 }],
  ["Multiple address save for service location", "Feature Request", { daysAgo: 21 }],
  ["In-app chat with beautician before appointment", "Feature Request", { daysAgo: 22 }],
  ["Digital gift card purchase and sharing", "Feature Request", { daysAgo: 23 }],
  ["Cancellation policy unclear on partial refund calculation", "Documentation", { daysAgo: 24 }],
  ["App guide for first-time users missing key features", "Documentation", { daysAgo: 25 }],
  ["App notification preferences not saving correctly", "Product Bug", { daysAgo: 26 }],
  ["Search results not filtering by service category", "Product Bug", { daysAgo: 27 }],
  ["Address auto-detect showing incorrect pin code", "Product Bug", { daysAgo: 28 }],
  ["Booking history page not loading past appointments", "Product Bug", { daysAgo: 29, priority: "high" }],
  ["Cancellation fee waived for loyalty member not applied", "Cancellation", { recurring: true, daysAgo: 6 }],
  ["Wallet cashback not credited after referral completion", "Wallet", { recurring: true, daysAgo: 7 }],
  ["Service completion confirmation not sent after appointment", "Booking", { recurring: true, daysAgo: 8 }],
  ["Beautician availability not reflecting real-time updates", "Beautician", { recurring: true, daysAgo: 9, priority: "high" }],
];


function buildWorkspace(id, name, tagline, description, categories, customers, ticketDefs, signalDefs, incidentDefs, knowledgeDefs, handoffDefs, approvalDefs) {
  const tickets = ticketDefs.map(function(def, i) {
    return buildTicket(def[0], def[1], pick(customers, i), Object.assign({ index: i }, def[2] || {}));
  });

  function signalFromDef(def) {
    var refTickets = def.ticketRefs.map(function(i) { return tickets[i]; });
    var cats = [];
    refTickets.forEach(function(t) { if (cats.indexOf(t.category) < 0) cats.push(t.category); });
    return {
      name: def.name || refTickets[0].title,
      summary: def.summary || ("Pattern detected: " + refTickets.length + " related tickets in " + cats.join(", ")),
      root_cause: def.root_cause || "Systemic issue identified through pattern analysis of related support tickets",
      category: cats[0] || "general",
      priority: def.priority || "high",
      status: def.status || "approved",
      risk_score: def.risk_score || 7.5,
      confidence: def.confidence || 91,
      ticketRefs: def.ticketRefs,
      ticketCount: refTickets.length,
      affectedCustomers: (function(arr) { var u = []; arr.forEach(function(t) { if (u.indexOf(t.customer.name) < 0) u.push(t.customer.name); }); return u; })(refTickets),
      resolution: def.resolution || "",
      symptoms: def.symptoms || refTickets.map(function(t) { return t.title; }),
    };
  }

  function incidentFromDef(def) {
    return {
      title: def.title,
      summary: def.summary,
      severity: def.severity || "high",
      status: def.status || "investigating",
      category: def.category || "general",
      signalRef: def.signalRef,
      affectedCustomerCount: def.affectedCustomerCount || 3,
      rootCause: def.rootCause || "",
      resolution: def.resolution || "",
    };
  }

  var signals = signalDefs.map(signalFromDef);
  var incidents = incidentDefs.map(incidentFromDef);
  var knowledge = knowledgeDefs.map(function(k, i) { var o = Object.assign({}, k); o.id = id + "-knowledge-" + i; return o; });
  var handoffs = handoffDefs.map(function(h, i) { var o = Object.assign({}, h); o.id = id + "-handoff-" + i; return o; });
  var approvals = approvalDefs.map(function(a, i) {
    var t = tickets[a.ticketRef];
    return {
      ticketRef: a.ticketRef,
      ticketTitle: t.title,
      customerName: t.customer.name,
      draftBody: a.draftBody,
      confidence: a.confidence || 85,
      status: a.status || "pending",
      created_at: daysAgo(a.daysAgo || (i + 1)),
      aiModel: a.aiModel || "gpt-4",
    };
  });

  return {
    id: id, name: name, tagline: tagline, description: description, categories: categories,
    customers: customers, tickets: tickets, signals: signals, incidents: incidents,
    knowledge: knowledge, handoffs: handoffs, approvals: approvals,
    expected: { signals: signalDefs.length, incidents: incidentDefs.length, knowledge: knowledgeDefs.length },
  };
}


const DEMO = {};
DEMO.binocs = buildWorkspace(
  "binocs", "Binocs", "Enterprise Portfolio Analytics", "Portfolio management and financial reporting platform for investment firms and asset managers.",
  ["Portfolio Reports","Financial Reports","NAV Calculations","Risk Assessment","Document Review","OCR Processing"],
  BINOCS_CUSTOMERS, BINOCS_TICKETS,
  [
    { ticketRefs: [0,1,2,3,4], name: "Recurring Financial Report Generation Failures", priority: "urgent", risk_score: 9.2, confidence: 96,
      root_cause: "Portfolio aggregation pipeline memory exhaustion due to missing index on holdings table. Report template rendering engine experiencing concurrent session limits.",
      resolution: "Add composite index on holdings table (portfolio_id, date). Increase aggregation pipeline memory limit from 512MB to 2GB. Implement connection pooling for report renderer.",
      symptoms: ["Financial report generation timeout", "IRR calculation returning incorrect values", "PDF generation failing for investor letters", "NAV calculation discrepancies", "Tax lot accounting report stuck"] },
    { ticketRefs: [5,6,7,8], name: "OCR Document Processing Pipeline Degradation", priority: "high", risk_score: 8.5, confidence: 93,
      root_cause: "OCR worker service memory leak in PDF parsing library. Worker pod runs out of memory after processing ~200 pages causing cascading failures.",
      resolution: "Update PDF parsing library to v4.2.1. Implement page-level processing with 50-page memory limits. Add health check alerting for worker pod memory usage.",
      symptoms: ["OCR pipeline unresponsive for batch uploads", "AI risk scoring inconsistent results", "Document review stalled in queue", "Risk assessment showing zero values"] },
    { ticketRefs: [34,9,35,36], name: "Client Portal and LP Reporting Performance Issues", priority: "high", risk_score: 7.8, confidence: 88,
      root_cause: "Client portal backend queries missing pagination limits for LP account data. Statement generation service blocked by shared database connection pool exhaustion.",
      resolution: "Add pagination to all LP-facing API endpoints. Implement read-replica routing for dashboard queries. Separate statement generation queue from real-time API pool.",
      symptoms: ["Dashboard slow for LP users", "Capital call PDF not generating", "Performance attribution showing negative variance", "Account statement generation queued"] },
    { ticketRefs: [32,30,31,33], name: "Portfolio Analytics Calculation Errors", priority: "high", risk_score: 8.0, confidence: 85,
      root_cause: "Market data feed parser using incorrect date format for international exchanges. Valuation model not handling multiple share classes correctly.",
      resolution: "Update market data feed parser to support ISO 8601 date formats across all exchanges. Add multi-class share support to valuation engine. Implement automated reconciliation checks.",
      symptoms: ["ESG scoring returning no data", "CSV export misaligned with special characters", "Stress test simulation crashing on large datasets", "RSU model using incorrect discount rate"] },
  ],
  [
    { title: "Critical Financial Report System Outage", summary: "Recurring financial report generation failures across multiple fund portfolios affecting month-end close", severity: "critical", status: "investigating", category: "Financial Report", signalRef: 0, affectedCustomerCount: 8,
      rootCause: "Portfolio aggregation pipeline memory exhaustion and report renderer concurrent session limits",
      resolution: "Add composite index on holdings table. Increase pipeline memory to 2GB. Implement connection pooling." },
    { title: "OCR Pipeline and Document Processing Degradation", summary: "OCR document processing pipeline consistently failing affecting risk scoring and due diligence workflows", severity: "high", status: "investigating", category: "Document Review", signalRef: 1, affectedCustomerCount: 5,
      rootCause: "Memory leak in PDF parsing library causing OCR worker pod crashes",
      resolution: "Update PDF parsing library. Implement page-level processing limits. Add memory monitoring." },
  ],
  [
    { title: "Financial Report Generation Failure - Diagnosis and Resolution", summary: "Standard operating procedure for resolving financial report generation failures including portfolio aggregation errors and IRR calculation issues.",
      body: "Financial report generation failures at Binocs typically stem from portfolio aggregation pipeline timeouts, stale market data feeds, or report template rendering errors. This article covers diagnosis steps and resolution paths for each failure mode.",
      root_cause: "Portfolio aggregation pipeline memory exhaustion and missing indexes on the holdings table causing query timeouts.",
      resolution: "1. Check aggregation pipeline logs for OOM errors. 2. Verify holdings table indexes. 3. Restart report renderer service. 4. Monitor memory usage during next scheduled run.",
      category: "Financial Report", tags: ["financial-report","aggregation","irr","pdf","portfolio"], confidence: 93, customers_affected: 8, severity: "critical", resolution_time_hours: 4,
      preventive_actions: "Add composite indexes, increase memory limits, implement connection pooling, add memory usage alerts." },
    { title: "OCR Document Processing Pipeline Troubleshooting", summary: "Standard operating procedure for resolving OCR pipeline failures affecting scanned document processing and AI risk scoring.",
      body: "The OCR document processing pipeline at Binocs receives scanned documents and converts them to machine-readable text for AI risk analysis. When the pipeline fails, documents remain in pending OCR status.",
      root_cause: "OCR worker service memory leak in PDF parsing library causing crashes after processing ~200 pages.",
      resolution: "1. Restart OCR worker service. 2. Clear stuck document queue. 3. Upgrade PDF parsing library. 4. Implement page-level processing with 50-page memory limits.",
      category: "Document Review", tags: ["ocr","document-processing","pdf","risk-scoring"], confidence: 90, customers_affected: 5, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Update PDF parsing library, add memory monitoring alerts, implement page-level processing limits." },
    { title: "Client Portal Performance Optimization", summary: "Guide for optimizing LP client portal performance including dashboard loading, document vault access, and statement generation.",
      body: "The investor client portal provides LPs with dashboard views, document vault access, and statement downloads. Performance degradation typically occurs during peak usage periods.",
      root_cause: "Missing pagination on LP-facing queries and shared database connection pool exhaustion.",
      resolution: "Add pagination to all LP API endpoints, implement read-replica routing, separate statement generation from real-time API pool.",
      category: "Client", tags: ["client-portal","lp","dashboard","performance"], confidence: 87, customers_affected: 6, severity: "high", resolution_time_hours: 5,
      preventive_actions: "Implement read-replica routing, add pagination limits, separate async job queues." },
  ],
  [
    { title: "Financial Report Engine Hotfix", description: "Emergency patch for portfolio aggregation pipeline memory leak", priority: "urgent", incidentRef: 0, ticketRefs: [0,1,2,3,4], status: "in_progress", package_name: "binocs-report-engine-v2.4.1",
      engineering_notes: "Root cause identified as unbounded result set in portfolio aggregation query. Memory usage grows linearly with portfolio count. Need to implement cursor-based pagination and streaming aggregation." },
    { title: "OCR Worker Memory Fix", description: "Memory leak remediation in PDF parsing service", priority: "high", incidentRef: 1, ticketRefs: [5,6,7], status: "pending_review", package_name: "binocs-ocr-worker-v3.1.0",
      engineering_notes: "PDF parsing library (pdf-parse v3.2.0) leaks ~2MB per document processed. Upgrade to v4.2.1 which includes the memory fix. Also need to add process-level memory limits via container resource constraints." },
    { title: "LP Portal Performance Enhancement", description: "Query optimization and infrastructure scaling for LP portal", priority: "high", incidentRef: null, ticketRefs: [9,34,35,36], status: "pending", package_name: "binocs-portal-optimization-v1.0",
      engineering_notes: "Implement pagination on all LP-facing GraphQL queries. Add read-replica configuration for dashboard data. Move statement generation to dedicated worker queue with its own connection pool." },
  ],
  [
    { ticketRef: 17, confidence: 92, daysAgo: 2,
      draftBody: "Dear SilverPoint Capital team, Thank you for reaching out about the Q3 management fee invoice. We have reviewed the billing calculation and confirm there was an error in the fee basis used. We are issuing a corrected invoice and credit note for the difference. The updated invoice will be available in the billing portal within 24 hours. We apologize for the inconvenience. Best regards, Alice Chen" },
    { ticketRef: 21, confidence: 88, daysAgo: 3,
      draftBody: "Dear PineBrook Advisory team, We understand you are experiencing difficulties with the MFA enrollment loop after password reset. This issue typically occurs when the authentication session token is not cleared during the reset process. Our engineering team has identified the root cause and is deploying a fix. In the meantime, please try clearing your browser cache and using an incognito window to complete the MFA setup. If the issue persists, we can manually reset your MFA enrollment on our end. Best regards, Bob Martinez" },
    { ticketRef: 30, confidence: 85, daysAgo: 4,
      draftBody: "Dear OakTree Fund Services team, Thank you for reporting the data export CSV alignment issue. We have identified the bug in our CSV generation function where special characters in fund names cause column misalignment. Our engineering team is working on a fix that will properly escape special characters in the output. As a temporary workaround, please avoid using special characters in fund names when possible. We will notify you once the fix is deployed. Best regards, Carol Singh" },
    { ticketRef: 10, confidence: 90, daysAgo: 5,
      draftBody: "Dear Horizon Family Office team, We apologize for the inconvenience with the portfolio company financial upload timing out. This issue is related to a known limitation with Excel files exceeding 50MB in size. Please try splitting your upload into smaller batches of 25MB each. We are working on increasing the upload limit to 200MB which will resolve this issue permanently. Best regards, Dave Kim" },
  ]
);


DEMO.zap = buildWorkspace(
  "zap", "Zapdata", "Hyperlocal Commerce & Delivery CDP", "Customer data platform powering hyperlocal commerce, delivery logistics, and real-time personalization.",
  ["CRM Sync","API","Webhook","Data Import","Analytics","Integrations"],
  ZAP_CUSTOMERS, ZAP_TICKETS,
  [
    { ticketRefs: [0,1,34,35], name: "CRM Data Synchronization Failures", priority: "high", risk_score: 8.2, confidence: 92,
      root_cause: "CRM sync worker encountering deadlock on concurrent contact record updates. The merge tool creates duplicate records when profiles are updated simultaneously from multiple sources.",
      resolution: "Implement distributed locking for contact record operations. Add deduplication pipeline with configurable merge rules. Increase sync worker pool size from 3 to 8.",
      symptoms: ["CRM contact sync delayed by over 45 minutes", "Customer profile merge tool producing duplicates", "CRM deal stage change not triggering webhook", "Data export API response degraded"] },
    { ticketRefs: [2,3,6,37], name: "API Performance and Rate Limiting Degradation", priority: "urgent", risk_score: 8.8, confidence: 94,
      root_cause: "Rate limiter config using fixed window instead of sliding window algorithm causing burst traffic to exhaust quota prematurely. Event stream processor has insufficient consumer capacity.",
      resolution: "Switch rate limiter to sliding window algorithm. Increase event stream consumer count from 5 to 15. Add auto-scaling trigger at 70% consumer utilization.",
      symptoms: ["REST API returning inconsistent pagination", "API rate limit exceeded during peak hours", "Event stream processing lag over 30 minutes", "Data export API response time degraded"] },
    { ticketRefs: [4,5,10,11], name: "Webhook Delivery Reliability Issues", priority: "urgent", risk_score: 8.5, confidence: 91,
      root_cause: "Webhook delivery queue using in-memory buffer that loses events during pod restarts. Signature validation fails due to clock drift on some worker nodes.",
      resolution: "Switch webhook queue to persistent storage (Redis streams). Implement NTP synchronization across all worker nodes. Add webhook retry with exponential backoff and dead-letter queue.",
      symptoms: ["Webhook signature validation failing intermittently", "Duplicate webhook events sent", "Historical data backfill failed at 73%", "Webhook retry not honoring exponential backoff"] },
    { ticketRefs: [7,8,9,15], name: "Data Pipeline and Analytics Processing Delays", priority: "high", risk_score: 7.5, confidence: 86,
      root_cause: "Data import queue backlog due to insufficient worker capacity during peak ingestion hours. Analytics materialized view refresh schedule conflicts with import window.",
      resolution: "Add auto-scaling for import workers based on queue depth. Reschedule analytics view refresh to off-peak hours. Implement incremental materialized view refresh instead of full refresh.",
      symptoms: ["Customer data import stuck in queued state", "Analytics dashboard showing stale data", "Segmentation query timing out on large datasets", "Segment membership not updating on profile changes"] },
  ],
  [
    { title: "CRM Sync and Data Integrity Incident", summary: "Recurring CRM synchronization failures causing duplicate records and data inconsistency across integrated systems", severity: "high", status: "investigating", category: "CRM", signalRef: 0, affectedCustomerCount: 6,
      rootCause: "CRM sync worker deadlock on concurrent contact updates and merge tool race conditions",
      resolution: "Implement distributed locking, add deduplication pipeline, increase sync worker pool." },
    { title: "Webhook Delivery Infrastructure Failure", summary: "Webhook delivery system experiencing reliability issues with missed events and signature validation failures", severity: "high", status: "investigating", category: "Webhook", signalRef: 2, affectedCustomerCount: 4,
      rootCause: "In-memory webhook queue losing events during pod restarts and NTP clock drift on worker nodes",
      resolution: "Switch to persistent Redis stream queue. Implement NTP sync. Add dead-letter queue." },
  ],
  [
    { title: "CRM Sync Failure Resolution Guide", summary: "Step-by-step guide for diagnosing and resolving CRM synchronization issues including duplicate records and sync delays.",
      body: "CRM synchronization failures typically manifest as delayed contact updates, duplicate records, or stalled sync jobs. This guide covers diagnosis and resolution for each failure mode.",
      root_cause: "Concurrent contact record updates causing database deadlocks. Sync worker pool insufficient for peak load.",
      resolution: "1. Identify deadlocked sync worker processes. 2. Clear stuck sync queue. 3. Restart sync workers with increased pool size. 4. Run deduplication pipeline.",
      category: "CRM", tags: ["crm","sync","dedup","integration"], confidence: 91, customers_affected: 6, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Implement distributed locking, increase worker pool, add sync monitoring alerts." },
    { title: "Webhook Infrastructure Best Practices", summary: "Configuration guide for reliable webhook delivery including retry policies, signature validation, and monitoring.",
      body: "Reliable webhook delivery depends on proper configuration of retry mechanisms, signature validation, and endpoint availability monitoring.",
      root_cause: "In-memory delivery queue and clock drift causing event loss and validation failures.",
      resolution: "1. Switch to persistent webhook queue. 2. Implement NTP synchronization. 3. Configure exponential backoff retry. 4. Set up webhook health monitoring.",
      category: "Webhook", tags: ["webhook","delivery","retry","signature"], confidence: 88, customers_affected: 4, severity: "high", resolution_time_hours: 4,
      preventive_actions: "Use persistent queue, implement NTP sync, add dead-letter queue for failed deliveries." },
    { title: "Data Import Pipeline Optimization", summary: "Best practices for optimizing data import pipeline performance and reliability.",
      body: "Data import jobs can fail or stall due to various reasons including malformed records, insufficient worker capacity, or S3 access issues.",
      root_cause: "Import worker capacity insufficient for peak ingestion periods and analytics view refresh conflicts.",
      resolution: "1. Add auto-scaling for import workers. 2. Reschedule analytics refresh to off-peak. 3. Implement incremental view refresh.",
      category: "Data Import", tags: ["import","data-pipeline","s3","etl"], confidence: 85, customers_affected: 5, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Enable auto-scaling, schedule maintenance windows, monitor queue depth." },
  ],
  [
    { title: "CRM Sync Performance Hotfix", description: "Distributed locking implementation for CRM contact record operations", priority: "high", incidentRef: 0, ticketRefs: [0,1,34], status: "in_progress", package_name: "zap-crm-sync-v4.2.0",
      engineering_notes: "Implement Redis-based distributed locks for contact record operations. Add deadlock detection with automatic retry. Need to handle lock expiry and cleanup for stuck transactions." },
    { title: "Webhook Queue Migration", description: "Migrate webhook delivery from in-memory to Redis stream-backed persistent queue", priority: "urgent", incidentRef: 1, ticketRefs: [4,5], status: "pending_review", package_name: "zap-webhook-queue-v2.0",
      engineering_notes: "Replace in-memory ConcurrentLinkedQueue with Redis Streams. Implement consumer groups for parallel processing. Add dead-letter stream for failed deliveries after max retries." },
    { title: "Rate Limiter Algorithm Update", description: "Switch from fixed window to sliding window rate limiting", priority: "high", incidentRef: null, ticketRefs: [2,3,37], status: "pending", package_name: "zap-rate-limiter-v3.1",
      engineering_notes: "Implement sliding window log algorithm using Redis sorted sets. Add per-endpoint rate limit configuration. Need to handle clock synchronization across API gateway nodes." },
  ],
  [
    { ticketRef: 17, confidence: 91, daysAgo: 2,
      draftBody: "Dear RetailMax Inc, Thank you for bringing the API usage tier invoice discrepancy to our attention. We have reviewed your account and confirmed that the overage charges were calculated incorrectly due to a billing system error. We are issuing a credit for the overcharge amount and the corrected invoice will be available within 24 hours. We apologize for the inconvenience. Best regards, Alice Chen" },
    { ticketRef: 21, confidence: 87, daysAgo: 3,
      draftBody: "Dear DataDriven Co, Regarding the SSO login issue with Okta integration, our engineering team has identified a configuration mismatch following the recent identity provider update. We have corrected the SAML assertion settings and you should now be able to log in successfully. Please clear your browser cache and try again. If the issue persists, please contact our support team directly. Best regards, Bob Martinez" },
    { ticketRef: 30, confidence: 84, daysAgo: 4,
      draftBody: "Dear SegmentFlow, Thank you for reporting the negative conversion values in the attribution report. Our data team has verified this is a calculation bug where refunded orders are being double-counted in the attribution model. We are deploying a fix that corrects the refund handling logic. The attribution reports will be recalculated after the fix is applied. Best regards, Carol Singh" },
  ]
);


DEMO.foxo = buildWorkspace(
  "foxo", "Foxo", "Healthcare Operations Platform", "Healthcare operations platform managing appointments, prescriptions, lab reports, and patient records for hospitals and clinics.",
  ["Appointment Scheduling","Prescription Mgmt","Lab Reports","Patient Records","Insurance","Telehealth"],
  FOXO_CUSTOMERS, FOXO_TICKETS,
  [
    { ticketRefs: [0,1,8,34], name: "Appointment Booking and Scheduling System Failures", priority: "urgent", risk_score: 9.0, confidence: 95,
      root_cause: "Appointment booking confirmation service disconnected from payment gateway callback. Slot availability cache not invalidating after bookings causing double-booking. OR scheduling module not receiving availability updates from surgery center system.",
      resolution: "Reconnect booking confirmation webhook to payment gateway. Implement real-time slot cache invalidation. Add integration adapter for surgery center scheduling API.",
      symptoms: ["Booking fails after successful payment", "Double-booking in cardiology", "Automated reminders not sending SMS", "Surgery schedule conflicts"] },
    { ticketRefs: [2,3,35], name: "E-Prescription Routing Failures", priority: "urgent", risk_score: 8.7, confidence: 93,
      root_cause: "Pharmacy directory service returning stale NCPDP IDs causing routing failures. Prescription renewal queue processor crashes on malformed renewal request payloads.",
      resolution: "Implement daily pharmacy directory sync with NCPDP master database. Add payload validation before renewal queue processing. Implement dead-letter queue for malformed requests.",
      symptoms: ["E-prescription not loading in pharmacy systems", "Prescription renewal not reaching doctor inbox", "Medication reconciliation not pulling pharmacy history"] },
    { ticketRefs: [4,5,36,9], name: "Lab Results and Diagnostic Processing Pipeline", priority: "high", risk_score: 8.3, confidence: 90,
      root_cause: "Lab result alerting service not triggered when result values exceed critical thresholds. Reference lab HL7 feed parser fails on new message format version. Insurance verification service certificate expired.",
      resolution: "Fix critical value threshold comparator logic in alerting service. Update HL7 parser to support version 2.6 message format. Renew insurance verification service SSL certificate.",
      symptoms: ["Critical lab result alert not triggering", "Quest Diagnostics auto-import stalled", "Lab reference ranges not updating for new assays", "Insurance eligibility verification timing out"] },
    { ticketRefs: [6,7,10,11], name: "Patient Record Data Integrity Issues", priority: "high", risk_score: 7.9, confidence: 87,
      root_cause: "Patient merge tool not handling HL7 segment identifiers correctly causing duplicated records. PHI export encryption key rotation not triggering automated re-encryption. Date parsing library fails on non-US date formats in lab uploads.",
      resolution: "Fix merge tool to match on enterprise patient identifier instead of demographic fields. Implement automated key rotation for PHI export. Update date parser to support multiple locale formats.",
      symptoms: ["Demographics update not persisting", "PHI data export failing for audit", "Patient profile showing duplicates after merge", "Lab report PDF upload date parsing error"] },
  ],
  [
    { title: "Appointment Booking System Critical Outage", summary: "Recurring appointment booking failures affecting patient registration and payment confirmation workflows across multiple departments", severity: "critical", status: "investigating", category: "Appointment", signalRef: 0, affectedCustomerCount: 7,
      rootCause: "Booking confirmation service disconnected from payment gateway. Slot cache not invalidating. OR scheduling integration broken.",
      resolution: "Reconnect payment webhook. Implement real-time cache invalidation. Add surgery center integration adapter." },
    { title: "Lab Results Processing Pipeline Failure", summary: "Lab result alerting and auto-import system failures affecting critical patient care workflows", severity: "high", status: "investigating", category: "Lab Reports", signalRef: 2, affectedCustomerCount: 4,
      rootCause: "Critical value threshold comparator logic error and HL7 feed parser incompatibility with new message format.",
      resolution: "Fix threshold comparator. Update HL7 parser to v2.6. Renew insurance SSL certificate." },
  ],
  [
    { title: "Appointment Booking Failure - Diagnosis and Resolution", summary: "Standard operating procedure for resolving appointment booking failures including payment confirmation issues and slot double-booking.",
      body: "Appointment booking failures at Foxo typically manifest as payment confirmed but booking not created, double-booked slots, or missing confirmation notifications.",
      root_cause: "Booking confirmation webhook disconnected from payment gateway. Slot cache invalidation not triggered after successful booking.",
      resolution: "1. Verify payment gateway webhook connectivity. 2. Clear slot cache. 3. Check booking confirmation queue. 4. Verify notification service. 5. Test with test patient account.",
      category: "Appointment", tags: ["booking","appointment","payment","scheduling"], confidence: 94, customers_affected: 7, severity: "critical", resolution_time_hours: 3,
      preventive_actions: "Monitor payment webhook health, implement slot cache monitoring, add booking confirmation alerts." },
    { title: "E-Prescription Troubleshooting Guide", summary: "Diagnosis guide for e-prescription delivery failures including pharmacy routing issues and renewal processing problems.",
      body: "E-prescription failures occur when prescriptions cannot be routed to patient pharmacy or renewal requests are not delivered to provider inboxes.",
      root_cause: "Stale pharmacy directory NCPDP IDs and malformed renewal request payloads crashing the processor.",
      resolution: "1. Check pharmacy directory sync status. 2. Verify NCPDP IDs for target pharmacies. 3. Clear and restart renewal queue. 4. Review dead-letter queue for malformed requests.",
      category: "Prescription", tags: ["prescription","pharmacy","eprescription","routing"], confidence: 91, customers_affected: 5, severity: "urgent", resolution_time_hours: 2,
      preventive_actions: "Daily pharmacy directory sync, payload validation before queue processing, dead-letter queue monitoring." },
    { title: "Lab Result Processing and Alerting SOP", summary: "Standard operating procedure for lab result processing pipeline failures including critical value alerts and reference lab imports.",
      body: "The lab result processing pipeline handles incoming results from reference labs, evaluates them against critical thresholds, and triggers appropriate alerts.",
      root_cause: "Critical value threshold comparator logic error and HL7 feed parser incompatibility with updated message format.",
      resolution: "1. Restart lab processing service. 2. Verify HL7 feed connection. 3. Check critical threshold configuration. 4. Process stuck lab results manually. 5. Verify alert delivery.",
      category: "Lab Reports", tags: ["lab","results","hl7","critical-values"], confidence: 89, customers_affected: 4, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Update HL7 parser, validate threshold comparator regularly, monitor feed health." },
  ],
  [
    { title: "Appointment Booking Webhook Fix", description: "Reconnect booking confirmation service to payment gateway callback", priority: "urgent", incidentRef: 0, ticketRefs: [0,1], status: "in_progress", package_name: "foxo-booking-webhook-v2.1",
      engineering_notes: "Payment gateway changed callback URL format in their latest API version. Need to update webhook endpoint configuration and add retry logic with idempotency keys. Also need to add webhook health monitoring." },
    { title: "E-Prescription Directory Sync", description: "Fix pharmacy directory sync and renewal queue processing", priority: "urgent", incidentRef: null, ticketRefs: [2,3,35], status: "pending_review", package_name: "foxo-pharmacy-sync-v1.5",
      engineering_notes: "Pharmacy directory sync job failing due to API rate limiting from NCPDP. Need to implement incremental sync instead of full sync. Add exponential backoff for API calls. Fix renewal request payload validation." },
    { title: "Lab HL7 Parser Update", description: "Update HL7 message parser for lab results to support version 2.6 format", priority: "high", incidentRef: 1, ticketRefs: [4,5,36], status: "pending", package_name: "foxo-hl7-parser-v3.0",
      engineering_notes: "Reference lab migrated to HL7 v2.6 which changed field positions in ORU_R01 messages. Need to update parser to detect message version and apply correct parsing rules. Add schema validation before processing." },
  ],
  [
    { ticketRef: 17, confidence: 93, daysAgo: 2,
      draftBody: "Dear City General Hospital, Thank you for reporting the CMS-1500 claim submission rejection. Our billing team has reviewed the error logs and identified that the formatting issue is caused by an updated clearinghouse requirement for the provider taxonomy code field. We have updated our claim formatting logic and the pending claims will be resubmitted automatically within the next hour. Best regards, Alice Chen" },
    { ticketRef: 21, confidence: 89, daysAgo: 3,
      draftBody: "Dear HealthFirst Medical, Regarding the physician access issue after credential update, our security team has confirmed that the credential update triggered an identity verification flag that temporarily suspended the account. We have resolved the flag and the physician should now be able to access patient records. Please ask them to log out and log back in to refresh their session. Best regards, Bob Martinez" },
    { ticketRef: 30, confidence: 86, daysAgo: 4,
      draftBody: "Dear City General Hospital, We apologize for the HL7 message feed delay. Our infrastructure team has identified that the HL7 connection to the reference lab was interrupted due to a certificate expiration on the secure channel. We have renewed the certificate and the connection has been restored. The delayed lab results are now being processed and should appear within the next hour. Best regards, Carol Singh" },
  ]
);


DEMO.corally = buildWorkspace(
  "corally", "Corally", "Partner Ecosystem Management", "Partner ecosystem management platform handling CRM sync, onboarding, contracts, billing, and API integrations.",
  ["CRM Sync","Partner Onboarding","API","Billing","Contracts","User Access"],
  CORALLY_CUSTOMERS, CORALLY_TICKETS,
  [
    { ticketRefs: [0,1,10,34], name: "CRM Partner Data Synchronization Failures", priority: "urgent", risk_score: 8.9, confidence: 94,
      root_cause: "Salesforce API version upgrade changed account hierarchy field mappings. Partner portal cache invalidation not triggered after HubSpot deal updates. Concurrent sync operations causing deadlock on partner contact table.",
      resolution: "Update Salesforce field mappings for API v58.0. Implement real-time cache invalidation for partner portal. Add distributed locking for partner contact operations.",
      symptoms: ["Salesforce partner sync failing for account hierarchy", "HubSpot deals not reflecting in partner portal", "CRM webhook timeout on account update", "Sync conflict creating duplicate contacts"] },
    { ticketRefs: [2,3,11,35], name: "Partner Onboarding Workflow Stalls", priority: "urgent", risk_score: 8.6, confidence: 92,
      root_cause: "Email delivery service rate-limited by partner domains. Verification token expiry window too short for multi-step onboarding. Bulk import processor crashes on partners with missing required fields.",
      resolution: "Implement email delivery retry with domain-specific rate limiting. Extend verification token expiry from 24 to 72 hours. Add pre-import validation for required partner fields.",
      symptoms: ["Partner invite emails not delivered", "Verification link expiring prematurely", "Bulk partner import failed mid-process", "Tier benefits not applying after upgrade"] },
    { ticketRefs: [4,5,12,37], name: "API Authentication and Integration Failures", priority: "urgent", risk_score: 8.4, confidence: 91,
      root_cause: "OAuth token refresh endpoint returning stale JWTs due to clock skew across auth servers. API rate limiter not distinguishing between partner tiers causing unfair throttling.",
      resolution: "Implement token refresh with grace period for clock skew. Update rate limiter to apply per-tier limits. Add OAuth health monitoring dashboard.",
      symptoms: ["OAuth authentication failing for partner API", "Rate limit exceeded on data export", "API response missing expected fields", "Webhook signature verification timeout"] },
    { ticketRefs: [6,7,8,9,36], name: "Billing and Contract Management Discrepancies", priority: "high", risk_score: 8.1, confidence: 88,
      root_cause: "Contract auto-approval workflow missing escalation step for VP-level approvals. Billing system using stale contract terms due to synchronization delay. Partner commission calculation formula incorrect for tiered structures.",
      resolution: "Add conditional approval routing for contracts above threshold. Implement real-time billing sync with contract lifecycle. Fix commission formula to handle tiered rate structures correctly.",
      symptoms: ["Contract renewal auto-approved without VP sign-off", "Tier upgrade not reflected in billing", "MRR figures incorrect for partner referrals", "Commission calculation error in Q3", "Invoice generation failing for multi-entity accounts"] },
  ],
  [
    { title: "CRM Partner Sync System Incident", summary: "Recurring CRM synchronization failures causing partner data inconsistency across Salesforce, HubSpot, and partner portal", severity: "high", status: "investigating", category: "CRM Sync", signalRef: 0, affectedCustomerCount: 6,
      rootCause: "Salesforce API field mapping changes and cache invalidation failures",
      resolution: "Update Salesforce field mappings. Implement real-time cache invalidation. Add distributed locking." },
    { title: "Partner Onboarding Pipeline Failure", summary: "Partner onboarding workflow consistently failing at email delivery and verification steps", severity: "high", status: "investigating", category: "Partner Onboarding", signalRef: 1, affectedCustomerCount: 5,
      rootCause: "Email delivery rate limiting and verification token expiry too short",
      resolution: "Implement domain-specific rate limiting. Extend token expiry. Add pre-import validation." },
  ],
  [
    { title: "CRM Partner Sync Troubleshooting Guide", summary: "Diagnosis and resolution guide for CRM partner data synchronization failures across integrated platforms.",
      body: "CRM synchronization failures cause partner data inconsistency across Salesforce, HubSpot, and the partner portal. This guide covers diagnosis steps and resolution procedures.",
      root_cause: "Salesforce API field mapping changes and missing cache invalidation after partner updates.",
      resolution: "1. Check Salesforce API version compatibility. 2. Verify field mappings. 3. Clear partner portal cache. 4. Restart sync workers. 5. Run data reconciliation.",
      category: "CRM Sync", tags: ["crm","sync","salesforce","hubspot","integration"], confidence: 93, customers_affected: 6, severity: "high", resolution_time_hours: 4,
      preventive_actions: "Monitor Salesforce API changes, implement cache invalidation tests, add sync health dashboard." },
    { title: "Partner Onboarding Workflow Optimization", summary: "Best practices for configuring and troubleshooting the partner onboarding workflow.",
      body: "Partner onboarding involves email invitations, verification, profile completion, and tier assignment. Workflow stalls can occur at any of these stages.",
      root_cause: "Email delivery rate limiting and insufficient verification token expiry window.",
      resolution: "1. Check email delivery logs for rate limiting. 2. Extend verification token expiry. 3. Process stuck onboarding items. 4. Verify onboarding email templates.",
      category: "Partner Onboarding", tags: ["onboarding","partner","email","verification"], confidence: 90, customers_affected: 5, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Monitor email delivery rates, extend token expiry, add onboarding progress tracking." },
    { title: "Billing and Contract Management Best Practices", summary: "Guide for managing partner billing cycles, contract renewals, and commission calculations.",
      body: "Partner billing involves tier-based pricing, commission calculations, and contract lifecycle management. Discrepancies can arise from synchronization delays or incorrect formula configurations.",
      root_cause: "Contract auto-approval missing escalation step and billing sync delay with contract lifecycle.",
      resolution: "1. Review contract approval workflow configuration. 2. Verify billing sync with contract terms. 3. Audit commission calculations. 4. Correct billing discrepancies. 5. Re-run commission reports.",
      category: "Billing", tags: ["billing","contract","commission","mrr","revenue"], confidence: 87, customers_affected: 5, severity: "high", resolution_time_hours: 5,
      preventive_actions: "Add VP approval routing, implement real-time billing sync, audit commission calculations monthly." },
  ],
  [
    { title: "Salesforce API Migration Patch", description: "Update Salesforce field mappings for API v58.0 compatibility", priority: "urgent", incidentRef: 0, ticketRefs: [0,1], status: "in_progress", package_name: "corally-salesforce-connector-v3.2",
      engineering_notes: "Salesforce Summer 25 API update changed Account object field paths for partner hierarchy. Need to update field mapping configuration and add API version compatibility tests. Implement feature flag for gradual rollout." },
    { title: "Email Delivery Rate Limiting Fix", description: "Implement domain-specific rate limiting for partner invitation emails", priority: "high", incidentRef: 1, ticketRefs: [2,3], status: "pending_review", package_name: "corally-email-service-v2.0",
      engineering_notes: "Implement per-domain rate limiting using token bucket algorithm. Add delivery status tracking with webhook callbacks. Configure retry with exponential backoff per domain. Need to update email template rendering for partner onboarding." },
    { title: "OAuth Token Refresh Enhancement", description: "Fix OAuth token refresh clock skew issue across auth servers", priority: "urgent", incidentRef: null, ticketRefs: [4,5,37], status: "pending", package_name: "corally-auth-service-v1.8",
      engineering_notes: "Add grace period of 30 seconds for token validation to handle clock skew. Implement distributed timestamp synchronization across auth server cluster. Add token refresh audit logging." },
  ],
  [
    { ticketRef: 17, confidence: 92, daysAgo: 2,
      draftBody: "Dear Acme Partners, We have reviewed the enterprise invoice discrepancy and confirmed that the billing amount does not match the agreed contract terms. This was caused by a system error during the contract renewal process where the pricing tier was not correctly applied. We are issuing a corrected invoice and credit for the difference. The amount will be reflected in your next billing cycle. Best regards, Alice Chen" },
    { ticketRef: 22, confidence: 88, daysAgo: 3,
      draftBody: "Dear FusionLayer, We apologize for the API key access revocation issue. Our audit shows that the key was revoked in error during a routine account maintenance operation. We have restored your API key access and are implementing additional safeguards to prevent similar incidents. Your new API key has been regenerated for security purposes and is available in the partner portal. Best regards, Bob Martinez" },
    { ticketRef: 30, confidence: 85, daysAgo: 4,
      draftBody: "Dear NexusConnect Inc, Thank you for reporting the duplicate partner records issue. Our data team has confirmed that this was caused by a CRM sync operation that created new records instead of matching existing ones. We have merged the duplicate records and are running a full data reconciliation to ensure data integrity. The partner portal should now reflect the correct information. Best regards, Carol Singh" },
  ]
);


DEMO.yesmadam = buildWorkspace(
  "yesmadam", "YesMadam", "Home Services & Beauty Platform", "Home services platform connecting customers with beauty, wellness, and grooming professionals.",
  ["Booking","Payment","Refund","Wallet","Beautician","Cancellation"],
  YESMADAM_CUSTOMERS, YESMADAM_TICKETS,
  [
    { ticketRefs: [0,1,2,10], name: "Payment Processing and Booking Confirmation Failures", priority: "urgent", risk_score: 9.1, confidence: 96,
      root_cause: "Payment gateway callback handling race condition where booking creation fails after payment success. UPI transaction status check polling interval too long causing delayed confirmation. Duplicate charge protection not triggering on retry attempts.",
      resolution: "Implement idempotency keys for payment callbacks. Reduce UPI status polling interval from 30s to 5s. Add duplicate transaction detection before processing payments.",
      symptoms: ["Booking not confirming after payment", "Payment deducted but booking shows failed", "UPI payment stuck for over 24 hours", "Customer charged twice for single booking"] },
    { ticketRefs: [3,11,37], name: "Beautician Scheduling and Availability Issues", priority: "high", risk_score: 8.2, confidence: 91,
      root_cause: "Beautician schedule sync not updating in real-time from provider mobile app. Availability calendar cache TTL too long causing stale slot data. Notification service failing to deliver assignment alerts to beautician app.",
      resolution: "Implement real-time schedule sync via WebSocket. Reduce availability cache TTL from 15min to 1min. Fix push notification delivery for beautician assignment alerts.",
      symptoms: ["Beautician did not show up for appointment", "Preferred beautician not listed", "Beautician availability not reflecting real-time updates"] },
    { ticketRefs: [4,5,12], name: "Refund Processing Pipeline Delays", priority: "urgent", risk_score: 8.5, confidence: 93,
      root_cause: "Refund batch processor queue backlog due to insufficient worker capacity during promotional periods. Bank transfer reconciliation job failing on certain IFSC codes. Partial refund calculation logic incorrect for tiered service packages.",
      resolution: "Add auto-scaling for refund workers based on queue depth. Update bank IFSC code database. Fix partial refund calculation to handle package component pricing correctly.",
      symptoms: ["Refund pending for over 8 days", "Refund processed but not reflecting in bank", "Partial refund calculated incorrectly", "Membership discount not applied"] },
    { ticketRefs: [6,7,35,18], name: "Wallet and Payment Balance Synchronization Issues", priority: "high", risk_score: 8.0, confidence: 87,
      root_cause: "Wallet transaction idempotency key collision causing duplicate deductions. UPI gateway callback replay causing double wallet credit. Wallet balance cache not invalidated after successful transactions.",
      resolution: "Fix idempotency key generation to include unique transaction reference. Implement deduplication for UPI gateway callbacks. Invalidate wallet cache on every balance-changing transaction.",
      symptoms: ["Wallet balance incorrect after UPI top-up", "Wallet deducted twice for single booking", "Wallet cashback not credited", "Package price changed between selection and checkout"] },
  ],
  [
    { title: "Payment Gateway Integration Incident", summary: "Recurring payment processing failures causing booking confirmation failures and duplicate charges", severity: "critical", status: "investigating", category: "Payment", signalRef: 0, affectedCustomerCount: 9,
      rootCause: "Payment callback race condition and UPI status polling interval too long",
      resolution: "Implement idempotency keys. Reduce UPI polling interval. Add duplicate detection." },
    { title: "Refund Processing Pipeline Backlog", summary: "Refund processing pipeline experiencing significant delays exceeding SLA commitments", severity: "high", status: "investigating", category: "Refund", signalRef: 2, affectedCustomerCount: 6,
      rootCause: "Refund worker capacity insufficient and bank IFSC reconciliation failures",
      resolution: "Add auto-scaling for refund workers. Update IFSC database. Fix partial refund calculation." },
  ],
  [
    { title: "Payment Booking Failure Resolution Guide", summary: "Step-by-step guide for resolving payment and booking confirmation failures including UPI issues and duplicate charges.",
      body: "Payment-related booking failures are the most common issue type on YesMadam. This guide covers diagnosis and resolution for various payment failure scenarios.",
      root_cause: "Payment gateway callback race condition and insufficient UPI status polling frequency.",
      resolution: "1. Check payment gateway transaction logs. 2. Verify booking creation callback. 3. Check for duplicate transactions. 4. Process stuck UPI payments manually. 5. Confirm booking status with customer.",
      category: "Payment", tags: ["payment","booking","upi","refund","transaction"], confidence: 95, customers_affected: 9, severity: "critical", resolution_time_hours: 2,
      preventive_actions: "Implement idempotency keys, reduce polling interval, add duplicate detection." },
    { title: "Refund Processing SOP", summary: "Standard operating procedure for processing refund requests and troubleshooting refund delays.",
      body: "Refund requests should be processed within 5-7 business days per policy. Delays can occur due to payment processor issues or incorrect bank details.",
      root_cause: "Refund worker capacity insufficient for volume and bank IFSC code database outdated.",
      resolution: "1. Check refund queue status. 2. Verify customer bank details. 3. Process refund manually if stuck. 4. Confirm refund status with payment gateway. 5. Notify customer of expected timeline.",
      category: "Refund", tags: ["refund","cancellation","payment","bank"], confidence: 91, customers_affected: 6, severity: "high", resolution_time_hours: 3,
      preventive_actions: "Add auto-scaling for refund workers, update IFSC database, add refund queue monitoring." },
    { title: "Wallet Balance Troubleshooting", summary: "Guide for diagnosing and resolving wallet balance discrepancies including missing credits and duplicate deductions.",
      body: "Wallet balance issues can result from transaction processing failures, callback replays, or cache invalidation problems.",
      root_cause: "Idempotency key collision and UPI gateway callback replay causing incorrect wallet balances.",
      resolution: "1. Review wallet transaction log. 2. Check for duplicate transactions. 3. Reconcile wallet balance. 4. Adjust balance if needed. 5. Clear wallet cache. 6. Verify balance with customer.",
      category: "Wallet", tags: ["wallet","balance","payment","upi","credit"], confidence: 87, customers_affected: 5, severity: "high", resolution_time_hours: 2,
      preventive_actions: "Fix idempotency key generation, implement callback deduplication, invalidate cache on balance changes." },
  ],
  [
    { title: "Payment Gateway Idempotency Fix", description: "Implement idempotency keys for payment callbacks to prevent race conditions", priority: "urgent", incidentRef: 0, ticketRefs: [0,1], status: "in_progress", package_name: "ym-payment-gateway-v3.0",
      engineering_notes: "Implement idempotency using payment gateway transaction ID + timestamp hash. Add lock on booking creation during callback processing. Implement retry with idempotency check for failed callbacks." },
    { title: "Refund Worker Auto-Scaling", description: "Add auto-scaling for refund batch processor workers", priority: "high", incidentRef: 1, ticketRefs: [4,5], status: "pending_review", package_name: "ym-refund-worker-v2.1",
      engineering_notes: "Implement queue-depth-based auto-scaling using KEDA. Configure min 2 / max 10 replicas. Add scale-down cooldown of 5 minutes to prevent thrashing. Update refund batch size configuration." },
    { title: "UPI Status Polling Optimization", description: "Reduce UPI transaction status polling interval for faster booking confirmation", priority: "high", incidentRef: null, ticketRefs: [2,10], status: "pending", package_name: "ym-upi-polling-v1.3",
      engineering_notes: "Reduce polling interval from 30s to 5s for first 2 minutes, then fall back to 15s. Implement webhook-style status callback from UPI gateway where available. Add exponential backoff for long-pending transactions." },
  ],
  [
    { ticketRef: 17, confidence: 94, daysAgo: 2,
      draftBody: "Dear Priya Sharma, We sincerely apologize for the subscription charge after your cancellation request. Our review shows that the cancellation was received but not fully processed due to a system error in the cancellation workflow. We have processed the cancellation immediately and initiated a full refund for the charged amount. The refund should appear in your account within 3-5 business days. We have also credited 200 loyalty points as compensation. Best regards, Alice Chen" },
    { ticketRef: 23, confidence: 90, daysAgo: 3,
      draftBody: "Dear Neha Kapoor, Thank you for reporting the app crash issue after the latest update. Our engineering team has identified the root cause as a compatibility issue with the payment SDK integration on certain device models. We have submitted a hotfix to the app stores and it should be available within 24 hours. In the meantime, please try reinstalling the app to resolve the issue. Best regards, Bob Martinez" },
    { ticketRef: 10, confidence: 88, daysAgo: 4,
      draftBody: "Dear Ananya Reddy, We apologize for the duplicate charge on your beauty package booking. Our investigation shows that the payment was processed twice due to a retry mechanism that did not detect the original successful transaction. We have initiated an immediate refund for the duplicate charge. The refund of Rs. 2,499 will be credited to your original payment method within 3-5 business days. Best regards, Carol Singh" },
    { ticketRef: 36, confidence: 86, daysAgo: 5,
      draftBody: "Dear Deepa Nair, We apologize for not receiving the service completion confirmation after your appointment. Our notification system experienced a delivery failure that affected confirmation messages. Your appointment has been marked as completed in our system and the beautician rating should now be available. We have applied a 10% discount on your next booking as compensation. Best regards, Dave Kim" },
  ]
);


export const ENTERPRISE_DEMO_WORKSPACES = ["binocs","zap","foxo","corally","yesmadam"];

export const ENTERPRISE_DEMO = DEMO;

export const WORKSPACE_NAMES = {
  binocs: "Binocs",
  zap: "Zapdata",
  foxo: "Foxo",
  corally: "Corally",
  yesmadam: "YesMadam",
};
