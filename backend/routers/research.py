import asyncio
import json
import logging
import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI

from backend.services.supabase_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/research", tags=["research"])

RESEARCH_PROMPT_TEMPLATE = (
    "Search the entire internet and give me recent blogs, articles, podcast appearances, "
    "featured videos or anything written by / published about {name} of {firm} within the "
    "last 48 months. I am writing an email with a personalization and I want to know of "
    "anything he wrote, talked about on a podcast or was featured in. Also see if they are "
    "leadership in any mass torts. Find me as many personal things as possible about this person. "
    "For every claim you make, include a working hyperlink to the actual source page. "
    "Do not use decorative separator lines made of dashes or box-drawing characters. "
    "Use markdown headers instead."
)

SYSTEM_SUFFIX = (
    " For every claim you make, include a working hyperlink to the actual source page."
    " Do not use decorative separator lines made of dashes or box-drawing characters."
    " Use markdown headers instead."
)

MAX_CONCURRENT = 5


def _run_research(prompt: str) -> str:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.responses.create(
        model="o3",
        tools=[{"type": "web_search_preview"}],
        input=prompt,
    )
    return response.output_text


def _store_research(first_name: str, last_name: str, firm_name: str, prompt: str, result_text: str):
    try:
        sb = get_client()
        insert_data: dict = {
            "firm_name": firm_name,
            "prompt_used": prompt,
            "result_text": result_text,
        }
        p_result = sb.table("prospects").select("id").eq(
            "first_name", first_name
        ).eq("last_name", last_name).limit(1).execute()
        if p_result.data:
            insert_data["prospect_id"] = p_result.data[0]["id"]
        else:
            new_p = sb.table("prospects").insert({
                "first_name": first_name,
                "last_name": last_name,
                "company_name": firm_name,
            }).execute()
            if new_p.data:
                insert_data["prospect_id"] = new_p.data[0]["id"]

        if "prospect_id" in insert_data:
            sb.table("research_results").insert(insert_data).execute()
    except Exception:
        logger.exception("Failed to store research result in Supabase")


class ResearchRequest(BaseModel):
    firstName: str
    lastName: str
    firmName: str
    prospectId: str | None = None
    customPrompt: str | None = None


class ResearchResponse(BaseModel):
    result: str
    promptUsed: str


class BatchRow(BaseModel):
    firstName: str
    lastName: str
    company: str = ""


class BatchResearchRequest(BaseModel):
    rows: list[BatchRow]
    promptTemplate: str = ""


@router.post("", response_model=ResearchResponse)
async def research_prospect(req: ResearchRequest):
    name = f"{req.firstName} {req.lastName}"
    prompt = req.customPrompt or RESEARCH_PROMPT_TEMPLATE.format(name=name, firm=req.firmName)

    loop = asyncio.get_event_loop()
    result_text = await loop.run_in_executor(None, _run_research, prompt)

    _store_research(req.firstName, req.lastName, req.firmName, prompt, result_text)

    return ResearchResponse(result=result_text, promptUsed=prompt)


@router.post("/batch")
async def research_batch(req: BatchResearchRequest):
    """Process selected rows concurrently, streaming results back via SSE."""
    rows = req.rows
    total = len(rows)
    template = req.promptTemplate.strip() or RESEARCH_PROMPT_TEMPLATE

    result_queue: asyncio.Queue = asyncio.Queue()
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def process_row(index: int, row: BatchRow):
        full_name = f"{row.firstName} {row.lastName}".strip()
        firm = row.company or "their firm"
        prompt = template.replace("{name}", full_name).replace("{firm}", firm) + SYSTEM_SUFFIX

        async with semaphore:
            try:
                loop = asyncio.get_event_loop()
                result_text = await loop.run_in_executor(None, _run_research, prompt)
                _store_research(row.firstName, row.lastName, row.company, prompt, result_text)
                await result_queue.put({
                    "type": "row_complete",
                    "index": index,
                    "total": total,
                    "result": {
                        "firstName": row.firstName,
                        "lastName": row.lastName,
                        "company": row.company,
                        "research": result_text,
                        "status": "done",
                    },
                })
            except Exception as e:
                logger.exception("Error researching %s", full_name)
                await result_queue.put({
                    "type": "row_complete",
                    "index": index,
                    "total": total,
                    "result": {
                        "firstName": row.firstName,
                        "lastName": row.lastName,
                        "company": row.company,
                        "research": f"ERROR: {e}",
                        "status": "error",
                    },
                })

    async def event_generator():
        tasks = [asyncio.create_task(process_row(i, row)) for i, row in enumerate(rows)]

        completed = 0
        while completed < total:
            item = await result_queue.get()
            completed += 1
            item["completed"] = completed
            yield _sse(item)

        await asyncio.gather(*tasks)

        yield _sse({"type": "complete", "total": total})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
