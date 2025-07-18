import random
from pathlib import Path
import json
from wordfreq import top_n_list

WORD_COUNT_PER_PUZZLE = 4
WORD_LENGTH = 5
PUZZLE_DIR = Path(__file__).parent.parent / "puzzles"


def get_word_list(limit=5000):
    """Return a cleaned list of common 5-letter words."""
    raw = top_n_list("en", limit)
    return [w.upper() for w in raw if len(w) == WORD_LENGTH and w.isalpha()]


def choose_words(words, k=WORD_COUNT_PER_PUZZLE):
    return random.sample(words, k=k)


def scramble(words):
    letters = [c for w in words for c in w]
    while True:
        random.shuffle(letters)
        grid = [letters[i*WORD_LENGTH:(i+1)*WORD_LENGTH] for i in range(WORD_COUNT_PER_PUZZLE)]
        # ensure not already solved
        if all(''.join(row) not in words for row in grid):
            return grid


def generate_puzzle():
    wordlist = get_word_list()
    solution = choose_words(wordlist)
    grid = scramble(solution)
    return {"solution": solution, "grid": grid}


def save_puzzle(puzzle, date_str):
    PUZZLE_DIR.mkdir(exist_ok=True)
    path = PUZZLE_DIR / f"{date_str}.json"
    with path.open("w") as f:
        json.dump(puzzle, f, indent=2)
    print(f"Puzzle saved to {path.relative_to(Path.cwd())}")


if __name__ == "__main__":
    import datetime as dt
    today = dt.date.today().isoformat()
    puzzle = generate_puzzle()
    save_puzzle(puzzle, today)

