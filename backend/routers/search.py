import csv
import io
import json
import logging
import uuid
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.pacer import fetch_all_pages, count_total_rows, pages_to_flat_rows
from backend.services.summary import build_summary_from_rows
from backend.services.token_manager import get_current_token
from backend.services.supabase_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


class SingleSearchRequest(BaseModel):
    firstName: str
    lastName: str


class SingleSearchResponse(BaseModel):
    firstName: str
    lastName: str
    numCases: int
    summary: str
    cases: list[dict]


@router.post("/single", response_model=SingleSearchResponse)
async def search_single(req: SingleSearchRequest):
    token = await get_current_token()
    if not token:
        raise Exception("PACER token not available. Please wait for token refresh.")

    import asyncio
    loop = asyncio.get_event_loop()
    pages = await loop.run_in_executor(
        None, fetch_all_pages, req.firstName, req.lastName, token,
    )
    num_cases = count_total_rows(pages)
    headers, flat_rows = pages_to_flat_rows(pages)
    summary = build_summary_from_rows(flat_rows) if flat_rows else ""

    try:
        sb = get_client()
        prospect_data = {
            "first_name": req.firstName,
            "last_name": req.lastName,
            "num_cases": num_cases,
            "alg_output": summary,
        }
        result = sb.table("prospects").insert(prospect_data).execute()
        prospect_id = result.data[0]["id"] if result.data else None
        if prospect_id and flat_rows:
            sb.table("search_results").insert({
                "prospect_id": prospect_id,
                "raw_json": {"pages": pages},
                "csv_data": _rows_to_csv_string(headers, flat_rows),
            }).execute()
    except Exception:
        logger.exception("Failed to store single search results in Supabase")

    return SingleSearchResponse(
        firstName=req.firstName,
        lastName=req.lastName,
        numCases=num_cases,
        summary=summary,
        cases=flat_rows[:200],
    )


@router.post("/batch")
async def search_batch(file: UploadFile = File(...)):
    """Process a CSV of prospects via SSE, streaming progress events."""
    contents = await file.read()
    text = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    attendees = list(reader)
    total = len(attendees)

    async def event_generator():
        token = await get_current_token()
        if not token:
            yield _sse({"type": "error", "message": "PACER token not available"})
            return

        batch_id = None
        try:
            sb = get_client()
            batch_result = sb.table("batches").insert({
                "filename": file.filename or "upload.csv",
                "total_rows": total,
                "processed_rows": 0,
                "status": "processing",
            }).execute()
            batch_id = batch_result.data[0]["id"] if batch_result.data else None
        except Exception:
            logger.exception("Failed to create batch in Supabase")

        results = []
        import asyncio
        loop = asyncio.get_event_loop()

        for i, attendee in enumerate(attendees):
            first_name = (attendee.get("First Name", "") or "").strip()
            last_name = (attendee.get("Last Name", "") or "").strip()
            company = (attendee.get("Company Name", "") or "").strip()

            yield _sse({
                "type": "progress",
                "current": i + 1,
                "total": total,
                "name": f"{first_name} {last_name}",
            })

            if not first_name or not last_name:
                row_result = {
                    **attendee,
                    "Number of Cases": "0",
                    "Alg Output": "",
                }
                results.append(row_result)
                continue

            try:
                pages = await loop.run_in_executor(
                    None, fetch_all_pages, first_name, last_name, token,
                )
                num_cases = count_total_rows(pages)
                _headers, flat_rows = pages_to_flat_rows(pages)
                summary = build_summary_from_rows(flat_rows) if flat_rows else ""

                row_result = {
                    **attendee,
                    "Number of Cases": str(num_cases),
                    "Alg Output": summary,
                }
                results.append(row_result)

                try:
                    sb = get_client()
                    prospect_data = {
                        "first_name": first_name,
                        "last_name": last_name,
                        "company_name": company or None,
                        "num_cases": num_cases,
                        "alg_output": summary,
                        "batch_id": batch_id,
                    }
                    p_result = sb.table("prospects").insert(prospect_data).execute()
                    pid = p_result.data[0]["id"] if p_result.data else None
                    if pid and flat_rows:
                        csv_str = _rows_to_csv_string(_headers, flat_rows)
                        sb.table("search_results").insert({
                            "prospect_id": pid,
                            "raw_json": {"pages": pages},
                            "csv_data": csv_str,
                        }).execute()
                    if batch_id:
                        sb.table("batches").update({
                            "processed_rows": i + 1,
                        }).eq("id", batch_id).execute()
                except Exception:
                    logger.exception("Supabase insert failed for %s %s", first_name, last_name)

            except Exception as e:
                logger.exception("Error processing %s %s", first_name, last_name)
                row_result = {
                    **attendee,
                    "Number of Cases": "0",
                    "Alg Output": f"ERROR: {e}",
                }
                results.append(row_result)

        if batch_id:
            try:
                sb = get_client()
                sb.table("batches").update({
                    "processed_rows": total,
                    "status": "completed",
                }).eq("id", batch_id).execute()
            except Exception:
                pass

        output_fieldnames = list(results[0].keys()) if results else []
        for col in ["Number of Cases", "Alg Output"]:
            if col not in output_fieldnames:
                output_fieldnames.append(col)

        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=output_fieldnames)
        writer.writeheader()
        writer.writerows(results)

        prospect_list = []
        for r in results:
            prospect_list.append({
                "firstName": r.get("First Name", ""),
                "lastName": r.get("Last Name", ""),
                "company": r.get("Company Name", ""),
                "numCases": r.get("Number of Cases", "0"),
                "algOutput": r.get("Alg Output", ""),
            })

        yield _sse({
            "type": "complete",
            "csv": buf.getvalue(),
            "prospects": prospect_list,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _rows_to_csv_string(headers: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=headers)
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
