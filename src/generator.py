"""
Daily Jumbles puzzle generator
==============================

* Requires  data/words5.txt  – one lowercase 5-letter word per line.
* Writes     puzzles/YYYY-MM-DD.json
    {
      "id": "2025-07-24",
      "grid": [
         ["R","A","E","L","E"],
         ...
      ],
      "solution": ["FRAIL","CIDER","TRACK","LEAFY"]
    }
"""

from pathlib import Path
import random, json, datetime as dt, sys

ROOT        = Path(__file__).resolve().parent.parent   # repo root
WORD_FILE   = ROOT / "data" / "words5.txt"
PUZZLE_DIR  = ROOT / "puzzles"
WORD_COUNT  = 4                # 4 rows
MAX_TRIES   = 500

# ------------------------------------------------------------------ helpers
def load_word_list() -> list[str]:
    if not WORD_FILE.exists():
        sys.exit(f"❌ word list missing: {WORD_FILE}")
    words = [w.strip().lower() for w in WORD_FILE.read_text().splitlines()
             if len(w.strip()) == 5 and w.isalpha()]
    if len(words) < 5000:
        sys.exit("❌ word list too small (<5 000 words)")
    return words

def pick_words(pool: list[str]) -> list[str]:
    """Pick DISTINCT 5-letter words until we find 4 that share no duplicate row
    when scrambled (to avoid obvious giveaways)."""
    for _ in range(MAX_TRIES):
        sample = random.sample(pool, WORD_COUNT)
        # accept immediately (you can add extra difficulty checks here)
        return sample
    raise RuntimeError("could not pick words")

def scramble_words(words: list[str]) -> list[str]:
    """Return new list with letters shuffled inside each word."""
    scrambled = []
    for w in words:
        letters = list(w.upper())
        random.shuffle(letters)
        scrambled.append("".join(letters))
    return scrambled

# ------------------------------------------------------------------ main
def main(today: dt.date):
    words      = load_word_list()
    originals  = pick_words(words)                 # ['frail', 'cider', ...]
    scrambled  = scramble_words(originals)         # ['RFAIL', ...] order random

    puzzle = {
        "id": today.isoformat(),
        "grid": [list(w) for w in scrambled],      # 4 × 5 char arrays
        "solution": [w.upper() for w in originals] # original words, uppercase
    }

    # sanity-check: always 4×5 grid + 4-word solution
    assert len(puzzle["grid"]) == 4
    assert all(len(r) == 5 for r in puzzle["grid"])
    assert len(puzzle["solution"]) == 4
    assert all(len(s) == 5 for s in puzzle["solution"])

    PUZZLE_DIR.mkdir(exist_ok=True)
    out_file = PUZZLE_DIR / f"{puzzle['id']}.json"
    out_file.write_text(json.dumps(puzzle, indent=2))
    print(f"✅  wrote {out_file}")

if __name__ == "__main__":
    main(dt.date.today())

