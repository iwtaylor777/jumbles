"""
Generate the Jumbles launch batch.

I (as constructor/editor) supply the creative part -- a bonus answer + a witty
clue.  construct.py finds 4 common words + circled positions that spell it.
Every puzzle is then re-validated before it ships.

Writes app-importable  data/puzzles.json  (array, one per day from START_DATE).
"""
from __future__ import annotations
from collections import Counter
from pathlib import Path
import json, datetime as dt

from construct import load_pool, build_puzzle, POOL_PATH

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "puzzles.json"
BIGDICT = ROOT / "data" / "words_alpha.txt"
START_DATE = dt.date(2026, 7, 9)
WANT = 35
NO_REPEAT_WINDOW = 12  # a word won't reappear within this many days

# (bonus display, clue).  Display spaces define the answer's word pattern.
SEEDS = [
    ("SAND BANK",  "Where a beachgoer might keep his money"),
    ("HOT DOG",    "An overheated show-off at the cookout"),
    ("CAT NAP",    "A brief feline board meeting"),
    ("EGGHEAD",    "A real brainiac, sunny-side up"),
    ("SUNBURN",    "A rosy souvenir from a lazy beach day"),
    ("POPCORN",    "A movie's noisiest snack"),
    ("RAINBOW",    "An arch no one can walk under"),
    ("NIGHTCAP",   "A bedtime drink, or a sleeper's hat"),
    ("DEADLINE",   "The scariest line for any writer"),
    ("SEAWEED",    "The ocean's leafy greens"),
    ("PANCAKE",    "Breakfast that gets flipped daily"),
    ("DOGHOUSE",   "Where a forgetful spouse ends up"),
    ("PASSWORD",   "The secret that guards your inbox"),
    ("MEATBALL",   "A klutz, or a hero's filling"),
    ("SNOWBALL",   "It grows bigger as it rolls downhill"),
    ("KEYBOARD",   "You pour your feelings out on it"),
    ("SIDEKICK",   "Robin, to Batman"),
    ("BOOKWORM",   "A voracious reader without any teeth"),
    ("HONEYBEE",   "A hive's tireless little worker"),
    ("CUPCAKE",    "A muffin that dressed up for a party"),
    ("HAIRCUT",    "A trim that can cost you a few locks"),
    ("FOOTNOTE",   "The fine print down at the bottom"),
    ("DAYDREAM",   "A wandering mind's private matinee"),
    ("BACKFIRE",   "When a clever plan blows up on you"),
    ("OVERTIME",   "Extra hours that pad the paycheck"),
    ("WATCHDOG",   "A four-legged security system"),
    ("LADYBUG",    "A polka-dotted guest in the garden"),
    ("CUP CAKE",   "A little frosted party in a wrapper"),
    ("NUTSHELL",   "Where you put it to keep it brief"),
    ("HEADACHE",   "What this puzzle is definitely not"),
    ("SUITCASE",   "A vacation's trusty travel buddy"),
    ("MOONWALK",   "Michael's famous backward glide"),
    ("BACKYARD",   "Where the grill holds court"),
    ("NECKLACE",   "Something that hangs around"),
    ("TAKEOUT",    "Dinner that arrives in a box"),
    ("SUNDIAL",    "A clock that runs on shadows"),
    ("HOMESICK",   "Missing your own couch"),
    ("NIGHT OWL",  "Someone who thrives after midnight"),
    ("MEATLOAF",   "A dinnertime brick, in a good way"),
    ("KEY CHAIN",  "It jingles in your pocket"),
    ("BIRD BATH",  "A robin's backyard spa"),
    ("OVERDUE",    "Long past its library date"),
    ("CHECKOUT",   "The last stop before the parking lot"),
    ("SUNSHINE",   "A cloud's least favorite thing"),
    ("HANDMADE",   "Crafted, not factory-stamped"),
    ("WOODWORK",   "What the pests come out of"),
    ("LOOKOUT",    "A sentry, or a sudden shout"),
    ("BALL GAME",  "A sunny day with peanuts and cracker jack"),
]


def load_big():
    return {w.strip() for w in BIGDICT.read_text(encoding="latin-1").splitlines()}


def validate(puz, pool_words, big):
    """Return list of problems (empty = valid)."""
    probs = []
    letters = "".join(c for c in puz["bonus"]["answer"] if c.isalpha())
    got = Counter()
    seen = set()
    for w in puz["words"]:
        ans = w["answer"]
        if ans not in pool_words:
            probs.append(f"{ans} not in pool")
        if ans in seen:
            probs.append(f"duplicate word {ans}")
        seen.add(ans)
        # scramble must be a permutation, not the word, and not a real word
        if sorted(w["scramble"]) != sorted(ans):
            probs.append(f"{w['scramble']} not a permutation of {ans}")
        if w["scramble"] == ans:
            probs.append(f"scramble equals answer {ans}")
        if w["scramble"].lower() in big:
            probs.append(f"scramble {w['scramble']} is itself a real word")
        for i in w["circled"]:
            got[ans[i]] += 1
    if got != Counter(letters):
        probs.append(f"circled letters {dict(got)} != bonus {dict(Counter(letters))}")
    return probs


def main():
    pool = load_pool()
    pool_words = {w for w, _ in pool}
    big = load_big()

    puzzles = []
    used = Counter()
    recent_words: list[set] = []  # words used per puzzle, for the rolling window
    date = START_DATE
    num = 1
    log = []

    for i, (display, clue) in enumerate(SEEDS):
        if len(puzzles) >= WANT:
            break
        answer = "".join(display.split()).upper()
        pattern = [len(p) for p in display.split()]
        forbidden: set = set().union(*recent_words[-NO_REPEAT_WINDOW:]) if recent_words else set()
        words_meta, err = build_puzzle(answer, pool, used_counts=used,
                                       forbidden=forbidden, seed=1000 + i)
        if err:
            log.append(f"SKIP {display}: {err}")
            continue
        puz = {
            "id": num,
            "date": date.isoformat(),
            "words": words_meta,
            "bonus": {"answer": answer, "display": display, "clue": clue,
                      "pattern": pattern},
        }
        probs = validate(puz, pool_words, big)
        if probs:
            log.append(f"REJECT {display}: {probs}")
            continue
        for w in words_meta:
            used[w["answer"]] += 1
        recent_words.append({w["answer"] for w in words_meta})
        puzzles.append(puz)
        log.append(f"OK   #{num} {date}  {display:12s} <- " +
                   ", ".join(w["answer"] for w in words_meta))
        date += dt.timedelta(days=1)
        num += 1

    OUT.write_text(json.dumps(puzzles, indent=2))
    print("\n".join(log))
    print(f"\nGenerated {len(puzzles)} puzzles -> {OUT.relative_to(ROOT)}")
    # word reuse summary
    top = used.most_common(8)
    print("most reused words:", top)


if __name__ == "__main__":
    main()
