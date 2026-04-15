import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from backend.services.token_manager import start_token_refresh, stop_token_refresh
from backend.routers.search import router as search_router
from backend.routers.research import router as research_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    login_id = os.environ.get("PACER_LOGIN_ID", "")
    password = os.environ.get("PACER_PASSWORD", "")
    if login_id and password:
        await start_token_refresh(login_id, password)
    else:
        logging.warning("PACER credentials not set -- token refresh disabled")
    yield
    stop_token_refresh()


app = FastAPI(title="Kalinda GTM", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(research_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
