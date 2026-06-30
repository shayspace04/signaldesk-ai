#input_type_name: LinkIncidentInput
#output_type_name: LinkIncidentOutput
#function_name: link_incident
"""Create an incident linked to a signal, calculate affected ticket count, send Slack alert for high/critical, email manager, and create in-app notification."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

MANAGER_EMAIL = "shay24test@gmail.com"

SEVERITY_LABEL = {"low": "Low", "normal": "Medium", "high": "High", "urgent": "Critical"}

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

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None, resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
    try:
        row = {"actor_type": actor_type, "action": action}
        if actor_user_id: row["actor_user_id"] = actor_user_id
        if actor_agent_name: row["actor_agent_name"] = actor_agent_name
        if resource_type: row["resource_type"] = resource_type
        if resource_id: row["resource_id"] = str(resource_id)
        if ticket_id: row["ticket_id"] = str(ticket_id)
        if signal_id: row["signal_id"] = str(signal_id)
        if details is not None: row["details"] = details
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
    email_sent: bool = False
    email_simulated: bool = True
    notification_created: bool = False

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
    sev_label = SEVERITY_LABEL.get(data.severity or "normal", "Medium")
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
        alert_msg = (f"🚨 SignalDesk Alert\n\nIncident:\n{title}\n\nSeverity:\n{sev_label}\n\n"
                     f"Linked Signal:\n{sig.get('name', 'Unknown')}\n\n"
                     f"Affected Customers:\n{sig.get('affected_customer_count', 0)}\n\n"
                     f"Priority Score:\n{sig.get('priority_score', 0)}\n\nManager Action Required")
        simulated = True
        try:
            pod.connectors.execute("slack", "send_message", {"channel": "#signaldesk-alerts", "text": alert_msg})
            simulated = False
        except Exception:
            pass
        _audit(pod, "slack.alert_sent", actor_type="system",
               actor_user_id=str(ctx.user_id) if ctx.user_id else None,
               resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
               details={"severity": data.severity, "simulated": simulated, "message": alert_msg})
        slack_sent = True

    # Send email alert via Gmail connector (one per incident)
    email_sent = False
    email_simulated = True
    existing = _items(pod.records.list("audit_logs", filter=[
        {"field": "action", "op": "eq", "value": "manager.email_sent"},
        {"field": "resource_id", "op": "eq", "value": inc["id"]},
    ], limit=1))
    if not existing:
        link = f"https://incident-desk.apps.lemma.work/incidents"
        email_body = (
            f"🚨 High Priority Incident Detected – SignalDesk\n\n"
            f"Incident ID: {inc['id']}\n"
            f"Incident Title: {title}\n"
            f"Severity: {sev_label}\n"
            f"Number of Related Tickets: {affected_count}\n"
            f"Linked Signal: {sig.get('name', 'Unknown')}\n"
            f"Affected Customers: {sig.get('affected_customer_count', 0)}\n"
            f"AI Summary: {data.summary or sig.get('summary', 'N/A')}\n"
            f"Time Detected: {inc.get('opened_at', datetime.now(timezone.utc).isoformat())}\n"
            f"Direct Link: {link}\n"
        )
        try:
            pod.connectors.execute("gmail", "GMAIL_SEND_EMAIL", {
                "to": MANAGER_EMAIL,
                "subject": "High Priority Incident Detected – SignalDesk",
                "body": email_body,
            })
            email_sent = True
            email_simulated = False
            _audit(pod, "manager.email_sent", actor_type="system",
                   resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
                   details={"to": MANAGER_EMAIL, "severity": data.severity, "title": title,
                            "simulated": False, "incident_title": title})
        except Exception as e:
            _audit(pod, "manager.email_error", actor_type="system",
                   resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
                   details={"error": str(e), "to": MANAGER_EMAIL, "severity": data.severity})

    # In-app notification for managers
    notification_created = False
    try:
        _audit(pod, "manager.notification_created", actor_type="system",
               resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
               details={"incident_title": title, "severity": data.severity,
                        "incident_id": inc["id"], "affected_tickets": affected_count})
        notification_created = True
    except Exception:
        pass

    return LinkIncidentOutput(
        incident_id=inc["id"], slack_alert_sent=slack_sent,
        email_sent=email_sent, email_simulated=email_simulated,
        notification_created=notification_created,
    )
