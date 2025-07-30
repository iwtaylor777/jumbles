# ---------------------------------------------------------------------------
#  src/generator.py  – Jumbles puzzle generator (TODAY  +  TOMORROW)
# ---------------------------------------------------------------------------
"""
• Expects a 5-letter word list:  data/words5.txt  (1 word / line, lowercase)
• Writes  puzzles/YYYY-MM-DD.json  *and*  YYYY-MM-(DD+1).json, each:
    {
      "id": "2025-07-24",
      "grid": [["R","A","E","L","E"], ...],
      "solution": ["FRAIL","CIDER","TRACK","LEAFY"]
    }
"""

from pathlib import Path
import random, json, sys, datetime as dt

ROOT        = Path(__file__).resolve().parent.parent
WORD_FILE   = ROOT / "data" / "words5_clean.txt"
PUZZLE_DIR  = ROOT / "puzzles"

WORD_COUNT      = 4       # 4 words per puzzle
MAX_ATTEMPTS    = 200     # safety loop when building a puzzle


# ------------------------------------------------------------------ helpers
def load_vocab() -> list[str]:
    """Read words5.txt → list of 5-letter uppercase words."""
    if not WORD_FILE.exists():
        sys.exit(f"Missing word list: {WORD_FILE}")

    words = [
        w.strip().upper()
        for w in WORD_FILE.read_text().splitlines()
        if len(w.strip()) == 5 and w.isalpha()
    ]
    if len(words) < 4000:
        sys.exit("word list looks too small: aborting")
    return words


def build_puzzle(rng: random.Random, vocab: list[str]):
    """Pick 4 distinct words and return (shuffled grid, solution list)."""
    words = rng.sample(vocab, WORD_COUNT)
    # simple first version: shuffle each word’s letters
    grid  = [list(rng.sample(word, len(word))) for word in words]
    return grid, words


def write_puzzle(date: dt.date, grid, solution):
    out = PUZZLE_DIR / f"{date.isoformat()}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"id": date.isoformat(), "grid": grid, "solution": solution}
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print("✅ wrote", out.relative_to(ROOT))


# ------------------------------------------------------------------ main
def main():
    vocab = load_vocab()
    rng   = random.Random()

    today = dt.date.today()

    # generate *today* and *tomorrow*
    for delta in (0, 1):
        day = today + dt.timedelta(days=delta)

        # build a puzzle (add smarter rejection if desired)
        for _ in range(MAX_ATTEMPTS):
            grid, sol = build_puzzle(rng, vocab)
            break

        write_puzzle(day, grid, sol)


if __name__ == "__main__":
    main()

