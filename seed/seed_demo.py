"""Seed demo data for all workspaces using Lemma Python SDK."""
import os, json, uuid, random, time
from datetime import datetime, timedelta, timezone
from lemma_sdk import Pod

pod = Pod.from_env()
SEED_MARKER = "__seed_v1__"

def pick(arr): return arr[random.choice(range(len(arr)))]

def days_ago(n, hour_range=12):
    d = datetime.now(timezone.utc) - timedelta(days=n, hours=random.randint(1, hour_range))
    return d.isoformat().replace("+00:00", "Z")

def _oid(r):
    """Extract created object ID from function run response."""
    if not r:
        return None
    od = r.output_data
    if od and hasattr(od, 'additional_properties'):
        return od.additional_properties.get("ticket_id") or od.additional_properties.get("signal_id") or od.additional_properties.get("id")
    return r.id

def run_fn(name, data):
    try:
        return pod.functions.run(name, input=data)
    except Exception as e:
        print(f"  ! {name}: {e}")
        return None

def rec_create(table, data):
    try:
        return pod.records.create(table, data)
    except Exception as e:
        print(f"  ! records.create {table}: {e}")
        return None

def rec_update(table, id_, data, silent=False):
    try:
        pod.records.update(table, id_, data)
    except Exception as e:
        if not silent:
            print(f"  ! records.update {table} {id_}: {e}")

def create_ticket(title, customer_name, customer_email, body, priority, category, status):
    r = run_fn("create_ticket", {
        "title": title, "customer_name": customer_name, "customer_email": customer_email,
        "body": body, "channel": "email",
    })
    ticket_id = _oid(r)
    if not ticket_id:
        return None
    updates = {"priority": priority, "category": category, "tags": [SEED_MARKER, category.lower().replace(" ", "_")]}
    if status:
        updates["status"] = status
    rec_update("tickets", ticket_id, updates)
    return ticket_id

def create_signal(name, summary, category):
    r = run_fn("create_signal", {"title": name, "summary": summary, "category": category})
    sig_id = _oid(r)
    if sig_id:
        rec_update("signals", sig_id, {"tags": [SEED_MARKER]})
    return sig_id

def create_audit_log(action, actor, resource_type, name, created_at):
    rec_create("audit_logs", {
        "id": str(uuid.uuid4()), "action": action, "actor_agent_name": actor,
        "resource_type": resource_type, "details": {"name": name}, "created_at": created_at, "tags": [SEED_MARKER],
    })

def create_incident(title, summary, severity):
    rec_create("incidents", {
        "id": str(uuid.uuid4()), "title": title, "summary": summary,
        "severity": severity, "status": "open", "tags": [SEED_MARKER],
    })

def create_draft_record(ticket_id, body, confidence=90):
    rec_create("drafts", {
        "id": str(uuid.uuid4()), "ticket_id": ticket_id, "body": body,
        "confidence": random.randint(80, 95), "status": "pending", "tags": [SEED_MARKER],
    })

def create_memory_entry(title, summary, category):
    rec_create("memory_entries", {
        "id": str(uuid.uuid4()), "title": title, "summary": summary,
        "category": category, "tags": [SEED_MARKER],
    })

# ── Seed data ──────────────────────────────────────────────

