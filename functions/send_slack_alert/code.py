#input_type_name: SendSlackAlertInput
#output_type_name: SendSlackAlertOutput
#function_name: send_slack_alert
"""Send (or simulate) a Slack alert for high/critical incidents. Stores in audit log."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class SendSlackAlertInput(BaseModel):
    incident_id: str
    actor_user_id: Optional[str] = None

class SendSlackAlertOutput(BaseModel):
    incident_id: str
    alert_sent: bool
    message: str
    simulated: bool = True

SEVERITY_LABEL = {"low": "Low", "normal": "Medium", "high": "High", "urgent": "Critical"}

async def send_slack_alert(ctx: FunctionContext, data: SendSlackAlertInput) -> SendSlackAlertOutput:
    pod = Pod.from_env()
    inc = pod.records.get("incidents", data.incident_id)
    if not inc:
        raise RuntimeError(f"incident {data.incident_id} not found")

    severity = inc.get("severity", "normal")
    if severity not in ("high", "urgent"):
        return SendSlackAlertOutput(incident_id=data.incident_id, alert_sent=False, message="No alert needed — severity below threshold.", simulated=True)

    # Read linked signal for context
    signal_name = "Unknown"
    priority_score = 0
    affected = inc.get("affected_ticket_count", 0)
    sig_id = inc.get("signal_id")
    if sig_id:
        try:
            sig = pod.records.get("signals", str(sig_id))
            if sig:
                signal_name = sig.get("name", "Unknown")
                priority_score = sig.get("priority_score", 0)
        except Exception:
            pass

    sev_label = SEVERITY_LABEL.get(severity, severity.title())
    message = (
        f"🚨 SignalDesk Alert\n\n"
        f"Incident:\n{inc.get('title', 'Untitled')}\n\n"
        f"Severity:\n{sev_label}\n\n"
        f"Linked Signal:\n{signal_name}\n\n"
        f"Affected Customers:\n{affected}\n\n"
        f"Priority Score:\n{priority_score}\n\n"
        f"Manager Action Required"
    )

    # Try real Slack connector; simulate if unavailable
    simulated = True
    try:
        # Attempt connector operation (will fail if no Slack connector configured)
        result = pod.connectors.operations.execute("slack", "send_message", {
            "channel": "#signaldesk-alerts",
            "text": message,
        })
        simulated = False
    except Exception:
        pass  # Simulated delivery — no connector configured

    # Store in audit log
    try:
        pod.records.create("audit_logs", {
            "actor_type": "system",
            "action": "slack.alert_sent",
            "resource_type": "incident",
            "resource_id": data.incident_id,
            "signal_id": str(sig_id) if sig_id else None,
            "details": {
                "severity": severity,
                "simulated": simulated,
                "message": message,
                "incident_title": inc.get("title"),
            },
        })
    except Exception:
        pass

    return SendSlackAlertOutput(incident_id=data.incident_id, alert_sent=True, message=message, simulated=simulated)
