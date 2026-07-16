"""
Jumbles puzzle constructor.

Given a BONUS answer (e.g. "SANDBANK") plus a clue, find 4 distinct common
words following the length RAMP (default 5, 5, 6, 7 — the day starts easy and
gets harder) from data/pool_{L}.json and choose circled positions in each so
that the union of circled letters is exactly the bonus's letter multiset.

Guarantees (structural, checked here):
  * every word is from the curated unique-anagram pool -> determinate solve
  * circled letters across the 4 words spell the bonus exactly
  * each word contributes 1..3 circled letters (all 4 words matter)
  * rows are NOT shuffled: the ramp order IS the difficulty curve
  * the displayed scramble is not the word itself, leaves no letter in its
    original position when possible, and preserves no 3-letter run of the
    answer (and, because each word has a unique anagram in the big dictionary,
    no permutation of its letters spells a different real word either)

Randomised backtracking with restarts; prefers higher-frequency words.
"""
from __future__ import annotations
from collections import Counter
from pathlib import Path
import json, random

ROOT = Path(__file__).resolve().parent.parent
RAMP = (5, 5, 6, 7)

# The long words are the day's "boss fight": exclude ultra-common fillers
# (SHOULD, BETWEEN...) there, and randomise deeper into the pool so mid-band
# words (PUZZLE, WHISTLE, FURIOUS...) appear. Warm-up slots stay easy.
ZIPF_CAP = {6: 5.2, 7: 5.2}
JITTER = {4: 80, 5: 80, 6: 300, 7: 450}

_OBSCENE_SUB = ("FUCK", "SHIT", "CUNT", "COCK", "FAG", "NIGG", "SLUT", "TWAT",
                "DICK", "PISS", "RAPE", "CUM")


def load_pools(ramp=RAMP):
    """{length: [(word, zipf)] sorted by freq desc} for each length in the ramp."""
    pools = {}
    for length in sorted(set(ramp)):
        data = json.loads((ROOT / "data" / f"pool_{length}.json").read_text())
        pools[length] = [(d["word"], d["zipf"]) for d in data]
    return pools


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


def _shares_trigram(s: str, word: str) -> bool:
    return any(word[i : i + 3] in s for i in range(len(word) - 2))


def _leaks_bonus(word: str, bonus: str) -> bool:
    """True if `word` shares a 4+ letter run with the bonus (WATCHED would
    telegraph WATCHDOG) or is contained in it outright."""
    if word in bonus:
        return True
    return any(word[i : i + 4] in bonus for i in range(len(word) - 3))


def _scramble(word: str, rng: random.Random) -> str:
    """A hard permutation: no letter left in place, no 3-letter run of the
    answer preserved. Falls back to max-displacement if the strict tier is
    impossible (heavy repeated letters)."""
    best = None
    best_disp = -1
    for attempt in range(400):
        perm = list(word)
        rng.shuffle(perm)
        s = "".join(perm)
        if s == word:
            continue
        if any(bad in s for bad in _OBSCENE_SUB):
            continue
        disp = sum(1 for i in range(len(word)) if s[i] != word[i])
        if disp == len(word) and not _shares_trigram(s, word):
            return s  # strict tier: a derangement with no shared trigram
        if disp > best_disp:
            best_disp, best = disp, s
    return best or word[::-1]


def build_puzzle(bonus: str, pools, ramp=RAMP, used_counts: Counter | None = None,
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

    # per-length candidate ordering: common first; drop words used in the batch
    # or that are a substring of the bonus (e.g. HONEY inside HONEYBEE)
    base_orders = {}
    for length, pool in pools.items():
        base = sorted(
            (wz for wz in pool
             if wz[0] not in forbidden and not _leaks_bonus(wz[0], bonus)
             and wz[1] <= ZIPF_CAP.get(length, 99)),
            key=lambda wz: -wz[1])
        base_orders[length] = [w for w, _ in base]

    for attempt in range(restarts):
        rng2 = random.Random(seed * 100003 + attempt)
        dist = rng2.choice(dists)
        # shuffle candidates but keep common words near the front (weighted)
        orders = {
            length: sorted(words, key=lambda w, ws=words: ws.index(w) + rng2.random() * JITTER[length])
            for length, words in base_orders.items()
        }

        remaining = Counter(target)
        used = set()
        chosen = []  # (word, letters Counter)
        ok = True
        for slot in range(4):
            k = dist[slot]
            placed = False
            for w in orders[ramp[slot]]:
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
            # keep ramp order — short warm-ups first, the 7-letter closer last
            return words_meta, None

    return None, "no construction found"


if __name__ == "__main__":
    import sys
    pools = load_pools()
    bonus = sys.argv[1] if len(sys.argv) > 1 else "SANDBANK"
    wm, err = build_puzzle(bonus, pools, seed=1)
    if err:
        print("FAIL:", err)
    else:
        print("BONUS:", bonus)
        for m in wm:
            circ = "".join(m["answer"][i] for i in m["circled"])
            print(f"  {m['scramble']} -> {m['answer']}  circled@{m['circled']} = {circ}")
