#input_type_name: MaterializeSignalInput
#output_type_name: MaterializeSignalOutput
#function_name: materialize_signal
"""On manager approval, flip a signal to 'memory' and persist into memory_entries with enriched fields (incl. expected_impact + business_priority read from the signal's root cause analysis) + (optionally) open an incident."""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

SEVERITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}
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

class MaterializeSignalInput(BaseModel):
    signal_id: str
    approver_user_id: Optional[str] = None
    approver_notes: Optional[str] = None
    memory_title: Optional[str] = None
    memory_body: Optional[str] = None
    memory_summary: Optional[str] = None
    memory_root_cause: Optional[str] = None
    memory_recommended_action: Optional[str] = None
    memory_supporting_evidence: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    confidence: Optional[int] = None

class MaterializeSignalOutput(BaseModel):
    signal_id: str
    memory_entry_id: str
    incident_id: Optional[str] = None

async def materialize_signal(ctx: FunctionContext, data: MaterializeSignalInput) -> MaterializeSignalOutput:
    pod = Pod.from_env()
    sig = pod.records.get("signals", data.signal_id)
    if not sig:
        raise RuntimeError(f"signal {data.signal_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    nl = "\n"
    name = sig.get("name", "Untitled signal")
    actor = data.approver_user_id or (str(ctx.user_id) if ctx.user_id else None)

    if data.memory_body:
        body = data.memory_body
    else:
        body = (f"## {name}{nl}{nl}{sig.get('summary', '')}{nl}{nl}"
                f"_Category: {sig.get('category', 'unknown')}_  "
                f"_Evidence: {sig.get('evidence_count', 0)} tickets._{nl}")
        if data.approver_notes:
            body += f"{nl}**Manager note:** {data.approver_notes}{nl}"
    title = data.memory_title or name
    summary = data.memory_summary or sig.get("summary", "")
    # Root cause analysis fields: prefer agent's memory_* (passed in), fall back to the
    # signal's stored analysis (written earlier by store_signal_analysis), then empty.
    root_cause = data.memory_root_cause or sig.get("root_cause") or ""
    recommended_action = data.memory_recommended_action or sig.get("suggested_action") or ""
    expected_impact = sig.get("expected_impact") or ""
    business_priority = sig.get("business_priority") or ""
    analysis_confidence = sig.get("analysis_confidence")

    supporting_evidence = data.memory_supporting_evidence or []
    # Build evidence list from signal's example tickets if not provided
    if not supporting_evidence:
        for tid in (sig.get("example_ticket_ids") or [])[:5]:
            try:
                t = pod.records.get("tickets", str(tid))
                if t:
                    supporting_evidence.append({
                        "ticket_number": t.get("number"),
                        "title": t.get("title"),
                        "customer": t.get("customer_name") or t.get("customer_email"),
                        "category": t.get("category"),
                        "priority": t.get("priority"),
                    })
            except Exception:
                pass

    tags = data.tags or ([sig["category"]] if sig.get("category") else [])
    # confidence: agent input > stored analysis_confidence > default 80
    if data.confidence is not None:
        confidence = data.confidence
    elif analysis_confidence is not None:
        confidence = analysis_confidence
    else:
        confidence = 80

    mem = pod.records.create("memory_entries", {
        "title": title, "body": body, "source_signal_id": data.signal_id,
        "tags": tags or None, "confidence": confidence, "captured_at": now,
        "summary": summary, "root_cause": root_cause,
        "recommended_action": recommended_action,
        "supporting_evidence": supporting_evidence if supporting_evidence else None,
        "created_by": actor,
        "expected_impact": expected_impact or None,
        "business_priority": business_priority or None,
    })
    upd = {"status": "memory", "workflowStage": "knowledge", "memory_entry_id": mem["id"], "decided_at": now}
    if data.approver_user_id: upd["approver_user_id"] = data.approver_user_id
    if data.approver_notes: upd["approver_notes"] = data.approver_notes
    pod.records.update("signals", data.signal_id, upd)

    incident_id = None
    if sig.get("proposed_priority") in ("high", "urgent"):
        inc_title = f"[{sig['proposed_priority'].upper()}] {name}"
        inc_severity = sig.get("proposed_priority", "normal")

        # ── Dedup: reuse existing active incident ──────────────────────────
        existing = _get_existing_incident(pod, data.signal_id)
        if existing:
            inc = existing
            incident_id = inc["id"]
            upd = {"last_detected_at": now}
            if inc_title != inc.get("title"):
                upd["title"] = inc_title
            new_sev_rank = SEVERITY_RANK.get(inc_severity, -1)
            cur_sev_rank = SEVERITY_RANK.get(inc.get("severity"), -1)
            if new_sev_rank > cur_sev_rank:
                upd["severity"] = inc_severity
            old_count = inc.get("affected_ticket_count", 0) or 0
            new_count = sig.get("evidence_count", 0)
            if new_count > old_count:
                upd["affected_ticket_count"] = new_count
            pod.records.update("incidents", inc["id"], upd)
            _audit(pod, "incident.updated", actor_type="system", actor_user_id=actor,
                   resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
                   details={"severity": inc_severity, "title": inc_title,
                            "note": "Existing incident updated with new occurrences."})
        else:
            inc = pod.records.create("incidents", {
                "title": inc_title,
                "signal_id": data.signal_id, "status": "open",
                "severity": inc_severity,
                "summary": sig.get("summary"),
                "blast_radius": f"{sig.get('evidence_count', 0)} tickets in recent window",
                "opened_at": now,
                "affected_ticket_count": sig.get("evidence_count", 0),
            })
            incident_id = inc["id"]
            _audit(pod, "incident.created", actor_type="system", actor_user_id=actor,
                   resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
                   details={"severity": inc_severity, "title": name})
        try:
            pod.records.update("memory_entries", mem["id"], {"related_incident_id": incident_id})
        except Exception:
            pass
        # Email alert for high/urgent (dedup: skip if already sent)
        if sig.get("proposed_priority") in ("high", "urgent") and not inc.get("email_sent"):
            sev_label = "Critical" if sig.get("proposed_priority") == "urgent" else "High"
            email_subject = f"🚨 {sev_label} Incident Created: {name}"
            email_body = (
                f"A new {sev_label.lower()}-severity incident has been auto-created.\n\n"
                f"Incident: [{sig.get('proposed_priority', '').upper()}] {name}\n"
                f"Signal: {name}\n"
                f"Severity: {sev_label}\n"
                f"Affected Customers: {sig.get('affected_customer_count', 0)}\n"
                f"Priority Score: {sig.get('priority_score', 0)}\n\n"
                f"Incident ID: {incident_id}\n"
                f"Manager action may be required."
            )
            email_sent_flag = False
            gmail_msg_id = None
            try:
                gmail_resp = pod.connectors.operations.execute("gmail", "GMAIL_SEND_EMAIL", {
                    "to": "shay24test@gmail.com",
                    "subject": email_subject,
                    "body": email_body,
                })
                if gmail_resp:
                    raw = getattr(gmail_resp, "result", gmail_resp)
                    if isinstance(raw, dict):
                        gmail_msg_id = raw.get("id") or raw.get("message_id") or raw.get("thread_id") or raw.get("gmail_message_id")
                    elif hasattr(raw, "to_dict"):
                        d = raw.to_dict()
                        gmail_msg_id = d.get("id") or d.get("message_id") or d.get("thread_id") or d.get("gmail_message_id")
                email_sent_flag = True
                now_iso = datetime.now(timezone.utc).isoformat()
                try:
                    pod.records.update("incidents", incident_id, {
                        "email_sent": True,
                        "email_sent_at": now_iso,
                        "recipient": "shay24test@gmail.com",
                        "gmail_message_id": gmail_msg_id,
                    })
                except Exception:
                    pass
            except Exception:
                pass
            _audit(pod, "email.alert_sent", actor_type="system", actor_user_id=actor,
                   resource_type="incident", resource_id=incident_id, signal_id=data.signal_id,
                   details={"severity": sig.get("proposed_priority"), "email_sent": email_sent_flag, "subject": email_subject})

    _audit(pod, "memory.materialized", actor_type="user", actor_user_id=actor,
           resource_type="memory_entry", resource_id=mem["id"], signal_id=data.signal_id,
           details={"signal": name, "incident_opened": incident_id is not None,
                    "expected_impact": expected_impact, "business_priority": business_priority})
    return MaterializeSignalOutput(signal_id=data.signal_id, memory_entry_id=mem["id"], incident_id=incident_id)
