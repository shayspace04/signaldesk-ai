#input_type_name: TestLinearConnectorInput
#output_type_name: TestLinearConnectorOutput
#function_name: test_linear_connector
"""Test Linear connector by validating credentials or creating a temp test issue."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

LINEAR_TEAM_ID = "8016a82b-1e4c-40bc-b2c1-40c521897628"

class TestLinearConnectorInput(BaseModel):
    pass

class TestLinearConnectorOutput(BaseModel):
    connected: bool = False
    message: str = ""
    issue_url: Optional[str] = None

def _unwrap(r):
    """Extract dict from OperationExecutionResponse or similar SDK object."""
    if r is None: return {}
    # OperationExecutionResponse wraps result in .result attr
    r_inner = getattr(r, "result", r)
    if r_inner is not None and r_inner is not r:
        if hasattr(r_inner, "to_dict"): return r_inner.to_dict()
        if isinstance(r_inner, dict): return r_inner
        if hasattr(r_inner, "__dict__"): return r_inner.__dict__
    # Try to_dict
    if hasattr(r, "to_dict"): return r.to_dict()
    # Try data attr
    data = getattr(r, "data", r)
    if data is not None and data is not r:
        if hasattr(data, "to_dict"): return data.to_dict()
        if isinstance(data, dict): return data
        if hasattr(data, "__dict__"): return data.__dict__
    if hasattr(r, "__dict__"): return r.__dict__
    if isinstance(r, dict): return r
    return {}

async def test_linear_connector(ctx: FunctionContext, data: TestLinearConnectorInput) -> TestLinearConnectorOutput:
    pod = Pod.from_env()

    # Validate credential
    try:
        pod.connectors.execute("linear", "LINEAR_VALIDATE_CREDENTIAL", {})
    except Exception as e:
        return TestLinearConnectorOutput(
            connected=False,
            message=f"Authentication failed: {str(e)[:100]}",
        )

    # Create a test issue
    try:
        test_result = pod.connectors.execute("linear", "LINEAR_CREATE_LINEAR_ISSUE", {
            "title": "[TEST] SignalDesk Connector Test",
            "priority": 4,
            "team_id": LINEAR_TEAM_ID,
        })
        d = _unwrap(test_result)
        url = d.get("url") or d.get("ticket_url") or d.get("Ticket Url") or d.get("ticketUrl") or ""
        identifier = d.get("identifier") or d.get("id") or ""
        if identifier:
            return TestLinearConnectorOutput(
                connected=True,
                message=f"Connected. Test issue {identifier} created.",
                issue_url=url,
            )
    except Exception as e:
        return TestLinearConnectorOutput(
            connected=True,
            message=f"Connected. Cannot create test issue: {str(e)[:120]}",
        )

    return TestLinearConnectorOutput(
        connected=True,
        message="Connected. Test issue not created (no identifier returned).",
    )
