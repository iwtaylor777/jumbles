import json
import datetime as dt
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

PUZZLE_DIR = Path(__file__).parent.parent / "puzzles"

app = FastAPI(title="Jumbles API", version="0.1.0")

# --- CORS (update origins once you know your frontend host) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # local dev
        "http://localhost:5173",
        # every *.vercel.app preview build
        "https://*.vercel.app",
        # optionally your custom domain
        "https://jumblesgame.com",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ------------------- ROUTES -------------------

@app.get("/puzzle/today")
def get_today_puzzle():
    """Return today's puzzle JSON (without the solution)."""
    today = dt.date.today().isoformat()
    path = PUZZLE_DIR / f"{today}.json"

    if not path.exists():
        raise HTTPException(status_code=404, detail="Today's puzzle not found")

    with path.open() as f:
        data = json.load(f)

    # hide the answers before sending to the client
    data_filtered = {
        "id": today,
        "grid": data["grid"],
    }
    return data_filtered

