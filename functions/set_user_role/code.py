#input_type_name: SetUserRoleInput
#output_type_name: SetUserRoleOutput
#function_name: set_user_role
"""Set the role for the current user in the user_roles table."""
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class SetUserRoleInput(BaseModel):
    role: str

class SetUserRoleOutput(BaseModel):
    user_id: str
    role: str

async def set_user_role(ctx: FunctionContext, data: SetUserRoleInput) -> SetUserRoleOutput:
    pod = Pod.from_env()
    user_id = str(ctx.user_id) if ctx.user_id else "anonymous"
    valid_roles = ["support_agent", "support_manager"]
    if data.role not in valid_roles:
        raise RuntimeError(f"Invalid role: {data.role}. Must be one of {valid_roles}")
    try:
        existing = pod.records.list("user_roles", {"filters": {"user_id": user_id}, "limit": 1})
        items = existing.get("items") or existing.get("data") or []
        if items:
            pod.records.update("user_roles", items[0]["id"], {"role": data.role})
        else:
            pod.records.create("user_roles", {"user_id": user_id, "role": data.role})
    except Exception as exc:
        raise RuntimeError(f"Failed to set role: {exc}")
    return SetUserRoleOutput(user_id=user_id, role=data.role)
