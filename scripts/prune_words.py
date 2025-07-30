"""
One-shot cleaner for 5-letter vocabulary.

Usage:  python scripts/prune_words.py
Creates: data/words5_clean.txt
"""

from pathlib import Path
from wordfreq import zipf_frequency

ROOT       = Path(__file__).resolve().parent.parent        # jumbles/
RAW_LIST   = ROOT / "data" / "words5.txt"
CLEAN_LIST = ROOT / "data" / "words5_clean.txt"
KEEP_ZIPF  = 2.2                                           # adjust if desired

# ---- simple profanity / slur blacklist --------------
BLACKLIST = {
    "cimex", # <-- example placeholders — extend as needed
}

def main() -> None:
    words = [w.strip().lower() for w in RAW_LIST.read_text().splitlines()]
    keep  = [
        w for w in words
        if zipf_frequency(w, "en") >= KEEP_ZIPF and w not in BLACKLIST
    ]
    CLEAN_LIST.write_text("\n".join(sorted(set(keep))))
    print(f"✅  Kept {len(keep):,} of {len(words):,} words → {CLEAN_LIST.relative_to(ROOT)}")

if __name__ == "__main__":
    main()