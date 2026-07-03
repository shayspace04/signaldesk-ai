#input_type_name: ApproveSignalInput
#output_type_name: ApproveSignalOutput
#function_name: approve_signal
"""Manager approves a proposed signal: flip status to approved, record the approval, calculate impact scores, and auto-create an incident if criteria are met."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

SEVERITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}

def _require_manager(ctx, action):
    user_id = str(ctx.user_id) if ctx.user_id else None
    if not user_id:
        raise RuntimeError("Insufficient permissions: must be authenticated")
    pod = Pod.from_env()
    try:
        rows = pod.records.list("user_roles", filter=[{"field": "user_id", "op": "eq", "value": user_id}], limit=1)
        items = _items(rows)
        if items and items[0].get("role") == "support_manager":
            return
    except Exception:
        pass
    raise RuntimeError(f"Insufficient permissions: support_manager role required to {action}.")

ACTIVE_STATUSES = ("open", "investigating")

def _items(rows):
    if rows is None:
        return []
    if hasattr(rows, "items"):
        items = rows.items
        if not items:
            return []
        if hasattr(items[0], "to_dict"):
            return [item.to_dict() for item in items]
        return list(items)
    if isinstance(rows, dict) and "data" in rows:
        return rows["data"]
    if isinstance(rows, list):
        return rows
    return []

def _get_existing_incident(pod, signal_id):
    try:
        rows = _items(pod.records.list("incidents", filter=[
            {"field": "signal_id", "op": "eq", "value": signal_id},
        ], limit=20))
        for r in rows:
            if r.get("status") in ACTIVE_STATUSES:
                return r
    except Exception:
        pass
    return None

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
    _require_manager(ctx, "approve signal")
    pod = Pod.from_env()
    decided_at = datetime.now(timezone.utc).isoformat()
    actor = data.approver_user_id or (str(ctx.user_id) if ctx.user_id else None)

    # 1. Flip signal status and workflow stage
    upd = {"status": "approved", "workflowStage": "approved", "decided_at": decided_at}
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

        # ── Dedup: reuse existing active incident ──────────────────────────
        existing = _get_existing_incident(pod, data.signal_id)
        if existing:
            inc = existing
            incident_id = inc["id"]
            now = datetime.now(timezone.utc).isoformat()
            upd = {"last_detected_at": now}
            if inc_title != inc.get("title"):
                upd["title"] = inc_title
            new_sev_rank = SEVERITY_RANK.get(inc_severity, -1)
            cur_sev_rank = SEVERITY_RANK.get(inc.get("severity"), -1)
            if new_sev_rank > cur_sev_rank:
                upd["severity"] = inc_severity
            old_count = inc.get("affected_ticket_count", 0) or 0
            if freq > old_count:
                upd["affected_ticket_count"] = freq
                upd["blast_radius"] = f"{freq} tickets, {affected} customers affected"
            pod.records.update("incidents", inc["id"], upd)
            _audit(pod, "incident.updated", actor_type="system", actor_user_id=actor,
                   resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
                   details={"severity": inc_severity, "title": inc_title,
                            "affected_tickets": freq,
                            "note": "Existing incident updated with new occurrences."})
        else:
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
