import time
import logging
import requests
from datetime import date

logger = logging.getLogger(__name__)

HOST = "pcl.uscourts.gov"
API_PATH = "/pcl-public-api/rest/parties/find"
FROM_DATE = "2024-01-01"
PAGE_PAUSE_SEC = 0.2

PRIORITY_COLS = [
    "courtId", "caseId", "caseYear", "caseNumber", "caseOffice", "caseType",
    "caseNumberFull", "caseTitle", "dateFiled", "dateTermed",
    "partyType", "partyRole", "lastName", "firstName", "middleName", "generation",
    "jurisdictionType", "natureOfSuit", "bankruptcyChapter", "disposition",
    "partyId",
]


def fetch_all_pages(first_name: str, last_name: str, ng_token: str) -> list[dict]:
    """Paginate through the PACER PCL parties API and return all page payloads."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-NEXT-GEN-CSO": ng_token,
    }
    base_url = f"https://{HOST}{API_PATH}"
    to_date = date.today().isoformat()
    payload = {
        "lastName": last_name,
        "firstName": first_name,
        "role": ["aty"],
        "courtCase": {
            "jurisdictionType": "mdl",
            "dateFiledFrom": FROM_DATE,
            "dateFiledTo": to_date,
        },
    }

    pages: list[dict] = []
    page = 0
    while True:
        resp = requests.post(
            base_url, headers=headers, params={"page": page}, json=payload, timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("content", []) or []
        logger.info("Page %d for %s %s: %d rows", page, first_name, last_name, len(content))
        pages.append(data)
        if not content:
            break
        page += 1
        time.sleep(PAGE_PAUSE_SEC)
    return pages


def _ordered(cols: list[str]) -> list[str]:
    seen: set[str] = set()
    result = [c for c in PRIORITY_COLS if c in cols and not (c in seen or seen.add(c))]
    result += [c for c in cols if c not in set(PRIORITY_COLS)]
    return result


def collect_headers(pages: list[dict]) -> tuple[list[str], list[str], list[str]]:
    top_keys: set[str] = set()
    case_keys: set[str] = set()
    for page in pages:
        for item in page.get("content", []) or []:
            for k in item.keys():
                if k != "courtCase":
                    top_keys.add(k)
            cc = item.get("courtCase") or {}
            for ck in cc.keys():
                case_keys.add(ck)
    top_cols = _ordered(sorted(top_keys))
    case_cols = _ordered(sorted(case_keys))
    headers = top_cols + [f"courtCase.{c}" for c in case_cols]
    return headers, top_cols, case_cols


def flatten_item(item: dict, top_cols: list[str], case_cols: list[str]) -> dict:
    row: dict = {}
    for k in top_cols:
        row[k] = item.get(k, None)
    cc = item.get("courtCase") or {}
    for ck in case_cols:
        row[f"courtCase.{ck}"] = cc.get(ck, None)
    return row


def count_total_rows(pages: list[dict]) -> int:
    total = 0
    for page in pages:
        content = page.get("content", []) or []
        total += len(content)
    return total


def pages_to_flat_rows(pages: list[dict]) -> tuple[list[str], list[dict]]:
    """Convert pages into a flat list of dicts suitable for CSV / JSON output.
    Returns (headers, rows).
    """
    headers, top_cols, case_cols = collect_headers(pages)
    rows: list[dict] = []
    for page in pages:
        for item in page.get("content", []) or []:
            rows.append(flatten_item(item, top_cols, case_cols))
    return headers, rows
