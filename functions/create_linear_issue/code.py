#input_type_name: CreateLinearIssueInput
#output_type_name: CreateLinearIssueOutput
#function_name: create_linear_issue
"""Create a Linear issue from an incident. Idempotent: skips if linearIssueId already set."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

SEVERITY_MAP = {"low": "Low", "normal": "Medium", "high": "High", "urgent": "Urgent"}
LINEAR_SEVERITY = {"low": 4, "normal": 3, "high": 2, "urgent": 1}
LINEAR_PRIORITY_LABEL = {4: "Low", 3: "Normal", 2: "High", 1: "Urgent"}
LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628"

def _unwrap(r):
    """Extract dict from connector response. Avoids __dict__ which can trigger lazy eval."""
    if r is None: return {}
    r_inner = getattr(r, "result", r)
    if r_inner is not None and r_inner is not r:
        if isinstance(r_inner, dict): return r_inner
        if hasattr(r_inner, "to_dict"):
            try: return r_inner.to_dict()
            except: pass
    if isinstance(r, dict): return r
    if hasattr(r, "to_dict"):
        try: return r.to_dict()
        except: pass
    data = getattr(r, "data", None)
    if data is not None and isinstance(data, dict): return data
    return {}

def _audit(pod, action, actor_type="user", actor_user_id=None, resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
    try:
        row={"actor_type":actor_type,"action":action}
        if actor_user_id: row["actor_user_id"]=actor_user_id
        if resource_type: row["resource_type"]=resource_type
        if resource_id: row["resource_id"]=str(resource_id)
        if ticket_id: row["ticket_id"]=str(ticket_id)
        if signal_id: row["signal_id"]=str(signal_id)
        if details is not None: row["details"]=details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class CreateLinearIssueInput(BaseModel):
    incident_id: str
    user_id: Optional[str] = None

class CreateLinearIssueOutput(BaseModel):
    success: bool = False
    linearIssueId: Optional[str] = None
    linearIssueIdentifier: Optional[str] = None
    linearIssueUrl: Optional[str] = None
    message: Optional[str] = None

async def create_linear_issue(ctx: FunctionContext, data: CreateLinearIssueInput) -> CreateLinearIssueOutput:
    pod = Pod.from_env()
    inc = pod.records.get("incidents", data.incident_id)
    if not inc:
        raise RuntimeError(f"incident {data.incident_id} not found")

    if inc.get("linearIssueId"):
        return CreateLinearIssueOutput(
            success=True, linearIssueId=inc["linearIssueId"],
            linearIssueIdentifier=inc.get("linearIssueIdentifier", ""),
            linearIssueUrl=inc.get("linearIssueUrl", ""),
            message=f"Already linked to {inc.get('linearIssueIdentifier', 'Linear issue')}",
        )

    sev = inc.get("severity", "normal")
    title = inc.get("title") or f"Incident {data.incident_id}"
    ws_name = inc.get("workspaceName") or "SignalDesk"

    sig = None
    if inc.get("signal_id"):
        try: sig = pod.records.get("signals", inc["signal_id"])
        except Exception: pass

    parts = [
        f"**Incident ID**: {data.incident_id}",
        f"**Workspace**: {ws_name}",
        f"**Severity**: {SEVERITY_MAP.get(sev, 'Medium')}",
        f"**Current Status**: {inc.get('status', 'open')}",
    ]

    ai_root = inc.get('summary') or (sig.get('summary') if sig else None) or None
    if ai_root:
        parts.append(f"\n**AI Root Cause**:\n{ai_root}")

    if sig:
        parts.append(f"\n**Linked Signal**: {sig.get('name') or sig.get('id', '')}")

    affected_customers = inc.get("affected_customer_count", inc.get("affected_ticket_count"))
    if affected_customers:
        parts.append(f"\n**Affected Customers**: {affected_customers}")

    aff_tix = inc.get("affected_ticket_count")
    if aff_tix:
        parts.append(f"\n**Affected Tickets**: {aff_tix}")

    blast = inc.get("blast_radius")
    if blast:
        parts.append(f"\n**Customer Impact**: {blast}")

    timeline = []
    opened = inc.get("opened_at")
    if opened:
        timeline.append(f"- Incident opened: {opened}")
    if sig:
        detected = sig.get("detected_at")
        if detected:
            timeline.append(f"- Signal detected: {detected}")
    if timeline:
        parts.append(f"\n**Timeline Summary**:\n" + "\n".join(timeline))

    parts.append(f"\n**SignalDesk Dashboard URL**: https://incident-desk.apps.lemma.work/incidents/{data.incident_id}")
    description_body = "\n\n".join(parts)

    linear_pri = LINEAR_SEVERITY.get(sev, "medium")

    try:
        result = pod.connectors.execute("linear", "LINEAR_CREATE_LINEAR_ISSUE", {
            "title": f"[{SEVERITY_MAP.get(sev, 'Medium')}] {title}",
            "description": description_body,
            "priority": linear_pri,
            "team_id": LINEAR_TEAM_ID,
        })
    except Exception as e:
        return CreateLinearIssueOutput(
            success=False,
            message=f"Linear connector error: {e}",
        )

    d = _unwrap(result)
    issue_id = d.get("id") or d.get("issue_id")
    issue_url = d.get("url") or d.get("issue_url") or d.get("Ticket Url") or d.get("ticket_url") or ""
    issue_id_str = d.get("identifier") or d.get("issue_identifier") or ""
    if not issue_id_str and issue_url and "/issue/" in issue_url:
        frags = issue_url.split("/issue/")[1].split("/")
        if frags: issue_id_str = frags[0]

    now = datetime.now(timezone.utc).isoformat()
    upd = {
        "linearIssueId": issue_id,
        "linearIssueIdentifier": issue_id_str,
        "linearIssueUrl": issue_url,
        "linearStatus": "Todo",
        "linearSyncedAt": now,
        "linearPriority": LINEAR_PRIORITY_LABEL.get(linear_pri, "Normal"),
        "lastSyncResult": "created",
    }
    try:
        pod.records.update("incidents", data.incident_id, upd)
    except Exception:
        pass

    _audit(pod, "linear.issue_created", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else data.user_id,
           resource_type="incident", resource_id=data.incident_id,
           details={"linearIssueId": issue_id, "linearIssueIdentifier": issue_id_str,
                    "linearIssueUrl": issue_url, "simulated": False,
                    "severity": sev, "title": title})

    return CreateLinearIssueOutput(
        success=True,
        linearIssueId=issue_id,
        linearIssueIdentifier=issue_id_str,
        linearIssueUrl=issue_url,
        message=f"Linear issue {issue_id_str} created",
    )