CUSTOMERS = {
    "corally": [("Acme Partners","ops@acmepartners.com"),("NexusConnect Inc","support@nexusconnect.io"),
                ("DataBridge Solutions","eng@databridge.io"),("PinnacleCRM","help@pinnaclecrm.com"),
                ("SynergyCloud","admin@synergycloud.io"),("VelocityPartners","ops@velocitypartners.com"),
                ("OmniChannel Inc","support@omnichannel.io"),("FusionLayer","dev@fusionlayer.com"),
                ("Atlas Partners","partner@atlaspartners.io"),("Cortex Integrations","eng@cortexintegrations.com")],
    "foxo": [("City General Hospital","it@citygeneral.com"),("WellCare Clinics","support@wellcareclinics.com"),
             ("MediConnect","ops@mediconnect.io"),("HealthFirst Medical","admin@healthfirstmed.com"),
             ("PrimePath Labs","lab@primepathlabs.com"),("Apollo Health Systems","help@apollohs.com"),
             ("Redwood Medical Group","support@redwoodmed.com"),("Sunrise Cardiology","it@sunrisecardio.com"),
             ("Mercy Health Network","ops@mercyhealth.net"),("Peak Diagnostics","lab@peakdiagnostics.com")],
    "binocs": [("SilverPoint Capital","ops@silverpointcap.com"),("Atlas Equity Group","compliance@atlas-equity.com"),
               ("Meridian Ventures","support@meridian.vc"),("PineBrook Advisory","admin@pinebrookadvisory.com"),
               ("Summit PE Partners","deals@summitpe.com"),("Horizon Family Office","it@horizonfo.com"),
               ("Crestview Investments","ops@crestviewinv.com"),("NorthStar Asset Mgmt","support@northstaram.com"),
               ("BayFront Capital","compliance@bayfrontcap.com"),("RidgeLine Financial","admin@ridgelinefin.com")],
    "zap": [("RetailMax Inc","eng@retailmax.com"),("DataDriven Co","ops@datadriven.co"),
            ("CustomerFirst","support@customerfirst.io"),("OmniRetail","it@omniretail.com"),
            ("InsightHub","admin@insighthub.io"),("MarketPulse Analytics","eng@marketpulse.com"),
            ("BrandWise Solutions","ops@brandwise.io"),("EcomMetrics","support@ecommetrics.com"),
            ("SegmentFlow","dev@segmentflow.io"),("Clarity Data","admin@claritydata.com")],
    "yesmadam": [("Priya Sharma","priya.sharma@gmail.com"),("Ananya Reddy","ananya.reddy@yahoo.com"),
                 ("Neha Kapoor","neha.kapoor@outlook.com"),("Riya Mehta","riya.mehta@gmail.com"),
                 ("Kavita Singh","kavita.singh@icloud.com"),("Sneha Patel","sneha.patel@hotmail.com"),
                 ("Deepa Nair","deepa.nair@gmail.com"),("Anjali Deshmukh","anjali.deshmukh@yahoo.com"),
                 ("Pooja Iyer","pooja.iyer@outlook.com"),("Meera Joshi","meera.joshi@gmail.com")],
}

