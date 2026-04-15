import asyncio
import logging
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

_current_token: str | None = None
_token_lock = asyncio.Lock()
_refresh_task: asyncio.Task | None = None

AUTH_URL = "https://pacer.login.uscourts.gov/services/cso-auth"
REFRESH_INTERVAL_SEC = 25 * 60  # 25 minutes


async def refresh_ng_token(login_id: str, password: str) -> str:
    """POST to PACER CSO auth endpoint and extract the nextGenCSO token."""
    global _current_token

    def _do_refresh():
        resp = requests.post(
            AUTH_URL,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            json={"loginId": login_id, "password": password},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("nextGenCSO") or data.get("token") or data.get("loginResult", "")

    loop = asyncio.get_event_loop()
    token = await loop.run_in_executor(None, _do_refresh)

    async with _token_lock:
        _current_token = token
        logger.info("NG token refreshed at %s", datetime.utcnow().isoformat())

    return token


async def get_current_token() -> str | None:
    async with _token_lock:
        return _current_token


async def _refresh_loop(login_id: str, password: str):
    while True:
        try:
            await refresh_ng_token(login_id, password)
        except Exception:
            logger.exception("Failed to refresh NG token")
        await asyncio.sleep(REFRESH_INTERVAL_SEC)


async def start_token_refresh(login_id: str, password: str):
    """Kick off an initial refresh then schedule recurring refreshes."""
    global _refresh_task
    await refresh_ng_token(login_id, password)
    _refresh_task = asyncio.create_task(_refresh_loop(login_id, password))


def stop_token_refresh():
    global _refresh_task
    if _refresh_task:
        _refresh_task.cancel()
        _refresh_task = None
