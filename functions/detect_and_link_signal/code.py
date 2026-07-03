#input_type_name: DetectAndLinkSignalInput
#output_type_name: DetectAndLinkSignalOutput
#function_name: detect_and_link_signal
"""Detect if a ticket relates to an existing signal, or group similar tickets into a new signal, and create incidents when threshold is met."""
import re
from typing import Optional, List
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

INCIDENT_TICKET_THRESHOLD = 3
SIMILARITY_MIN_SCORE = 0.4

def _audit(pod, action, actor_type="system", actor_user_id=None, actor_agent_name=None, resource_type=None, resource_id=None, ticket_id=None, signal_id=None, details=None):
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

def _tokenize(text: str) -> set:
    return set(re.findall(r'\b[a-zA-Z]{4,}\b', text.lower()))

def _similarity(a: dict, b: dict) -> float:
    score = 0.0
    ca = (a.get("category") or "").lower()
    cb = (b.get("category") or "").lower()
    if ca and cb and ca == cb:
        score += 0.5
    ta = _tokenize(a.get("title") or "")
    tb = _tokenize(b.get("title") or "")
    if ta and tb:
        score += 0.3 * (len(ta & tb) / max(len(ta | tb), 1))
    ba = _tokenize(a.get("body") or "")
    bb = _tokenize(b.get("body") or "")
    if ba and bb:
        score += 0.2 * (len(ba & bb) / max(len(ba | bb), 1))
    return score

def _items(rows):
    if rows is None:
        return []
    if hasattr(rows, "items"):
        return [item.to_dict() for item in rows.items]
    if isinstance(rows, dict) and "data" in rows:
        return rows["data"]
    if isinstance(rows, list):
        return rows
    return []

class DetectAndLinkSignalInput(BaseModel):
    ticket_id: str

class DetectAndLinkSignalOutput(BaseModel):
    signal_id: Optional[str] = None
    incident_id: Optional[str] = None
    ticket_linked: bool = False
    signal_created: bool = False
    incident_created: bool = False
    ticket_count: int = 0