# (title, category, priority[, status])
# status must be one of: new, triaged, waiting_approval, resolved
TICKET_DEFS = {
    "corally": [
        ("CRM Sync: partner sync failing","CRM Sync","urgent","triaged"),
        ("CRM Sync: HubSpot deal data not reflecting","CRM Sync","high"),
        ("CRM Sync: webhook timeout on partner update","CRM Sync","high"),
        ("CRM Sync: duplicate partner records after sync","CRM Sync","normal"),
        ("CRM Sync: integration returning 503 errors","CRM Sync","urgent","triaged"),
        ("Partner Onboarding: invite emails not delivered","Partner Onboarding","urgent"),
        ("Partner Onboarding: verification link expired","Partner Onboarding","high"),
        ("Partner Onboarding: bulk import job failed","Partner Onboarding","high"),
        ("Contract: invoice amount mismatch","Contract","high"),
        ("Contract: renewal auto-approved without sign-off","Contract","urgent","triaged"),
        ("Contract: partner tier upgrade not reflected","Contract","normal"),
        ("API: OAuth authentication failure","API","urgent"),
        ("API: rate limit exceeded on data export","API","high"),
        ("API: response payload missing fields","API","normal"),
        ("Billing: MRR figures incorrect on dashboard","Billing","high"),
        ("Billing: partner commission calculation error","Billing","urgent"),
        ("Billing: invoice double-charged","Billing","high"),
        ("User Access: partner admin password reset","User Access","normal"),
        ("User Access: SSO login redirect loop","User Access","high"),
        ("User Access: new user cannot access dashboard","User Access","normal"),
        ("API: custom integration webhook not firing","API","normal"),
        ("Partner Onboarding: portal search inconsistent","Partner Onboarding","low"),
        ("CRM Sync: data migration stalled","CRM Sync","high","resolved"),
        ("User Access: trial account flagged inactive","User Access","low"),
        ("Billing: invoice PDF generation failing","Billing","normal"),
        ("Partner Onboarding: referral links returning 404","Partner Onboarding","high","resolved"),
        ("API: SLA breach notification not sent","API","urgent","triaged"),
        ("CRM Sync: multi-tenant isolation issue","CRM Sync","urgent"),
    ],
    "foxo": [
        ("Appointment: patient unable to book","Appointment","urgent"),
        ("Appointment: slot double-booking in cardiology","Appointment","high"),
        ("Appointment: SMS reminders not sending","Appointment","high"),
        ("Appointment: same-day queue not updating","Appointment","normal","triaged"),
        ("Prescription: e-prescription not loading","Prescription","urgent"),
        ("Prescription: controlled substance needs override","Prescription","high"),
        ("Prescription: renewal request not reaching doctor","Prescription","high"),
        ("Patient: duplicate records after merge","Patient","high"),
        ("Patient: demographics not persisting","Patient","normal"),
        ("Patient: PHI data export failing","Patient","urgent","triaged"),
        ("Lab Reports: PDF upload failing","Lab Reports","high"),
        ("Lab Reports: critical result alert not triggered","Lab Reports","urgent"),
        ("Lab Reports: auto-import from Quest stalled","Lab Reports","normal"),
        ("Doctor: availability calendar not syncing","Doctor","high"),
        ("Doctor: locum tenens cannot access patient panel","Doctor","normal"),
        ("Doctor: referral form submission failing","Doctor","normal"),
        ("Insurance: eligibility verification timeout","Insurance","urgent"),
        ("Insurance: claim submission rejected","Insurance","high"),
        ("Insurance: prior authorization stuck","Insurance","high"),
        ("Appointment: telehealth video dropped","Appointment","urgent","triaged"),
        ("Lab Reports: HL7 message feed delayed","Lab Reports","high"),
        ("Patient: intake form not populating","Patient","normal","resolved"),
        ("Doctor: MFA failing for remote login","Doctor","high"),
        ("Insurance: copay calculator incorrect","Insurance","normal"),
        ("Patient: ADT notifications not reaching PCP","Patient","normal"),
        ("Prescription: medication interaction not flagged","Prescription","urgent"),
        ("Appointment: ER wait time board not updating","Appointment","low"),
    ],
    "binocs": [
        ("Financial Report: Q3 statements missing","Financial Report","urgent"),
        ("Financial Report: IRR calculation incorrect","Financial Report","high"),
        ("Financial Report: investor letter PDF failed","Financial Report","high"),
        ("Document Review: AI risk scoring inconsistent","Document Review","urgent"),
        ("Document Review: OCR pipeline failed","Document Review","high"),
        ("Document Review: due diligence checklist incomplete","Document Review","normal"),
        ("Portfolio: financial upload timing out","Portfolio","high"),
        ("Portfolio: valuation model not updating","Portfolio","urgent"),
        ("Portfolio: holding period return discrepancy","Portfolio","normal"),
        ("Client: dashboard loading slowly","Client","high"),
        ("Client: LP capital call notification not sent","Client","high"),
        ("Client: document watermark not applying","Client","normal"),
        ("Risk Assessment: concentration report zeros","Risk Assessment","urgent"),
        ("Risk Assessment: ESG scoring no data","Risk Assessment","high"),
        ("Risk Assessment: stress test simulation failing","Risk Assessment","high","triaged"),
        ("Login: MFA enrollment loop","Login","high"),
        ("Login: SSO session timeout too aggressive","Login","normal"),
        ("Login: IP whitelist not enforced","Login","urgent"),
        ("Client: data room permission sync delayed","Client","normal"),
        ("Portfolio: deal flow export missing fields","Portfolio","normal","resolved"),
        ("Financial Report: RSU valuation model error","Financial Report","high"),
        ("Portfolio: fund administrator reconciliation mismatch","Portfolio","high"),
        ("Financial Report: tax lot accounting not generating","Financial Report","urgent","triaged"),
        ("Document Review: board pack skipping appendix","Document Review","normal","resolved"),
        ("Risk Assessment: GDPR deletion not processing","Risk Assessment","high"),
        ("Client: audit trail export missing timestamps","Client","normal"),
    ],
    "zap": [
        ("CRM: contact sync delayed 45+ min","CRM","high"),
        ("CRM: lead enrichment not populating","CRM","high"),
        ("CRM: deal stage change not triggering webhook","CRM","normal"),
        ("API: rate limit exceeded for data export","API","urgent"),
        ("API: pagination inconsistent","API","high"),
        ("API: GraphQL subscription not delivering updates","API","normal"),
        ("Webhook: signature validation failing","Webhook","urgent"),
        ("Webhook: retry not honoring backoff","Webhook","high"),
        ("Webhook: duplicate events sent","Webhook","normal"),
        ("Data Import: import job stuck in queued","Data Import","high"),
        ("Data Import: CSV mapping not saving","Data Import","normal"),
        ("Data Import: historical backfill failed at 73%","Data Import","urgent"),
        ("Analytics: dashboard showing stale data","Analytics","high"),
        ("Analytics: segmentation query timing out","Analytics","high"),
        ("Analytics: attribution report negative values","Analytics","urgent"),
        ("Integrations: Slack not posting alerts","Integrations","normal"),
        ("Integrations: HubSpot sync broken","Integrations","high"),
        ("Integrations: Zendesk creating duplicates","Integrations","high"),
        ("CRM: profile merge producing duplicates","CRM","high"),
        ("API: event stream lag 30+ minutes","API","urgent","triaged"),
        ("Data Import: enrichment returning stale data","Data Import","normal","resolved"),
        ("Webhook: payload size limit too low","Webhook","normal"),
        ("Analytics: segment membership not updating","Analytics","high"),
        ("Data Import: S3 export access denied","Data Import","urgent","triaged"),
        ("Integrations: custom attribute mapping lost","Integrations","normal"),
        ("CRM: identity resolution disconnected nodes","CRM","high"),
    ],
    "yesmadam": [
        ("Booking: package not confirming after payment","Booking","urgent"),
        ("Booking: reschedule option greyed out","Booking","high"),
        ("Booking: same-day not in beautician schedule","Booking","high"),
        ("Beautician: no-show for appointment","Beautician","urgent"),
        ("Beautician: preferred not listed in slots","Beautician","normal"),
        ("Beautician: rating not posting after service","Beautician","normal"),
        ("Refund: cancelled package pending 8 days","Refund","urgent"),
        ("Refund: processed but not in bank","Refund","high"),
        ("Refund: partial downgrade calculated wrong","Refund","high"),
        ("Payment: charged twice for single booking","Payment","urgent"),
        ("Payment: deducted after OTP but booking failed","Payment","urgent"),
        ("Payment: UPI stuck for 24+ hours","Payment","high"),
        ("Wallet: cashback not credited","Wallet","normal"),
        ("Wallet: balance wrong after top-up","Wallet","high"),
        ("Wallet: deducted twice for single booking","Wallet","urgent"),
        ("Cancellation: auto-cancelled without notification","Cancellation","high"),
        ("Cancellation: fee waived not applied for loyalty","Cancellation","normal"),
        ("Cancellation: subscription not taking effect","Cancellation","high"),
        ("Booking: activation code not delivered via SMS","Booking","high"),
        ("Payment: add-on charges not itemized","Payment","normal","resolved"),
        ("Booking: festive discount not applying","Booking","high"),
        ("Payment: gift card redemption failing","Payment","normal"),
        ("Beautician: attendance not marked after service","Beautician","low"),
        ("Cancellation: membership benefits not reflecting","Cancellation","normal"),
        ("Wallet: referral reward link expired","Wallet","low","resolved"),
        ("Booking: slot auto-released before appointment","Booking","urgent","triaged"),
    ],
}

