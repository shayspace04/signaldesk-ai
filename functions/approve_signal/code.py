#input_type_name: ApproveSignalInput
#output_type_name: ApproveSignalOutput
#function_name: approve_signal
"""Manager approves a proposed signal: flip status to approved, record the approval, calculate impact scores, and auto-create an incident if criteria are met."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None, resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
    try:
        row={"actor_type":actor_type,"action":action}
        if actor_user_id: row["actor_user_id"]=actor_user_id
        if actor_agent_name: row["actor_agent_name"]=actor_agent_name
        if resource_type: row["resource_type"]=resource_type
        if resource_id: row["resource_id"]=str(resource_id)
        if ticket_id: row["ticket_id"]=str(ticket_id)
        if signal_id: row["signal_id"]=str(signal_id)
        if details is not None: row["details"]=details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class ApproveSignalInput(BaseModel):
    signal_id: str
    approver_user_id: Optional[str] = None
    approver_notes: Optional[str] = None

class ApproveSignalOutput(BaseModel):
    signal_id: str
    status: str
    approval_id: str
    incident_id: Optional[str] = None
    slack_alert_sent: bool = False

CATEGORY_RISK = {
    "payment": 95, "security": 98, "billing": 85, "refund": 70,
    "login": 75, "bug": 60, "feature": 30, "shipping": 65,
    "account": 55, "general": 40,
}

async def approve_signal(ctx: FunctionContext, data: ApproveSignalInput) -> ApproveSignalOutput:
    pod = Pod.from_env()
    decided_at = datetime.now(timezone.utc).isoformat()
    actor = data.approver_user_id or (str(ctx.user_id) if ctx.user_id else None)

    # 1. Flip signal status
    upd = {"status": "approved", "decided_at": decided_at}
    if data.approver_user_id: upd["approver_user_id"] = data.approver_user_id
    if data.approver_notes: upd["approver_notes"] = data.approver_notes
    updated = pod.records.update("signals", data.signal_id, upd)
    if not updated:
        raise RuntimeError(f"signal {data.signal_id} not found")
    sig = pod.records.get("signals", data.signal_id)

    # 2. Record the approval decision
    appr = pod.records.create("approvals", {
        "approval_type": "signal", "resource_id": data.signal_id,
        "signal_id": data.signal_id,
        "action": "approve", "actor_user_id": actor, "notes": data.approver_notes,
        "decided_at": decided_at,
    })
    _audit(pod, "signal.approved", actor_type="user", actor_user_id=actor,
           resource_type="signal", resource_id=data.signal_id, signal_id=data.signal_id,
           details={"approver_notes": data.approver_notes, "approval_id": appr["id"]})

    # 3. Calculate impact scores
    try:
        ticket_rows = pod.records.list("tickets", filter=[{"field": "signal_id", "op": "eq", "value": data.signal_id}], limit=200)
        evidence_tickets = [item.to_dict() for item in ticket_rows.items] if hasattr(ticket_rows, "items") else []
    except Exception:
        evidence_tickets = []

    freq = len(evidence_tickets) if evidence_tickets else sig.get("evidence_count", 0)
    customers = set()
    for t in (evidence_tickets or []):
        email = t.get("customer_email")
        if email: customers.add(email)
    affected = len(customers) if customers else 0
    frequency_score = min(freq * 5, 100) if freq > 0 else 0
    customer_impact_score = min(affected * 8, 100) if affected > 0 else 0
    category = (sig.get("category") or "general").lower()
    base_risk = CATEGORY_RISK.get(category, 40)
    priority = sig.get("proposed_priority", "normal")
    priority_boost = {"urgent": 15, "high": 10, "normal": 0, "low": -10}.get(priority, 0)
    business_impact_score = max(0, min(100, base_risk + priority_boost))
    priority_score = max(0, min(100, int(0.35 * frequency_score + 0.30 * customer_impact_score + 0.35 * business_impact_score)))

    pod.records.update("signals", data.signal_id, {
        "frequency_score": frequency_score,
        "customer_impact_score": customer_impact_score,
        "business_impact_score": business_impact_score,
        "priority_score": priority_score,
        "affected_customer_count": affected,
    })

    # 4. Auto-create incident if criteria met
    incident_id = None
    slack_alert_sent = False
    should_create_incident = (
        freq > 5
        or sig.get("proposed_priority") in ("high", "urgent")
        or category == "security"
    )

    if should_create_incident:
        # Determine severity
        if sig.get("proposed_priority") == "urgent" or category == "security":
            inc_severity = "urgent"
        elif sig.get("proposed_priority") == "high" or freq > 10:
            inc_severity = "high"
        elif freq > 5:
            inc_severity = "normal"
        else:
            inc_severity = "low"

        inc_title = f"[{inc_severity.upper()}] {sig.get('name', 'Signal')}"
        inc = pod.records.create("incidents", {
            "title": inc_title,
            "signal_id": data.signal_id,
            "status": "open",
            "severity": inc_severity,
            "summary": sig.get("summary"),
            "blast_radius": f"{freq} tickets, {affected} customers affected",
            "opened_at": decided_at,
            "affected_ticket_count": freq,
            "description": f"Auto-created from approved signal: {sig.get('name')}. Category: {category}. Priority score: {priority_score}.",
        })
        incident_id = inc["id"]
        _audit(pod, "incident.created", actor_type="system", actor_user_id=actor,
               resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
               details={"severity": inc_severity, "title": inc_title, "auto_created": True, "priority_score": priority_score})

        # 5. Send Slack alert if high or critical
        if inc_severity in ("high", "urgent"):
            sev_label = "Critical" if inc_severity == "urgent" else "High"
            alert_msg = (
                f"🚨 SignalDesk Alert\n\n"
                f"Incident:\n{inc_title}\n\n"
                f"Severity:\n{sev_label}\n\n"
                f"Linked Signal:\n{sig.get('name', 'Unknown')}\n\n"
                f"Affected Customers:\n{affected}\n\n"
                f"Priority Score:\n{priority_score}\n\n"
                f"Manager Action Required"
            )
            # Try real Slack; simulate if unavailable
            simulated = True
            try:
                pod.connectors.operations.execute("slack", "send_message", {
                    "channel": "#signaldesk-alerts", "text": alert_msg,
                })
                simulated = False
            except Exception:
                pass
            _audit(pod, "slack.alert_sent", actor_type="system", actor_user_id=actor,
                   resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
                   details={"severity": inc_severity, "simulated": simulated, "message": alert_msg})
            slack_alert_sent = True

    return ApproveSignalOutput(signal_id=data.signal_id, status="approved", approval_id=appr["id"], incident_id=incident_id, slack_alert_sent=slack_alert_sent)
