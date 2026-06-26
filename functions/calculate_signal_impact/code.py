#input_type_name: CalculateSignalImpactInput
#output_type_name: CalculateSignalImpactOutput
#function_name: calculate_signal_impact
"""Calculate and store impact scores for a signal based on its evidence tickets."""
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class CalculateSignalImpactInput(BaseModel):
    signal_id: str

class CalculateSignalImpactOutput(BaseModel):
    signal_id: str
    frequency_score: int
    customer_impact_score: int
    business_impact_score: int
    priority_score: int
    affected_customer_count: int

# Business risk weights by category
CATEGORY_RISK = {
    "payment": 95, "security": 98, "billing": 85, "refund": 70,
    "login": 75, "bug": 60, "feature": 30, "shipping": 65,
    "account": 55, "general": 40,
}

async def calculate_signal_impact(ctx: FunctionContext, data: CalculateSignalImpactInput) -> CalculateSignalImpactOutput:
    pod = Pod.from_env()
    sig = pod.records.get("signals", data.signal_id)
    if not sig:
        raise RuntimeError(f"signal {data.signal_id} not found")

    # Count evidence tickets linked to this signal
    try:
        ticket_rows = pod.records.list("tickets", filter=[{"field": "signal_id", "op": "eq", "value": data.signal_id}], limit=200)
        evidence_tickets = [item.to_dict() for item in ticket_rows.items] if hasattr(ticket_rows, "items") else []
    except Exception:
        evidence_tickets = []

    freq = len(evidence_tickets) if evidence_tickets else sig.get("evidence_count", 0)

    # Count unique affected customers
    customers = set()
    for t in (evidence_tickets or []):
        email = t.get("customer_email")
        if email:
            customers.add(email)
    affected = len(customers) if customers else 0

    # Frequency score: raw count, capped at 100
    frequency_score = min(freq * 5, 100) if freq > 0 else 0

    # Customer impact: each customer adds weight
    customer_impact_score = min(affected * 8, 100) if affected > 0 else 0

    # Business impact: based on category + priority
    category = (sig.get("category") or "general").lower()
    base_risk = CATEGORY_RISK.get(category, 40)
    priority = sig.get("proposed_priority", "normal")
    priority_boost = {"urgent": 15, "high": 10, "normal": 0, "low": -10}.get(priority, 0)
    business_impact_score = max(0, min(100, base_risk + priority_boost))

    # Priority score: weighted combination
    priority_score = int(0.35 * frequency_score + 0.30 * customer_impact_score + 0.35 * business_impact_score)
    priority_score = max(0, min(100, priority_score))

    # Store scores on the signal
    pod.records.update("signals", data.signal_id, {
        "frequency_score": frequency_score,
        "customer_impact_score": customer_impact_score,
        "business_impact_score": business_impact_score,
        "priority_score": priority_score,
        "affected_customer_count": affected,
    })

    return CalculateSignalImpactOutput(
        signal_id=data.signal_id,
        frequency_score=frequency_score,
        customer_impact_score=customer_impact_score,
        business_impact_score=business_impact_score,
        priority_score=priority_score,
        affected_customer_count=affected,
    )