SIGNAL_DEFS = {
    "corally": [
        ("CRM Sync Failure Spike","Multiple partner reports of CRM sync failures — 8+ related tickets in 48h. Systemic integration layer issue.","CRM Sync"),
        ("Partner Invite Failures","Partner onboarding invitations failing to deliver. Upstream SMTP relay issue.","Partner Onboarding"),
        ("OAuth Authentication Errors","Intermittent OAuth token validation failures affecting partner API access.","API"),
        ("Billing Discrepancy Trend","Growing billing tickets: invoice mismatches, commission calculation errors.","Billing"),
    ],
    "foxo": [
        ("Appointment Booking Failures","Patients unable to complete bookings across departments. Sytem fails at confirmation step.","Appointment"),
        ("Prescription API Errors","E-prescription service returning timeouts affecting pharmacy systems.","Prescription"),
        ("Patient Record Sync Failures","Patient updates not persisting across systems. Potential HL7 interface issue.","Patient"),
        ("Lab Result Processing Delays","Lab upload and auto-import pipeline delays affecting diagnostic turnaround.","Lab Reports"),
    ],
    "binocs": [
        ("Report Generation Failures","Multiple report types failing: Q3 statements, investor letters, fund performance.","Financial Report"),
        ("OCR Processing Errors","Document OCR failing on scanned PDFs, affecting due diligence workflow.","Document Review"),
        ("Client Login Instability","Portal authentication issues including MFA loops and SSO timeouts.","Login"),
        ("Portfolio Data Processing Delays","Portfolio financial data upload and valuation model updates experiencing delays.","Portfolio"),
    ],
    "zap": [
        ("CRM Sync Degradation","CRM sync delays and incomplete data transfer across multiple clients.","CRM"),
        ("API Rate Limit Exhaustion","Multiple customers hitting rate limits on data export endpoints.","API"),
        ("Data Import Pipeline Failures","Import jobs failing or stuck at various stages.","Data Import"),
        ("Webhook Reliability Issues","Webhook delivery and signature validation failures.","Webhook"),
    ],
    "yesmadam": [
        ("Beautician No-Show Spike","Multiple reports of beauticians not arriving for appointments — dispatch system failure.","Beautician"),
        ("Payment Gateway Failures","Payment failures: double charges, failed OTP, stuck transactions.","Payment"),
        ("Refund Processing Delays","Refund requests taking significantly longer than SLA.","Refund"),
        ("Wallet Balance Inconsistencies","Wallet balances not reflecting correct amounts after top-ups.","Wallet"),
    ],
}

