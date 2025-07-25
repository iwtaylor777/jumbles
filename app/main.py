# src/app/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timedelta
import pytz
import json

# where your puzzle‐JSON lives
PUZZLE_DIR = Path(__file__).resolve().parent.parent / "puzzles"

# your timezone for “today”
LOCAL_TZ = pytz.timezone("America/New_York")  # ← adjust as needed

class Puzzle(BaseModel):
    id: str
    grid: list[list[str]]
    solution: list[str]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # lock this down in prod!
    allow_methods=["GET"],
    allow_headers=["*"],
)

def _load(date_str: str) -> dict:
    # debug so you can see in Render logs exactly which date we're loading
    print(f"DEBUG loading puzzle for date: {date_str}", flush=True)

    p = PUZZLE_DIR / f"{date_str}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not Found")
    return json.loads(p.read_text())

@app.get("/puzzle/{date}", response_model=Puzzle)
def by_date(date: str):
    return _load(date)

@app.get("/puzzle/today", response_model=Puzzle)
def today():
    # 1) try your local‐tz date
    local_date = datetime.now(LOCAL_TZ).date()
    try:
        return _load(local_date.isoformat())
    except HTTPException:
        # 2) fallback to UTC date if different
        utc_date = datetime.utcnow().date()
        if utc_date != local_date:
            try:
                return _load(utc_date.isoformat())
            except HTTPException:
                pass
        # 3) ultimate fallback: yesterday (UTC)
        yest = (utc_date - timedelta(days=1)).isoformat()
        return _load(yest)



