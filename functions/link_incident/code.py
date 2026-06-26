#input_type_name: LinkIncidentInput
#output_type_name: LinkIncidentOutput
#function_name: link_incident
"""Create an incident linked to a signal, calculate affected ticket count, and send Slack alert for high/critical."""
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

class LinkIncidentInput(BaseModel):
    signal_id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    blast_radius: Optional[str] = None
    severity: Optional[str] = "normal"
    status: Optional[str] = "open"
    description: Optional[str] = None

class LinkIncidentOutput(BaseModel):
    incident_id: str
    slack_alert_sent: bool = False

async def link_incident(ctx: FunctionContext, data: LinkIncidentInput) -> LinkIncidentOutput:
    pod = Pod.from_env()
    sig = pod.records.get("signals", data.signal_id)
    if not sig:
        raise RuntimeError(f"signal {data.signal_id} not found")

    # Count affected tickets
    try:
        ticket_rows = pod.records.list("tickets", filter=[{"field": "signal_id", "op": "eq", "value": data.signal_id}], limit=200)
        affected_count = len([item.to_dict() for item in ticket_rows.items]) if hasattr(ticket_rows, "items") else 0
    except Exception:
        affected_count = sig.get("evidence_count", 0)

    title = data.title or f"[{data.severity.upper()}] {sig.get('name', 'Signal')}"
    inc = pod.records.create("incidents", {
        "title": title, "signal_id": data.signal_id, "status": data.status or "open",
        "severity": data.severity or "normal",
        "summary": data.summary or sig.get("summary"),
        "blast_radius": data.blast_radius or f"{affected_count} tickets, {sig.get('affected_customer_count', 0)} customers",
        "opened_at": datetime.now(timezone.utc).isoformat(),
        "affected_ticket_count": affected_count,
        "description": data.description or f"Incident linked to signal: {sig.get('name')}",
    })
    _audit(pod, "incident.created", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
           details={"severity": data.severity, "title": title, "affected_tickets": affected_count})

    # Slack alert for high/urgent
    slack_sent = False
    if data.severity in ("high", "urgent"):
        sev_label = "Critical" if data.severity == "urgent" else "High"
        alert_msg = (f"🚨 SignalDesk Alert\n\nIncident:\n{title}\n\nSeverity:\n{sev_label}\n\n"
                     f"Linked Signal:\n{sig.get('name', 'Unknown')}\n\n"
                     f"Affected Customers:\n{sig.get('affected_customer_count', 0)}\n\n"
                     f"Priority Score:\n{sig.get('priority_score', 0)}\n\nManager Action Required")
        simulated = True
        try:
            pod.connectors.operations.execute("slack", "send_message", {"channel": "#signaldesk-alerts", "text": alert_msg})
            simulated = False
        except Exception:
            pass
        _audit(pod, "slack.alert_sent", actor_type="system",
               actor_user_id=str(ctx.user_id) if ctx.user_id else None,
               resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
               details={"severity": data.severity, "simulated": simulated, "message": alert_msg})
        slack_sent = True

    return LinkIncidentOutput(incident_id=inc["id"], slack_alert_sent=slack_sent)