INCIDENT_DEFS = {
    "corally": [
        ("CRM Integration Outage","Systemic CRM sync failure affecting all partner integrations. API gateway configuration error during maintenance.","critical"),
        ("Partner Portal Auth Failure","OAuth/SSO auth services for partner portal experiencing intermittent failures.","high"),
    ],
    "foxo": [
        ("Appointment Service Outage","Appointment booking service unavailable across all departments.","critical"),
        ("Patient Data Sync Failure","Patient demographic update feed stalled between EHR systems.","high"),
    ],
    "binocs": [
        ("Due Diligence Processing Delay","Document review and report generation pipeline experiencing systemic backlog.","critical"),
        ("OCR Pipeline Failure","Document OCR engine not returning results for scanned docs.","high"),
    ],
    "zap": [
        ("API Service Degradation","Multiple API endpoints experiencing increased latency and timeouts.","critical"),
        ("Customer Data Processing Failure","Data import and CRM sync pipelines stalled across multiple accounts.","high"),
    ],
    "yesmadam": [
        ("Payment Gateway Failure","Payment processing system experiencing transaction failures including double charges.","critical"),
        ("Booking Service Degradation","Appointment booking and beautician dispatch system partial outage.","high"),
    ],
}

DRAFT_BODIES = {
    "corally": [
        "Dear Partner,\n\nWe have identified the root cause of the CRM sync failure. A recent API gateway configuration change during our maintenance window caused the integration layer to drop connections intermittently. Our engineering team has rolled back the change and all sync jobs are now processing normally. We are monitoring closely.\n\nBest regards,\nPartner Support Team",
        "Hello,\n\nThe partner invite email delivery issue has been traced to an upstream SMTP relay configuration. Our email delivery team has updated the DKIM and SPF records, and we have re-queued all failed invitations. You should see delivery within 15 minutes.\n\nBest regards,\nPartner Support Team",
        "Dear Customer,\n\nThe OAuth authentication failures were caused by an expired certificate in our token signing service. We have rotated the certificate and all authentication flows are now operational.\n\nBest regards,\nPartner Support Team",
        "Hi there,\n\nThe duplicate partner record issue has been resolved. Our deduplication job has merged the affected records and preserved the complete audit trail.\n\nBest regards,\nPartner Support Team",
        "Dear Partner,\n\nThe invoice discrepancy has been reviewed by our billing team. The overcharge was caused by a proration error during the plan upgrade. We have issued a credit note.\n\nBest regards,\nBilling Support Team",
        "Hello,\n\nThe webhook timeout issue has been resolved. We increased the timeout threshold from 10s to 30s and added retry logic with exponential backoff.\n\nBest regards,\nPartner Support Team",
    ],
    "foxo": [
        "Dear Provider,\n\nThe appointment booking issue has been identified as a session management bug in the patient portal. Our team has deployed a hotfix.\n\nBest regards,\nHealthcare Support Team",
        "Hello,\n\nThe e-prescription loading issue was caused by a database connection pool exhaustion. We have scaled up the pool and restarted the service.\n\nBest regards,\nHealthcare Support Team",
        "Dear Doctor,\n\nThe lab report upload failure was due to a file size validation bug. We have corrected the limit to 25MB and re-processed the failed uploads.\n\nBest regards,\nHealthcare Support Team",
        "Hi,\n\nThe insurance verification timeout issue has been resolved. Our integration with the clearinghouse was experiencing latency due to a batch processing job.\n\nBest regards,\nHealthcare Support Team",
        "Dear Provider,\n\nThe patient profile duplication was caused by a race condition in the merge workflow. We have fixed the synchronization issue.\n\nBest regards,\nHealthcare Support Team",
    ],
    "binocs": [
        "Dear Client,\n\nThe financial report generation failure was caused by a data aggregation query timeout. We have optimized the query and all pending reports have been generated successfully.\n\nBest regards,\nDue Diligence Support",
        "Hello,\n\nThe AI risk scoring inconsistency was traced to a model version mismatch between staging and production. We have synchronized the model artifacts.\n\nBest regards,\nDue Diligence Support",
        "Dear Investor,\n\nThe OCR pipeline failure was caused by a corrupted language pack. We have restored from backup and re-processed all failed documents.\n\nBest regards,\nDue Diligence Support",
        "Hi,\n\nThe investor dashboard performance issue was caused by a memory leak in the real-time valuation widget. We have deployed a fix.\n\nBest regards,\nDue Diligence Support",
        "Dear Client,\n\nThe portfolio upload timeout issue has been resolved. We have implemented a queue-based processing architecture.\n\nBest regards,\nDue Diligence Support",
        "Hello,\n\nClient portal login issues have been resolved. The MFA enrollment loop was caused by an incorrect redirect URI in the identity provider configuration.\n\nBest regards,\nDue Diligence Support",
    ],
    "zap": [
        "Dear Customer,\n\nThe CRM sync delay was caused by a backlog in our event processing pipeline. We have scaled the consumer workers and cleared the backlog.\n\nBest regards,\nCustomer Intelligence Support",
        "Hello,\n\nThe API rate limit issue has been addressed by increasing the per-customer rate limit from 1000 to 5000 requests per minute.\n\nBest regards,\nCustomer Intelligence Support",
        "Dear Customer,\n\nThe data enrichment failure was caused by a third-party provider API deprecation. We have migrated to the updated API version.\n\nBest regards,\nCustomer Intelligence Support",
        "Hi,\n\nThe webhook signature validation issue was caused by clock skew. We have implemented a 5-minute leeway in signature timestamp validation.\n\nBest regards,\nCustomer Intelligence Support",
        "Dear Customer,\n\nThe duplicate customer profile issue has been resolved. Our identity resolution engine was using an outdated matching rule set.\n\nBest regards,\nCustomer Intelligence Support",
        "Hello,\n\nThe analytics dashboard staleness was caused by a data warehouse refresh job failing silently. We have fixed the job and triggered a full refresh.\n\nBest regards,\nCustomer Intelligence Support",
    ],
    "yesmadam": [
        "Dear Customer,\n\nWe sincerely apologize for the beautician no-show experience. We have refunded the service amount to your wallet and added a complimentary service credit.\n\nBest regards,\nCustomer Care Team",
        "Hello,\n\nThe double charge issue has been investigated and confirmed. Our payments team has initiated a refund for the duplicate transaction.\n\nBest regards,\nCustomer Care Team",
        "Dear Customer,\n\nWe apologize for the refund delay. Your refund was stuck in a manual review queue. We have processed the refund and it will be credited within 48 hours.\n\nBest regards,\nCustomer Care Team",
        "Hi,\n\nThe wallet balance issue has been resolved. The top-up transaction was marked as pending due to a UPI webhook delay. We have manually reconciled the transaction.\n\nBest regards,\nCustomer Care Team",
        "Dear Customer,\n\nThe booking auto-cancellation was caused by a payment confirmation timeout. We have reinstated your booking and extended the payment window to 15 minutes.\n\nBest regards,\nCustomer Care Team",
        "Hello,\n\nThe beauty package activation issue has been resolved. The activation SMS was not triggered due to a DLT template registration delay. We have re-sent the activation code.\n\nBest regards,\nCustomer Care Team",
        "Dear Customer,\n\nWe apologize for the OTP payment failure. The transaction was captured by the bank but the confirmation webhook was not received. We have reconciled the transaction.\n\nBest regards,\nCustomer Care Team",
    ],
}

