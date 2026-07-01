#input_type_name: EscalateIncidentInput
#output_type_name: EscalateIncidentOutput
#function_name: escalate_incident
"""Escalate an incident to a higher severity and send Gmail alert if High/Critical."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

MANAGER_EMAIL = "shay24test@gmail.com"

SEVERITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}
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

class EscalateIncidentInput(BaseModel):
    incident_id: str
    new_severity: str
    workspace_name: Optional[str] = None
    dashboard_link: Optional[str] = None

class EscalateIncidentOutput(BaseModel):
    incident_id: str
    old_severity: str
    new_severity: str
    email_sent: bool = False
    slack_alert_sent: bool = False

async def escalate_incident(ctx: FunctionContext, data: EscalateIncidentInput) -> EscalateIncidentOutput:
    pod = Pod.from_env()

    inc = pod.records.get("incidents", data.incident_id)
    if not inc:
        raise RuntimeError(f"incident {data.incident_id} not found")

    old_sev = inc.get("severity", "normal")
    new_sev = data.new_severity
    old_rank = SEVERITY_RANK.get(old_sev, 0)
    new_rank = SEVERITY_RANK.get(new_sev, 0)

    if new_rank <= old_rank:
        raise RuntimeError(f"new severity '{new_sev}' is not higher than current severity '{old_sev}'")

    pod.records.update("incidents", data.incident_id, {"severity": new_sev})
    _audit(pod, "incident.escalated", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="incident", resource_id=data.incident_id,
           details={"old_severity": old_sev, "new_severity": new_sev,
                    "title": inc.get("title")})

    email_sent = False
    slack_sent = False

    if new_sev in ("high", "urgent"):
        sev_label = SEVERITY_LABEL.get(new_sev, "High")
        ws_name = data.workspace_name or inc.get("workspaceName") or "SignalDesk"
        dash_link = data.dashboard_link or f"https://incident-desk.apps.lemma.work/incidents/{data.incident_id}"

        # Send Slack alert
        try:
            alert_msg = (f"🚨 Incident Escalated – SignalDesk\n\nIncident:\n{inc.get('title', 'Unknown')}\n\n"
                         f"Severity escalated from {SEVERITY_LABEL.get(old_sev, old_sev)} to {sev_label}\n\n"
                         f"Workspace: {ws_name}\n\nDashboard: {dash_link}")
            pod.connectors.execute("slack", "send_message", {"channel": "#signaldesk-alerts", "text": alert_msg})
            slack_sent = True
        except Exception:
            pass

        # Send email alert
        linked_ticket_titles = []
        try:
            ticket_links = _items(pod.records.list("ticket_incidents", filter=[
                {"field": "incident_id", "op": "eq", "value": data.incident_id},
            ], limit=50))
            for link in ticket_links:
                t = pod.records.get("tickets", link.get("ticket_id"))
                if t:
                    linked_ticket_titles.append(t.get("title") or t.get("customer_name") or t["id"])
        except Exception:
            pass
        if not linked_ticket_titles:
            linked_ticket_titles = [f"{inc.get('affected_ticket_count', 0)} ticket(s) affected"]

        signal_name = "N/A"
        if inc.get("signal_id"):
            try:
                sig = pod.records.get("signals", inc["signal_id"])
                if sig:
                    signal_name = sig.get("name", "Unknown")
            except Exception:
                pass

        email_body = (
            f"🚨 Incident Escalated – SignalDesk\n\n"
            f"Incident ID: {data.incident_id}\n"
            f"Incident Title: {inc.get('title', 'Unknown')}\n"
            f"Severity: {sev_label} (escalated from {SEVERITY_LABEL.get(old_sev, old_sev)})\n"
            f"Workspace: {ws_name}\n"
            f"Linked Signal: {signal_name}\n"
            f"Linked Tickets:\n"
        )
        for t in linked_ticket_titles:
            email_body += f"  • {t}\n"
        email_body += (
            f"\nNumber of Affected Customers: {inc.get('affected_ticket_count', 0)}\n"
            f"AI Root Cause: {inc.get('summary') or 'N/A'}\n"
            f"Recommended Action: Immediate investigation required\n"
            f"Time Escalated: {datetime.now(timezone.utc).isoformat()}\n"
            f"Dashboard Link: {dash_link}\n"
        )

        try:
            pod.connectors.execute("gmail", "GMAIL_SEND_EMAIL", {
                "to": MANAGER_EMAIL,
                "subject": f"[{sev_label}] Incident Escalated – {inc.get('title', 'Unknown')}",
                "body": email_body,
            })
            email_sent = True
            _audit(pod, "manager.email_sent", actor_type="system",
                   resource_type="incident", resource_id=data.incident_id,
                   details={"to": MANAGER_EMAIL, "severity": new_sev,
                            "title": inc.get("title"), "escalated_from": old_sev})
        except Exception as e:
            _audit(pod, "manager.email_error", actor_type="system",
                   resource_type="incident", resource_id=data.incident_id,
                   details={"error": str(e), "to": MANAGER_EMAIL, "severity": new_sev})

    return EscalateIncidentOutput(
        incident_id=data.incident_id,
        old_severity=old_sev,
        new_severity=new_sev,
        email_sent=email_sent,
        slack_alert_sent=slack_sent,
    )
