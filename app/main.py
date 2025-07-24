# app/main.py  ----------------------------------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import datetime as dt, json

PUZZLE_DIR = Path(__file__).resolve().parent.parent / "puzzles"

class Puzzle(BaseModel):
    id: str
    grid: list[list[str]]
    solution: list[str]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # or restrict to your front‑end origin
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---------- helper ------------------------------------------------
def _load(date: str) -> dict:
    file = PUZZLE_DIR / f"{date}.json"
    if not file.exists():
        raise HTTPException(status_code=404, detail="Not Found")
    return json.loads(file.read_text())

# ---------- routes ------------------------------------------------
@app.get("/puzzle/{date}", response_model=Puzzle)
def by_date(date: str):
    return _load(date)

@app.get("/puzzle/today", response_model=Puzzle)
def today():
    return _load(dt.date.today().isoformat())


