"""
Standalone validator for data/puzzles.json — run before every content ship.

Checks every structural guarantee the game relies on:
  * ids sequential from 1, dates contiguous daily from the first date
  * bonus: letters == circled union, pattern matches display, 6-8 letters
  * every word: scramble is a permutation, differs from the answer, is not
    itself a real word, and the answer has a UNIQUE anagram in words_alpha
    (determinate solve)
  * each word contributes 1..3 circled letters at valid, distinct positions
  * no duplicate words within a puzzle; no word reuse within a 12-day window
  * puzzles dated after RAMP_FROM follow the 5,5,6,7 length ramp

Exits non-zero with a problem list if anything fails.
"""
from collections import Counter, defaultdict
from pathlib import Path
import json, sys, datetime as dt

ROOT = Path(__file__).resolve().parent.parent
RAMP = (5, 5, 6, 7)
RAMP_FROM = dt.date(2026, 7, 17)  # first ramped puzzle
NO_REPEAT_WINDOW = 12


def main():
    puzzles = json.loads((ROOT / "data" / "puzzles.json").read_text())
    big = {w.strip() for w in (ROOT / "data" / "words_alpha.txt")
           .read_text(encoding="latin-1").splitlines()}
    classes = defaultdict(int)
    for w in big:
        classes["".join(sorted(w))] += 1

    probs = []
    say = lambda pid, msg: probs.append(f"#{pid}: {msg}")

    first = dt.date.fromisoformat(puzzles[0]["date"])
    recent: list[tuple[dt.date, set]] = []

    for n, p in enumerate(puzzles):
        pid, date = p["id"], dt.date.fromisoformat(p["date"])
        if pid != n + 1:
            say(pid, f"id out of sequence (expected {n + 1})")
        if date != first + dt.timedelta(days=n):
            say(pid, f"date {date} not contiguous")

        b = p["bonus"]
        letters = b["answer"]
        if not letters.isalpha() or not letters.isupper():
            say(pid, f"bonus answer {letters!r} not uppercase letters")
        if "".join(b["display"].split()) != letters:
            say(pid, f"display {b['display']!r} != answer {letters!r}")
        if [len(x) for x in b["display"].split()] != b["pattern"]:
            say(pid, f"pattern {b['pattern']} != display {b['display']!r}")
        if not (6 <= len(letters) <= 8):
            say(pid, f"bonus length {len(letters)} outside 6-8")
        if not b["clue"].strip():
            say(pid, "empty clue")

        got = Counter()
        seen = set()
        for slot, w in enumerate(p["words"]):
            ans, scr, circ = w["answer"], w["scramble"], w["circled"]
            tag = f"word {slot + 1} ({ans})"
            if date >= RAMP_FROM and len(ans) != RAMP[slot]:
                say(pid, f"{tag}: length {len(ans)} != ramp {RAMP[slot]}")
            if ans in seen:
                say(pid, f"{tag}: duplicate in puzzle")
            seen.add(ans)
            if sorted(scr) != sorted(ans):
                say(pid, f"{tag}: scramble {scr} not a permutation")
            if scr == ans:
                say(pid, f"{tag}: scramble equals answer")
            if scr.lower() in big:
                say(pid, f"{tag}: scramble {scr} is a real word")
            if ans.lower() not in big:
                say(pid, f"{tag}: answer not in dictionary")
            if classes["".join(sorted(ans.lower()))] != 1:
                say(pid, f"{tag}: anagram not unique — ambiguous solve")
            if not (1 <= len(circ) <= 3):
                say(pid, f"{tag}: {len(circ)} circled letters (want 1-3)")
            if len(set(circ)) != len(circ) or any(not (0 <= i < len(ans)) for i in circ):
                say(pid, f"{tag}: bad circled positions {circ}")
            for i in circ:
                got[ans[i]] += 1
        if got != Counter(letters):
            say(pid, f"circled union {dict(got)} != bonus {dict(Counter(letters))}")

        window = {w for d, ws in recent if (date - d).days <= NO_REPEAT_WINDOW for w in ws}
        repeats = seen & window
        if repeats:
            say(pid, f"words repeat within {NO_REPEAT_WINDOW} days: {sorted(repeats)}")
        recent.append((date, seen))

    if probs:
        print(f"FAIL — {len(probs)} problem(s):")
        print("\n".join(" " + x for x in probs))
        sys.exit(1)
    print(f"OK — {len(puzzles)} puzzles valid "
          f"({puzzles[0]['date']} -> {puzzles[-1]['date']})")


if __name__ == "__main__":
    main()
