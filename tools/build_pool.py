"""
Build a curated 5-letter word pool for Jumbles.

Pipeline:
  1. Source words from Webster's 2nd (/usr/share/dict/words), lowercase-only
     entries (proper nouns are Capitalized there, so this drops most of them).
  2. Keep length-5, purely alphabetic.
  3. Require zipf frequency >= FREQ_MIN (common / recognizable).
  4. Drop proper names (dict propernames), an offensive blocklist, and a
     manual junk/abbreviation blocklist.
  5. Keep ONLY words whose letter-multiset has exactly ONE valid anagram in the
     big dictionary -> the solve is determinate (no "SALET vs LEAST" ambiguity).

Outputs:
  data/pool.json         list of {"word","zipf"} (uppercase words), sorted by freq desc
  data/pool_meta.json    summary stats
"""
from pathlib import Path
import json, sys
from collections import defaultdict
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parent.parent
DICT = Path("/usr/share/dict/words")                 # source (lowercase = not proper noun)
BIGDICT = ROOT / "data" / "words_alpha.txt"          # comprehensive (incl. plurals) for uniqueness
PROPER = Path("/usr/share/dict/propernames")
OUT_POOL = ROOT / "data" / "pool.json"
OUT_META = ROOT / "data" / "pool_meta.json"

FREQ_MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 3.6

OFFENSIVE = set("""
anus arse balls bitch boner boobs booty chink cocks coons crap cunts dicks dildo
dumbo dykes fucks gooks kikes negro nazis penis porno pussy queef retard sluts
spics semen shits spunk twats wanks whore
""".split())

# obvious abbreviations / non-words that sneak through lowercased dicts
JUNK = set("""
potus scuba radar sonar arpa fubar thats gonna wanna gotta yeah okay uhhuh
malik prick horny sexed boobs kinky japan china texas romeo tokyo koran islam
""".split())

# names / brands that appear lowercase in Webster's 2nd and slip past propernames
NAMES = set("""
bundy rohan benny sammy willy curly weber jimmy tommy bobby billy jerry harry
larry terry kenny danny denny donny ronny wally sally kelly holly molly polly
tammy penny nancy betty patty peggy ginny becky vicky sandy mandy randy cindy
mabel della nelly bertha buddy teddy freddy paddy daddy mammy mommy nanny
kitty missy sissy bessy nikki debby robby jenny lenny manny
""".split())

def load_lower_5(path):
    words = set()
    for line in path.read_text(encoding="latin-1").splitlines():
        w = line.strip()
        if len(w) == 5 and w.islower() and w.isalpha():
            words.add(w)
    return words

def anagram_key(w):
    return "".join(sorted(w))

def main():
    source = load_lower_5(DICT)          # proper-noun-safe candidate pool
    big = load_lower_5(BIGDICT)          # comprehensive, catches plurals/inflections
    proper = {w.strip().lower() for w in PROPER.read_text(encoding="latin-1").splitlines()}

    # anagram classes over the COMPREHENSIVE dict -> catches START/TARTS collisions
    classes = defaultdict(list)
    for w in big:
        classes[anagram_key(w)].append(w)

    pool = []
    for w in sorted(source):
        if w not in big:                 # must be a real, current word
            continue
        if w in proper or w in OFFENSIVE or w in JUNK or w in NAMES:
            continue
        z = zipf_frequency(w, "en")
        if z < FREQ_MIN:
            continue
        # unique anagram in the comprehensive dict => determinate solve
        if len(classes[anagram_key(w)]) != 1:
            continue
        pool.append({"word": w.upper(), "zipf": round(z, 2)})

    pool.sort(key=lambda x: (-x["zipf"], x["word"]))
    OUT_POOL.write_text(json.dumps(pool, separators=(",", ":")))
    meta = {"freq_min": FREQ_MIN, "pool_size": len(pool),
            "big_dict_anagram_classes": len(classes)}
    OUT_META.write_text(json.dumps(meta, indent=2))
    print(f"FREQ_MIN={FREQ_MIN}  pool_size={len(pool)}")
    print("top 25:", [p["word"] for p in pool[:25]])
    print("bottom 15:", [p["word"] for p in pool[-15:]])

if __name__ == "__main__":
    main()
