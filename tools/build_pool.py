"""
Build curated word pools for Jumbles (one per word length).

Pipeline:
  1. Source words from Webster's 2nd (/usr/share/dict/words), lowercase-only
     entries (proper nouns are Capitalized there, so this drops most of them).
  2. Keep length-L, purely alphabetic.
  3. Require zipf frequency >= the per-length threshold (common / recognizable).
  4. Drop proper names (dict propernames), an offensive blocklist, and a
     manual junk/abbreviation blocklist.
  5. Keep ONLY words whose letter-multiset has exactly ONE valid anagram in the
     big dictionary -> the solve is determinate (no "SALET vs LEAST" ambiguity).

Usage:
  python build_pool.py            # builds all lengths in LENGTHS
  python build_pool.py 6 3.4      # one length, explicit threshold

Outputs:
  data/pool_{L}.json     list of {"word","zipf"} (uppercase), sorted by freq desc
  data/pool_meta.json    summary stats keyed by length
"""
from pathlib import Path
import json, sys
from collections import defaultdict
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parent.parent
DICT = Path("/usr/share/dict/words")                 # source (lowercase = not proper noun)
BIGDICT = ROOT / "data" / "words_alpha.txt"          # comprehensive (incl. plurals) for uniqueness
PROPER = Path("/usr/share/dict/propernames")
OUT_META = ROOT / "data" / "pool_meta.json"

# longer words are rarer overall, so ease the threshold a little to keep pools deep
DEFAULT_FREQ_MIN = {4: 3.6, 5: 3.6, 6: 3.4, 7: 3.4}
LENGTHS = [5, 6, 7]

OFFENSIVE = set("""
anus arse balls bitch boner boobs booty chink cocks coons crap cunts dicks dildo
dumbo dykes fucks gooks kikes negro nazis penis porno pussy queef retard sluts
spics semen shits spunk twats wanks whore
orgasm vagina sexual mormon ghetto midget
vaginal suicide playboy screwed sucking fascist fascism leftist ovarian obscene
""".split())

# obvious abbreviations / non-words that sneak through lowercased dicts
JUNK = set("""
potus scuba radar sonar arpa fubar thats gonna wanna gotta yeah okay uhhuh
malik prick horny sexed boobs kinky japan china texas romeo tokyo koran islam
drunk booze boozy
didnt havent wouldnt couldnt shouldnt
whisky sherry liquor tavern scotch whiskey bourbon drunken brewery
covid honda august berlin boston brazil canada russia warsaw panama fresno
surrey montana finland bangkok morocco bolivia moscow
cheque labour analyse defence flavour
""".split())

# names / brands that appear lowercase in Webster's 2nd and slip past propernames
NAMES = set("""
bundy rohan benny sammy willy curly weber jimmy tommy bobby billy jerry harry
larry terry kenny danny denny donny ronny wally sally kelly holly molly polly
tammy penny nancy betty patty peggy ginny becky vicky sandy mandy randy cindy
mabel della nelly bertha buddy teddy freddy paddy daddy mammy mommy nanny
kitty missy sissy bessy nikki debby robby jenny lenny manny
murphy cooper walker nelson wright bailey harper newton burton sophia holden
dexter peyton baxter dudley talbot
collins sanders chapman gilbert maxwell goodman tiffany lambert manning
skinner wheeler burgess derrick bullock
""".split())

def load_lower(path, length):
    words = set()
    for line in path.read_text(encoding="latin-1").splitlines():
        w = line.strip()
        if len(w) == length and w.islower() and w.isalpha():
            words.add(w)
    return words

def anagram_key(w):
    return "".join(sorted(w))

def build(length: int, freq_min: float) -> dict:
    source = load_lower(DICT, length)    # proper-noun-safe candidate pool
    big = load_lower(BIGDICT, length)    # comprehensive, catches plurals/inflections
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
        if z < freq_min:
            continue
        # unique anagram in the comprehensive dict => determinate solve
        if len(classes[anagram_key(w)]) != 1:
            continue
        pool.append({"word": w.upper(), "zipf": round(z, 2)})

    pool.sort(key=lambda x: (-x["zipf"], x["word"]))
    (ROOT / "data" / f"pool_{length}.json").write_text(json.dumps(pool, separators=(",", ":")))
    print(f"L={length}  FREQ_MIN={freq_min}  pool_size={len(pool)}")
    print("  top 15:", [p["word"] for p in pool[:15]])
    print("  bottom 10:", [p["word"] for p in pool[-10:]])
    return {"freq_min": freq_min, "pool_size": len(pool),
            "big_dict_anagram_classes": len(classes)}

def main():
    if len(sys.argv) > 1:
        length = int(sys.argv[1])
        freq_min = float(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_FREQ_MIN[length]
        todo = [(length, freq_min)]
    else:
        todo = [(length, DEFAULT_FREQ_MIN[length]) for length in LENGTHS]

    meta = {}
    if OUT_META.exists():
        try:
            meta = json.loads(OUT_META.read_text())
            if "pool_size" in meta:      # legacy single-length format
                meta = {}
        except json.JSONDecodeError:
            meta = {}
    for length, freq_min in todo:
        meta[str(length)] = build(length, freq_min)
    OUT_META.write_text(json.dumps(meta, indent=2))

if __name__ == "__main__":
    main()
