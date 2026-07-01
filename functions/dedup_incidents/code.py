#input_type_name: DedupIncidentsInput
#output_type_name: DedupIncidentsOutput
#function_name: dedup_incidents
"""Dedup existing duplicate incidents by signal_id."""
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class DedupIncidentsInput(BaseModel):
    dry_run: bool = True
    signal_id_filter: Optional[str] = None

class MergeReport(BaseModel):
    kept_id: str
    removed_ids: List[str]
    signal_id: str
    merged_ticket_count: int = 0

class DedupIncidentsOutput(BaseModel):
    total_checked: int
    duplicates_found: int
    merges_performed: int
    reports: List[MergeReport]

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

async def dedup_incidents(ctx: FunctionContext, data: DedupIncidentsInput) -> DedupIncidentsOutput:
    pod = Pod.from_env()
    now = datetime.now(timezone.utc).isoformat()

    raw = pod.records.list("incidents", limit=5000)
    all_incidents = _items(raw)
    total_checked = len(all_incidents)

    groups = {}
    for inc in all_incidents:
        sid = inc.get("signal_id")
        if not sid:
            continue
        groups.setdefault(sid, []).append(inc)

    duplicates_found = 0
    merges_performed = 0
    reports = []

    print(f"Found {total_checked} incidents total, {len(groups)} unique signal_ids")

    for signal_id, group in groups.items():
        if len(group) < 2:
            continue
        duplicates_found += len(group) - 1
        group.sort(key=lambda r: r.get("created_at", "") or "")
        keeper = group[0]
        dupes = group[1:]
        orig_ticket_count = keeper.get("affected_ticket_count", 0) or 0
        merged_tickets = 0

        for dupe in dupes:
            merged_tickets += dupe.get("affected_ticket_count", 0) or 0
            # Merge blast_radius
            dupe_br = dupe.get("blast_radius", "") or ""
            if dupe_br and dupe_br not in (keeper.get("blast_radius", "") or ""):
                cur_br = keeper.get("blast_radius", "") or ""
                keeper["blast_radius"] = (cur_br + "; " + dupe_br) if cur_br else dupe_br
            if not data.dry_run:
                try:
                    # Link tickets via ticket_incidents from dupe → keeper
                    tix = _items(pod.records.list("ticket_incidents", filter=[
                        {"field": "incident_id", "op": "eq", "value": dupe["id"]},
                    ]))
                    for ti in tix:
                        pod.records.update("ticket_incidents", ti["id"],
                                           {"incident_id": keeper["id"]})
                    # Delete the duplicate
                    pod.records.delete("incidents", dupe["id"])
                except Exception as e:
                    print(f"Error processing dupe {dupe.get('id')}: {e}")

        new_count = orig_ticket_count + merged_tickets
        upd = {"affected_ticket_count": new_count, "last_detected_at": now}
        if keeper.get("blast_radius"):
            upd["blast_radius"] = keeper["blast_radius"]
        if not data.dry_run:
            try:
                pod.records.update("incidents", keeper["id"], upd)
            except Exception as e:
                print(f"Error updating keeper {keeper['id']}: {e}")

        merges_performed += 1 if not data.dry_run else 0
        reports.append(MergeReport(
            kept_id=keeper["id"],
            removed_ids=[d["id"] for d in dupes],
            signal_id=signal_id,
            merged_ticket_count=merged_tickets,
        ))

        if not data.dry_run:
            try:
                pod.records.create("audit_logs", {
                    "role": "system",
                    "action": "incidents.deduped",
                    "details": {
                        "signal_id": signal_id,
                        "kept_id": keeper["id"],
                        "merged_from": [d["id"] for d in dupes],
                        "merged_tickets": merged_tickets,
                        "keeper_tickets": new_count,
                    },
                })
            except Exception:
                pass

    return DedupIncidentsOutput(
        total_checked=total_checked,
        duplicates_found=duplicates_found,
        merges_performed=merges_performed,
        reports=reports,
    )
