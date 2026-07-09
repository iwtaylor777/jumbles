"""
Jumbles puzzle constructor.

Given a BONUS answer (e.g. "SANDBANK") plus a clue, find 4 distinct common
5-letter words from data/pool.json and choose circled positions in each so that
the union of circled letters is exactly the bonus's letter multiset.

Guarantees (structural, checked here):
  * every word is from the curated unique-anagram pool -> determinate solve
  * circled letters across the 4 words spell the bonus exactly
  * each word contributes 1..3 circled letters (all 4 words matter)
  * the displayed scramble is not the word itself (and, because each word has a
    unique anagram in the big dictionary, no permutation of its letters spells a
    different real word either)

Randomised backtracking with restarts; prefers higher-frequency words.
"""
from __future__ import annotations
from collections import Counter
from pathlib import Path
import json, random

ROOT = Path(__file__).resolve().parent.parent
POOL_PATH = ROOT / "data" / "pool.json"

_OBSCENE_SUB = ("FUCK", "SHIT", "CUNT", "COCK", "FAG", "NIGG", "SLUT", "TWAT",
                "DICK", "PISS", "RAPE", "CUM")


def load_pool():
    data = json.loads(POOL_PATH.read_text())
    # sorted by freq desc already; keep (word, zipf)
    return [(d["word"], d["zipf"]) for d in data]


def _distributions(total: int):
    """All 4-part compositions of `total` with each part in 1..3 (order matters)."""
    out = []
    for a in range(1, 4):
        for b in range(1, 4):
            for c in range(1, 4):
                d = total - a - b - c
                if 1 <= d <= 3:
                    out.append((a, b, c, d))
    return out


def _supply(word: str, remaining: Counter) -> Counter:
    """How many of each letter `word` could contribute from `remaining`."""
    wc = Counter(word)
    return Counter({ch: min(wc[ch], remaining[ch]) for ch in remaining if wc[ch] > 0})


def _pick_letters(supply: Counter, k: int, rng: random.Random):
    """Choose k letters (multiset) from `supply`, or None if impossible."""
    flat = []
    for ch, n in supply.items():
        flat.extend([ch] * n)
    if len(flat) < k:
        return None
    rng.shuffle(flat)
    return Counter(flat[:k])


def _positions(word: str, letters: Counter, rng: random.Random):
    """Distinct indices in `word` realising the `letters` multiset."""
    idx_by_ch = {}
    for i, ch in enumerate(word):
        idx_by_ch.setdefault(ch, []).append(i)
    chosen = []
    for ch, n in letters.items():
        pool_idx = list(idx_by_ch.get(ch, []))
        if len(pool_idx) < n:
            return None
        rng.shuffle(pool_idx)
        chosen.extend(pool_idx[:n])
    return sorted(chosen)


def _scramble(word: str, rng: random.Random) -> str:
    """A permutation that differs from the word, maximising letter displacement."""
    best = None
    best_disp = -1
    for _ in range(60):
        perm = list(word)
        rng.shuffle(perm)
        s = "".join(perm)
        if s == word:
            continue
        if any(bad in s for bad in _OBSCENE_SUB):
            continue
        disp = sum(1 for i in range(len(word)) if s[i] != word[i])
        if disp > best_disp:
            best_disp, best = disp, s
    return best or word[::-1]


def build_puzzle(bonus: str, pool, used_counts: Counter | None = None,
                 forbidden: set | None = None, seed: int = 0, restarts: int = 6000):
    """Return (words_meta, warnings) or (None, reason)."""
    bonus = bonus.upper()
    target = Counter(c for c in bonus if c.isalpha())
    total = sum(target.values())
    if not (6 <= total <= 8):
        return None, f"bonus must be 6-8 letters, got {total}"

    used_counts = used_counts or Counter()
    forbidden = forbidden or set()
    dists = _distributions(total)
    rng = random.Random(seed)

    # candidate ordering: common first; drop words used in the batch or that are
    # a substring of the bonus (e.g. HONEY inside HONEYBEE would give it away)
    base_order = sorted(
        (wz for wz in pool if wz[0] not in forbidden and wz[0] not in bonus),
        key=lambda wz: -wz[1])
    words_only = [w for w, _ in base_order]

    for attempt in range(restarts):
        rng2 = random.Random(seed * 100003 + attempt)
        dist = rng2.choice(dists)
        # shuffle candidates but keep common words near the front (weighted)
        order = words_only[:]
        # small random perturbation of the freq order
        order = sorted(order, key=lambda w: words_only.index(w) + rng2.random() * 80)

        remaining = Counter(target)
        used = set()
        chosen = []  # (word, letters Counter)
        ok = True
        for slot in range(4):
            k = dist[slot]
            placed = False
            for w in order:
                if w in used:
                    continue
                sup = _supply(w, remaining)
                if sum(sup.values()) < k:
                    continue
                letters = _pick_letters(sup, k, rng2)
                if letters is None:
                    continue
                # commit
                used.add(w)
                for ch, n in letters.items():
                    remaining[ch] -= n
                chosen.append((w, letters))
                placed = True
                break
            if not placed:
                ok = False
                break
        if ok and sum(remaining.values()) == 0:
            # realise positions + scrambles
            words_meta = []
            good = True
            for w, letters in chosen:
                pos = _positions(w, letters, rng2)
                if pos is None:
                    good = False
                    break
                words_meta.append({
                    "answer": w,
                    "circled": pos,
                    "scramble": _scramble(w, rng2),
                })
            if not good:
                continue
            # verify union of circled letters == bonus
            got = Counter()
            for wm in words_meta:
                for i in wm["circled"]:
                    got[wm["answer"][i]] += 1
            if got != target:
                continue
            rng2.shuffle(words_meta)  # randomise row order
            return words_meta, None

    return None, "no construction found"


if __name__ == "__main__":
    import sys
    pool = load_pool()
    bonus = sys.argv[1] if len(sys.argv) > 1 else "SANDBANK"
    wm, err = build_puzzle(bonus, pool, seed=1)
    if err:
        print("FAIL:", err)
    else:
        print("BONUS:", bonus)
        for m in wm:
            circ = "".join(m["answer"][i] for i in m["circled"])
            print(f"  {m['scramble']} -> {m['answer']}  circled@{m['circled']} = {circ}")
