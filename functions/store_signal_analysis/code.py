#input_type_name: StoreSignalAnalysisInput
#output_type_name: StoreSignalAnalysisResult
#function_name: store_signal_analysis
"""Persist the memory-agent's root cause analysis onto the signals row + audit log."""
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class StoreSignalAnalysisInput(BaseModel):
    signal_id: str
    root_cause: Optional[str] = None
    suggested_action: Optional[str] = None
    analysis_confidence: Optional[int] = None
    expected_impact: Optional[str] = None
    business_priority: Optional[str] = None
    supporting_evidence: Optional[List[dict]] = None


class StoreSignalAnalysisResult(BaseModel):
    ok: bool
    signal_id: str
    updated_fields: List[str] = []


async def store_signal_analysis(ctx: FunctionContext, data: StoreSignalAnalysisInput) -> StoreSignalAnalysisResult:
    pod = Pod.from_env()

    # Read current signal (for name + audit context). SDK records API is synchronous.
    sig = pod.records.get("signals", data.signal_id)
    sig_name = sig.get("name", "") if sig else ""

    field_map = {
        "root_cause": data.root_cause,
        "suggested_action": data.suggested_action,
        "analysis_confidence": data.analysis_confidence,
        "expected_impact": data.expected_impact,
        "business_priority": data.business_priority,
    }
    updated_fields = [k for k, v in field_map.items() if v is not None and v != ""]
    if not updated_fields:
        return StoreSignalAnalysisResult(ok=False, signal_id=data.signal_id, updated_fields=[])

    update = {k: v for k, v in field_map.items() if v is not None and v != ""}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    pod.records.update("signals", data.signal_id, update)

    # Audit log
    try:
        pod.records.create("audit_logs", {
            "actor_type": "AGENT",
            "actor_agent_name": "memory-agent",
            "action": "signal.analyzed",
            "resource_type": "signal",
            "resource_id": data.signal_id,
            "signal_id": data.signal_id,
            "details": {
                "signal_name": sig_name,
                "root_cause": data.root_cause or "",
                "suggested_action": data.suggested_action or "",
                "analysis_confidence": data.analysis_confidence if data.analysis_confidence is not None else 0,
                "expected_impact": data.expected_impact or "",
                "business_priority": data.business_priority or "",
                "fields_written": updated_fields,
            },
        })
    except Exception:
        pass

    return StoreSignalAnalysisResult(ok=True, signal_id=data.signal_id, updated_fields=updated_fields)
