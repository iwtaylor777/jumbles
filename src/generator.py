# src/generator.py
"""
Daily Jumbles puzzle generator
------------------------------
• Expects a text file  data/words5.txt  (one 5-letter word per line, lowercase)
• Creates/updates   puzzles/YYYY-MM-DD.json
    {
      "id": "2025-07-18",
      "grid": [["R","A","E","L","E"], ...],
      "solution": ["FRAIL","CIDER","TRACK","LEAFY"]
    }
"""

from pathlib import Path
import random
import json
import datetime as dt
import sys

# ---------- Constants ---------------------------------------------------

ROOT        = Path(__file__).parent.parent          # repo root
WORD_FILE   = ROOT / "data" / "words5.txt"
PUZZLE_DIR  = ROOT / "puzzles"

WORD_COUNT  = 4
WORD_LEN    = 5

# ---------- Load word list ---------------------------------------------

try:
    WORDS = [w.strip().upper() for w in WORD_FILE.read_text().splitlines() if len(w.strip()) == WORD_LEN]
except FileNotFoundError:
    sys.exit(f"[generator] Cannot find word list at {WORD_FILE}")

if len(WORDS) < 1000:
    sys.exit("[generator] Word list looks too small; aborting.")

# ---------- Helper functions -------------------------------------------


def choose_words() -> list[str]:
    """Pick 4 distinct words."""
    return random.sample(WORDS, WORD_COUNT)

def scramble(words: list[str]) -> list[list[str]]:
    """Return a 4×5 scrambled grid guaranteed not to start solved."""
    flat = [ch for w in words for ch in w]          # 20 letters
    while True:
        random.shuffle(flat)
        grid = [flat[i * WORD_LEN : (i + 1) * WORD_LEN] for i in range(WORD_COUNT)]
        if all("".join(row) not in words for row in grid):   # not already solved
            return grid

# ---------- Main generator ---------------------------------------------

def generate_puzzle() -> dict:
    solution = choose_words()
    grid     = scramble(solution)
    return {"id": dt.date.today().isoformat(),
            "grid": grid,
            "solution": solution}

def generate_puzzle_for_date(d: dt.date) -> dict:
    solution = choose_words()
    grid = scramble(solution)
    return {"id": d.isoformat(), "grid": grid, "solution": solution}

def save(puzzle: dict) -> Path:
    PUZZLE_DIR.mkdir(exist_ok=True)
    path = PUZZLE_DIR / f"{puzzle['id']}.json"
    path.write_text(json.dumps(puzzle, indent=2))
    return path

# ---------- CLI entry ---------------------------------------------------

if __name__ == "__main__":
    utc_today = dt.datetime.utcnow().date()
    utc_yday  = utc_today - dt.timedelta(days=1)

    for day in (utc_yday, utc_today):
        puzzle = generate_puzzle_for_date(day)
        save(puzzle)          # your existing save() already names file <id>.json

    print("[generator] Wrote puzzles for", utc_yday, "and", utc_today)