async def detect_and_link_signal(ctx: FunctionContext, data: DetectAndLinkSignalInput) -> DetectAndLinkSignalOutput:
    pod = Pod.from_env()
    ticket = pod.records.get("tickets", data.ticket_id)
    if not ticket:
        raise RuntimeError(f"ticket {data.ticket_id} not found")

    result = DetectAndLinkSignalOutput()

    # If ticket already linked to a signal, update evidence count and skip to incident check
    if ticket.get("signal_id"):
        sig = pod.records.get("signals", ticket["signal_id"])
        if sig and sig.get("status") not in ("rejected", "memory"):
            ids = list(set((sig.get("example_ticket_ids") or []) + [data.ticket_id]))
            pod.records.update("signals", ticket["signal_id"], {
                "evidence_count": len(ids), "example_ticket_ids": ids,
            })
            existing_signal_id = ticket["signal_id"]
            result.signal_id = ticket["signal_id"]
            result.ticket_linked = True
            result.ticket_count = len(ids)
            # Skip straight to incident check
            sig = pod.records.get("signals", existing_signal_id)
            ticket_count = len(sig.get("example_ticket_ids") or []) or sig.get("evidence_count", 0)
        else:
            return result
    else:
        # Find similar open tickets (same category to reduce scan)
        existing_signal_id = None
        cat_filter = ticket.get("category")
        try:
            if cat_filter:
                rows = pod.records.list("tickets", filter=[{"field": "category", "op": "eq", "value": cat_filter}], limit=200)
            else:
                rows = pod.records.list("tickets", limit=200)
            all_rows = _items(rows)
        except Exception:
            all_rows = _items(pod.records.list("tickets", limit=200))
        candidates = [t for t in all_rows if t.get("id") != data.ticket_id and t.get("status") != "resolved"]

        related = [c for c in candidates if _similarity(ticket, c) >= SIMILARITY_MIN_SCORE]
        all_ticket_ids = [data.ticket_id] + [t.get("id") for t in related]

        # Check if any related ticket is already in a signal
        for t in related:
            sid = t.get("signal_id")
            if sid:
                sig = pod.records.get("signals", sid)
                if sig and sig.get("status") not in ("rejected", "memory"):
                    existing_signal_id = sid
                    break

        if existing_signal_id:
            sig = pod.records.get("signals", existing_signal_id)
            ids = list(set((sig.get("example_ticket_ids") or []) + all_ticket_ids))
            pod.records.update("signals", existing_signal_id, {
                "evidence_count": len(ids), "example_ticket_ids": ids,
            })
            for tid in all_ticket_ids:
                try:
                    pod.records.update("tickets", tid, {"signal_id": existing_signal_id})
                except Exception:
                    pass
            result.signal_id = existing_signal_id
            result.ticket_linked = True
            result.ticket_count = len(ids)
            _audit(pod, "signal.updated", actor_type="system", actor_agent_name="signal-detector",
                   resource_type="signal", resource_id=existing_signal_id, signal_id=existing_signal_id,
                   details={"evidence_count": len(ids), "ticket_ids": ids, "previous_count": len(sig.get("example_ticket_ids") or [])})
            _audit(pod, "ticket.linked_to_signal", actor_type="system", actor_agent_name="signal-detector",
                   resource_type="ticket", resource_id=data.ticket_id, ticket_id=data.ticket_id,
                   signal_id=existing_signal_id,
                   details={"signal_id": existing_signal_id, "ticket_ids": ids})
        else:
            # Build recurring terms from intersection of tokens across all related tickets
            all_sets = [_tokenize(t.get("title", "") + " " + t.get("body", "")) for t in ([ticket] + related)]
            common = all_sets[0]
            for s in all_sets[1:]:
                common &= s
            recurring = list(common)[:20] if common else []

            name = f"{ticket.get('category', 'General')} issue: {ticket.get('title', '')[:120]}" if related else (ticket.get("title", "Signal")[:200])
            priority = ticket.get("priority", "normal")

            sig_result = pod.functions.run("create_signal", {
                "input": {
                    "name": name,
                    "summary": f"Automatically detected from {len(all_ticket_ids)} related ticket(s).",
                    "category": ticket.get("category"),
                    "evidence_count": len(all_ticket_ids),
                    "example_ticket_ids": all_ticket_ids,
                    "recurring_terms": recurring,
                    "proposed_priority": priority,
                }
            })
            od = sig_result.get("output_data") or {}
            signal_id = od.get("signal_id") or sig_result.get("signal_id")

            for tid in all_ticket_ids:
                try:
                    pod.records.update("tickets", tid, {"signal_id": signal_id})
                except Exception:
                    pass

            result.signal_id = signal_id
            result.signal_created = True
            result.ticket_linked = True
            result.ticket_count = len(all_ticket_ids)
            _audit(pod, "signal.created", actor_type="system", actor_agent_name="signal-detector",
                   resource_type="signal", resource_id=signal_id, signal_id=signal_id,
                   details={"name": name, "evidence_count": len(all_ticket_ids)})
            existing_signal_id = signal_id

        # Check if signal has enough tickets for an incident
        sig = pod.records.get("signals", existing_signal_id)
        ticket_count = len(sig.get("example_ticket_ids") or []) or sig.get("evidence_count", 0)

    if ticket_count >= INCIDENT_TICKET_THRESHOLD:
        try:
            existing = _items(pod.records.list("incidents", filter=[{"field": "signal_id", "op": "eq", "value": existing_signal_id}], limit=1))
            if existing:
                result.incident_id = existing[0].get("id")
                # Update affected ticket count on existing incident
                try:
                    pod.records.update("incidents", existing[0].get("id"), {"affected_ticket_count": ticket_count})
                except Exception:
                    pass
                return result
        except Exception:
            pass

        inc_result = pod.functions.run("link_incident", {
            "input": {
                "signal_id": existing_signal_id,
                "title": f"Incident: {sig.get('name', 'Unknown Signal')[:200]}",
                "severity": sig.get("proposed_priority") or ticket.get("priority") or "normal",
                "status": "open",
                "summary": sig.get("summary") or "",
                "blast_radius": f"{ticket_count} tickets, {sig.get('affected_customer_count', 0)} customers",
                "root_cause": sig.get("root_cause") or "",
                "category": sig.get("category") or ticket.get("category") or "",
                "affected_customer_count": sig.get("affected_customer_count", 0),
                "tags": sig.get("recurring_terms") or [],
                "description": f"Auto-created by SignalDesk when signal reached {ticket_count} related tickets.",
            }
        })
        od = inc_result.get("output_data") or {}
        result.incident_id = od.get("incident_id") or inc_result.get("incident_id")
        result.incident_created = True
        _audit(pod, "incident.created", actor_type="system", actor_agent_name="signal-detector",
               resource_type="incident", resource_id=result.incident_id, signal_id=existing_signal_id,
               details={"ticket_count": ticket_count, "threshold": INCIDENT_TICKET_THRESHOLD})

    return result