ACTOR_NAMES = ["Triage Agent", "Signal Detection Agent", "Knowledge Agent", "Reply Agent", "Support Manager"]
LOG_ACTIONS = ["ticket.created","triage.completed","knowledge.search.completed","draft.generated",
               "manager.notification_created","signal.detected","incident.created","draft.pending_approval","ticket.escalated"]

# ── Seed each workspace ────────────────────────────────────

workspaces = ["corally", "foxo", "binocs", "zap", "yesmadam"]

for ws in workspaces:
    print(f"\n{'='*60}")
    print(f"Seeding: {ws}")
    print(f"{'='*60}")

    customers = CUSTOMERS[ws]
    tickets_def = TICKET_DEFS[ws]
    signals_def = SIGNAL_DEFS[ws]
    incidents_def = INCIDENT_DEFS[ws]
    drafts = DRAFT_BODIES[ws]

    # ── Tickets ──
    print(f"\n  Tickets ({len(tickets_def)})...")
    ticket_ids = []
    for i, entry in enumerate(tickets_def):
        title, cat, pri = entry[0], entry[1], entry[2]
        status = entry[3] if len(entry) > 3 else None
        body_extra = ""
        cname, cemail = customers[i % len(customers)]
        if not status:
            status = "resolved" if i > 15 and random.random() < 0.4 else None
        created = days_ago(random.randint(1, 28))

        tid = create_ticket(title, cname, cemail, f"We are reporting an issue with {title}. Please investigate and resolve at the earliest.{body_extra}", pri, cat, status)
        if tid:
            ticket_ids.append(tid)
            # Overwrite created_at
            rec_update("tickets", tid, {"created_at": created})
        print(f"    [{i+1}/{len(tickets_def)}] {title[:55]}")
        time.sleep(0.05)

    # ── Signal detection ──
    print(f"\n  Running signal detection ({len(ticket_ids)} tickets)...")
    for i, tid in enumerate(ticket_ids[:15]):  # first 15 for speed
        run_fn("detect_and_link_signal", {"ticket_id": tid})
        time.sleep(0.05)

    # ── Signals ──
    print(f"\n  Signals ({len(signals_def)})...")
    for sig in signals_def:
        sid = create_signal(sig[0], sig[1], sig[2])
        print(f"    {sig[0][:55]}")
        time.sleep(0.1)

    # ── Incidents ──
    print(f"\n  Incidents ({len(incidents_def)})...")
    for inc in incidents_def:
        create_incident(inc[0], inc[1], inc[2])
        print(f"    {inc[0][:55]}")
        time.sleep(0.05)

    # ── Audit logs ──
    print(f"\n  Audit logs (15 entries)...")
    for i in range(15):
        action = LOG_ACTIONS[i % len(LOG_ACTIONS)]
        actor = ACTOR_NAMES[i % len(ACTOR_NAMES)]
        rt = "signal" if i % 3 == 0 else "ticket"
        name = tickets_def[i % len(tickets_def)][0]
        create_audit_log(action, actor, rt, name, days_ago(random.randint(1, 20)))
        print(f"    [{i+1}/15] {action}")
        time.sleep(0.02)

    # ── Drafts ──
    print(f"\n  Drafts ({min(len(ticket_ids), len(drafts))})...")
    for i in range(min(len(ticket_ids), len(drafts))):
        tid = ticket_ids[i]
        body = drafts[i % len(drafts)]
        # Try using the function first
        r = run_fn("generate_draft_reply", {"ticket_id": tid})
        if not r:
            create_draft_record(tid, body)
        print(f"    [{i+1}/{min(len(ticket_ids), len(drafts))}] draft for {tid[:12]}...")
        time.sleep(0.1)

    # ── Memory entries ──
    print(f"\n  Memory entries (3)...")
    for sig in signals_def[:3]:
        create_memory_entry(f"Root Cause: {sig[0]}", sig[1], sig[2])
        print(f"    {sig[0][:55]}")
        time.sleep(0.05)

    print(f"\n  OK {ws} seeded successfully!")

print(f"\n{'='*60}")
print("All workspaces seeded!")
print(f"{'='*60}")
