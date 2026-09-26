"""FastAPI app. Run: uvicorn pharmaclash.api:app --reload --port 8000"""
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pharmaclash.data import load_drugs
from pharmaclash.engine import analyze
from pharmaclash.explain import explain
from pharmaclash.optimizer import optimize

# Populate os.environ from .env if present; the key itself is only read at request time.
load_dotenv(override=False)


class RegimenIn(BaseModel):
    regimen: list[str]


class OptimizeIn(BaseModel):
    regimen: list[str]
    locked: list[str] = Field(default_factory=list)


app = FastAPI(title="PharmaClash", description="Educational prototype. Not for clinical use.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
router = APIRouter(prefix="/api")

DRUG_FIELDS = ("id", "name", "brand", "class", "qt_risk", "acb_score", "bleeding_risk", "alternatives")


@router.get("/drugs")
def list_drugs() -> list[dict]:
    drugs = sorted(load_drugs().values(), key=lambda d: d["name"].lower())
    return [{k: d[k] for k in DRUG_FIELDS} for d in drugs]


@router.post("/analyze")
def analyze_route(body: RegimenIn) -> dict:
    return analyze(body.regimen)


@router.post("/optimize")
def optimize_route(body: OptimizeIn) -> dict:
    return optimize(body.regimen, locked=body.locked)


@router.post("/explain")
def explain_route(body: RegimenIn) -> dict:
    return explain(body.regimen)


app.include_router(router)
