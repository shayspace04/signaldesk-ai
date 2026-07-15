#input_type_name: SendApprovedReplyInput
#output_type_name: SendApprovedReplyOutput
#function_name: send_approved_reply
"""Send the approved draft reply to the customer via Gmail, then mark the draft as sent."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

def _audit(pod, action, actor_type="user", actor_user_id=None, actor_agent_name=None,
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

class SendApprovedReplyInput(BaseModel):
    draft_id: str
    ticket_id: str
    channel: Optional[str] = "email"

class SendApprovedReplyOutput(BaseModel):
    draft_id: str
    ticket_id: str
    sent_at: str
    email_sent: bool = False

async def send_approved_reply(ctx: FunctionContext, data: SendApprovedReplyInput) -> SendApprovedReplyOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()

    draft = pod.records.get("drafts", data.draft_id)
    if not draft:
        raise RuntimeError(f"draft {data.draft_id} not found")
    if draft.get("status") != "approved":
        raise RuntimeError("draft must be approved before sending")

    ticket = pod.records.get("tickets", data.ticket_id)
    ticket_number = ticket.get("number") if ticket else None
    customer_email = ticket.get("customer_email") if ticket else None

    email_sent = False
    draft_body = draft.get("body", "")
    subject = f"Re: {ticket.get('title', 'Your Support Request')}" if ticket else "Re: Your Support Request"

    if customer_email:
        try:
            pod.connectors.execute("gmail", "GMAIL_SEND_EMAIL", {
                "to": customer_email,
                "subject": subject,
                "body": draft_body,
            })
            email_sent = True
        except Exception as e:
            _audit(pod, "draft.send_email_failed", actor_type="user",
                   actor_user_id=str(ctx.user_id) if ctx.user_id else None,
                   resource_type="draft", resource_id=data.draft_id, ticket_id=data.ticket_id,
                   details={"error": str(e)[:200], "customer_email": customer_email})

    pod.records.update("drafts", data.draft_id, {"status": "sent", "sent_at": now, "email_sent": email_sent})

    _audit(pod, "draft.sent", actor_type="user",
           actor_user_id=str(ctx.user_id) if ctx.user_id else None,
           resource_type="draft", resource_id=data.draft_id, ticket_id=data.ticket_id,
           details={"channel": data.channel, "ticket_number": ticket_number, "email_sent": email_sent})

    return SendApprovedReplyOutput(draft_id=data.draft_id, ticket_id=data.ticket_id, sent_at=now, email_sent=email_sent)
