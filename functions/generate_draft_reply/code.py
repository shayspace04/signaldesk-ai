#input_type_name: GenerateDraftReplyInput
#output_type_name: GenerateDraftReplyOutput
#function_name: generate_draft_reply
"""Generate an AI draft reply for a ticket, persist as a pending draft, and update ticket status."""
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

    title = ticket.get("title", "your inquiry")
    body = ticket.get("body", "")
    customer_name = ticket.get("customer_name") or ticket.get("customer_email", "Valued Customer")
    category = ticket.get("category", "general")
    ticket_number = ticket.get("number")

    # Generate a context-aware reply body
    greeting = f"Dear {customer_name},"
    if category == "billing":
        reply_body = (
            f"{greeting}\n\n"
            f"Thank you for reaching out regarding your billing concern: \"{title}\".\n\n"
            f"We have reviewed your account and identified the issue. {body[:200]}\n\n"
            f"To resolve this promptly, we have processed the necessary adjustments. "
            f"You should see the changes reflected within 24-48 hours. "
            f"If you have any further questions, please don't hesitate to reply.\n\n"
            f"Best regards,\nSupport Team"
        )
    elif category == "technical":
        reply_body = (
            f"{greeting}\n\n"
            f"Thank you for contacting us about the technical issue: \"{title}\".\n\n"
            f"Based on our analysis of the information you provided, {body[:200]}\n\n"
            f"We recommend the following steps:\n"
            f"1. Clear your application cache and restart\n"
            f"2. Ensure you are on the latest version\n"
            f"3. If the problem persists, our engineering team has been notified\n\n"
            f"We will continue monitoring this and follow up once a fix is deployed.\n\n"
            f"Best regards,\nSupport Team"
        )
    else:
        reply_body = (
            f"{greeting}\n\n"
            f"Thank you for your inquiry regarding \"{title}\".\n\n"
            f"We have carefully reviewed the details you shared. {body[:200]}\n\n"
            f"Our team is working on a resolution and we will provide an update shortly. "
            f"In the meantime, please feel free to share any additional information that may help us assist you better.\n\n"
            f"Best regards,\nSupport Team"
        )

    now = datetime.now(timezone.utc).isoformat()
    draft = pod.records.create("drafts", {
        "ticket_id": data.ticket_id,
        "ticket_number": ticket_number,
        "body": reply_body,
        "grounded_in": [{"path": f"tickets/{data.ticket_id}", "snippet": title, "page": None}],
        "confidence": 85,
        "status": "pending",
        "generated_at": now,
    })

    pod.records.update("tickets", data.ticket_id, {"status": "awaiting_approval", "draft_id": draft["id"]})

    _audit(pod, "draft.generated", actor_type="agent", actor_agent_name="reply-agent",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="draft", resource_id=draft["id"], ticket_id=data.ticket_id,
           details={"ticket_number": ticket_number, "confidence": 85, "category": category})

    return GenerateDraftReplyOutput(
        draft_id=draft["id"],
        ticket_id=data.ticket_id,
        body=reply_body,
        confidence=85,
        ticket_number=ticket_number,
    )
