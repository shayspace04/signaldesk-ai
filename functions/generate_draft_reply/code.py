#input_type_name: GenerateDraftReplyInput
#output_type_name: GenerateDraftReplyOutput
#function_name: generate_draft_reply
"""Generate an AI draft reply for a ticket using the reply-agent, persist as a pending draft, and update ticket status."""
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _audit(pod, action, actor_type="agent", actor_user_id=None, actor_agent_name=None,
           resource_type=None, resource_id=None, ticket_id=None, details=None):
    try:
        row = {"actor_type": actor_type, "action": action}
        if actor_user_id: row["actor_user_id"] = actor_user_id
        if actor_agent_name: row["actor_agent_name"] = actor_agent_name
        if resource_type: row["resource_type"] = resource_type
        if resource_id: row["resource_id"] = str(resource_id)
        if ticket_id: row["ticket_id"] = str(ticket_id)
        if details is not None: row["details"] = details
        pod.records.create("audit_logs", row)
    except Exception:
        pass

class Grounding(BaseModel):
    path: str
    snippet: str
    page: Optional[int] = None

class GenerateDraftReplyInput(BaseModel):
    ticket_id: str

class GenerateDraftReplyOutput(BaseModel):
    draft_id: str
    ticket_id: str
    body: str
    confidence: int
    ticket_number: Optional[int] = None

async def generate_draft_reply(ctx: FunctionContext, data: GenerateDraftReplyInput) -> GenerateDraftReplyOutput:
    pod = Pod.from_env()
    ticket = pod.records.get("tickets", data.ticket_id)
    if not ticket:
        raise RuntimeError(f"ticket {data.ticket_id} not found")

    ticket_number = ticket.get("number")
    customer_name = ticket.get("customer_name") or ticket.get("customer_email", "Valued Customer")
    title = ticket.get("title", "your inquiry")

    # Invoke reply-agent for a real AI-generated draft
    agent_result = await pod.agents.execute(
        agent_name="reply-agent",
        input={
            "ticket_id": data.ticket_id,
            "customer_name": customer_name,
            "title": title,
            "body": ticket.get("body", ""),
            "category": ticket.get("category", "general"),
            "priority": ticket.get("priority", "normal"),
        },
    )

    reply_body = agent_result.get("body", "")
    confidence = agent_result.get("confidence", 85)
    grounded_in = agent_result.get("grounded_in", [{"path": f"tickets/{data.ticket_id}", "snippet": title}])

    now = datetime.now(timezone.utc).isoformat()
    draft = pod.records.create("drafts", {
        "ticket_id": data.ticket_id,
        "ticket_number": ticket_number,
        "body": reply_body,
        "grounded_in": grounded_in,
        "confidence": confidence,
        "status": "pending",
        "generated_at": now,
    })

    pod.records.update("tickets", data.ticket_id, {"status": "waiting_approval"})

    _audit(pod, "draft.generated", actor_type="agent", actor_agent_name="reply-agent",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="draft", resource_id=draft["id"], ticket_id=data.ticket_id,
           details={"ticket_number": ticket_number, "confidence": confidence, "agent": "reply-agent"})

    return GenerateDraftReplyOutput(
        draft_id=draft["id"],
        ticket_id=data.ticket_id,
        body=reply_body,
        confidence=confidence,
        ticket_number=ticket_number,
    )
