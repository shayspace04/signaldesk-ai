#input_type_name: LinkIncidentInput
#output_type_name: LinkIncidentOutput
#function_name: link_incident
"""Create or update an incident linked to a signal. Idempotent: one active incident per signal. Sends Slack alert for high/critical and Gmail alert to manager."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

MANAGER_EMAIL = "shay24test@gmail.com"

SEVERITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}
SEVERITY_LABEL = {"low": "Low", "normal": "Medium", "high": "High", "urgent": "Critical"}
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

def _get_existing_incident(pod, signal_id):
    """Return the first active incident matching signal_id, or None."""
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

class LinkIncidentInput(BaseModel):
    signal_id: str
    title: Optional[str] = None
    summary: Optional[str] = None
    blast_radius: Optional[str] = None
    severity: Optional[str] = "normal"
    status: Optional[str] = "open"
    description: Optional[str] = None
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    recommended_action: Optional[str] = None
    dashboard_link: Optional[str] = None

class LinkIncidentOutput(BaseModel):
    incident_id: str
    incident_updated: bool = False
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

    # ── Dedup: reuse existing active incident ──────────────────────────────
    existing = _get_existing_incident(pod, data.signal_id)
    if existing:
        inc = existing
        inc_updated = True
        now = datetime.now(timezone.utc).isoformat()
        upd = {"last_detected_at": now}
        if data.title and data.title != inc.get("title"):
            upd["title"] = title
        new_sev_rank = SEVERITY_RANK.get(data.severity, -1)
        cur_sev_rank = SEVERITY_RANK.get(inc.get("severity"), -1)
        if new_sev_rank > cur_sev_rank:
            upd["severity"] = data.severity
        if data.summary:
            upd["summary"] = data.summary
        if data.description:
            upd["description"] = data.description
        old_count = inc.get("affected_ticket_count", 0) or 0
        if affected_count > old_count:
            upd["affected_ticket_count"] = affected_count
            upd["blast_radius"] = data.blast_radius or f"{affected_count} tickets, {sig.get('affected_customer_count', 0)} customers"
        pod.records.update("incidents", inc["id"], upd)
        _audit(pod, "incident.updated", actor_type="user",
               actor_user_id=str(ctx.user_id) if ctx.user_id else None,
               resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
               details={"title": title, "severity": data.severity,
                        "affected_tickets": affected_count,
                        "note": "Existing incident updated with new occurrences."})
    else:
        inc = pod.records.create("incidents", {
            "id": str(uuid.uuid4()), "title": title, "signal_id": data.signal_id, "status": data.status or "open",
            "severity": data.severity or "normal",
            "summary": data.summary or sig.get("summary"),
            "blast_radius": data.blast_radius or f"{affected_count} tickets, {sig.get('affected_customer_count', 0)} customers",
            "opened_at": datetime.now(timezone.utc).isoformat(),
            "affected_ticket_count": affected_count,
            "description": data.description or f"Incident linked to signal: {sig.get('name')}",
            "workspaceId": data.workspace_id or sig.get("workspaceId"),
            "workspaceName": data.workspace_name or sig.get("workspaceName"),
        })
        inc_updated = False
        _audit(pod, "incident.created", actor_type="user",
               actor_user_id=str(ctx.user_id) if ctx.user_id else None,
               resource_type="incident", resource_id=inc["id"], signal_id=data.signal_id,
               details={"severity": data.severity, "title": title, "affected_tickets": affected_count})

    # Slack alert for high/urgent (dedup: skip if already sent for this incident)
    slack_sent = False
    if data.severity in ("high", "urgent"):
        existing_slack = _items(pod.records.list("audit_logs", filter=[
            {"field": "action", "op": "eq", "value": "slack.alert_sent"},
            {"field": "resource_id", "op": "eq", "value": inc["id"]},
        ], limit=1))
        if not existing_slack:
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
        # Fetch linked ticket titles
        linked_ticket_titles = []
        try:
            ticket_links = _items(pod.records.list("ticket_incidents", filter=[
                {"field": "incident_id", "op": "eq", "value": inc["id"]},
            ], limit=50))
            for link in ticket_links:
                t = pod.records.get("tickets", link.get("ticket_id"))
                if t:
                    linked_ticket_titles.append(t.get("title") or t.get("customer_name") or t["id"])
        except Exception:
            pass
        if not linked_ticket_titles:
            linked_ticket_titles = [f"{affected_count} ticket(s) affected"]

        ws_name = data.workspace_name or sig.get("workspaceName") or "SignalDesk"
        dash_link = data.dashboard_link or f"https://incident-desk.apps.lemma.work/incidents/{inc['id']}"
        root_cause = data.summary or sig.get("summary") or sig.get("root_cause") or "N/A"
        rec_action = data.recommended_action or "Investigate and resolve per incident response playbook"

        email_body = (
            f"🚨 Incident Alert – SignalDesk\n\n"
            f"Incident ID: {inc['id']}\n"
            f"Incident Title: {title}\n"
            f"Severity: {sev_label}\n"
            f"Workspace: {ws_name}\n"
            f"Linked Signal: {sig.get('name', 'Unknown')}\n"
            f"Linked Tickets:\n"
        )
        for t in linked_ticket_titles:
            email_body += f"  • {t}\n"
        email_body += (
            f"\nNumber of Affected Customers: {sig.get('affected_customer_count', 0)}\n"
            f"AI Root Cause: {root_cause}\n"
            f"Recommended Action: {rec_action}\n"
            f"Time Detected: {inc.get('opened_at', datetime.now(timezone.utc).isoformat())}\n"
            f"Dashboard Link: {dash_link}\n"
        )
        try:
            pod.connectors.execute("gmail", "GMAIL_SEND_EMAIL", {
                "to": MANAGER_EMAIL,
                "subject": f"[{sev_label}] Incident Alert – {title}",
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
        incident_id=inc["id"], incident_updated=inc_updated,
        slack_alert_sent=slack_sent,
        email_sent=email_sent, email_simulated=email_simulated,
        notification_created=notification_created,
    )
