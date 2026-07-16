# Jumbles

A daily word game. Unscramble four common words — they grow longer as you go
(5, 5, 6, 7 letters) — then use their **circled** letters to crack a punny
**bonus** answer. One new puzzle every day. Challenge mode is timed, with
four strikes and a shareable result; Relaxed mode has no stakes.

Live: **https://playjumbles.com**

## Architecture

A single **Next.js** (App Router) app deployed on Vercel. Puzzles are committed
to the repo as static JSON and bundled into the build — there is **no runtime
backend**, so the game keeps working as long as Vercel serves static files.

```
app/                 Next.js App Router (page, layout, OG image, icon)
components/           Game UI (Game, WordRow, BonusPanel, Modals, ui)
lib/                  types, puzzle selection, localStorage, share text
data/puzzles.json    the daily puzzles (bundled at build time)
data/pool_{5,6,7}.json  curated word pools by length (build-time output)
tools/               Python puzzle-generation + validation pipeline
```

The player's local midnight selects the day's puzzle (`lib/puzzles.ts`), so
rollover is timezone-correct and works offline. Progress, streaks and stats live
in `localStorage`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (static)
```

## Puzzle content pipeline

Every published puzzle is **provably fair**: each word is drawn from a curated
pool of common words that each have a *unique anagram* in a 370k-word dictionary,
so there is exactly one valid solution per row.

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# 1. fetch the big validation dictionary (once)
curl -sL https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt -o data/words_alpha.txt
# 2. build the curated word pools (lengths 5, 6, 7)
.venv/bin/python tools/build_pool.py
# 3. generate the batch of puzzles from the authored bonus/clue seeds
.venv/bin/python tools/generate_batch.py
# 4. re-validate everything that will ship
.venv/bin/python tools/validate_puzzles.py
```

`tools/build_pool.py` sources candidates from Webster's 2nd (lowercase =
proper-noun-safe), filters by word frequency, strips names/offensive words, and
keeps only unique-anagram words. `tools/construct.py` takes a bonus answer + clue
and finds four words following the **5, 5, 6, 7 length ramp** (warm-ups first,
the long word last) whose circled letters spell the bonus; scrambles leave no
letter in place and preserve no 3-letter run of the answer. `tools/generate_batch.py`
holds the authored bonus/clue seeds, preserves already-published dates, and
validates every puzzle before writing `data/puzzles.json`.
`tools/validate_puzzles.py` is the independent pre-ship check.

To extend the calendar: add `(bonus, clue)` seeds to `tools/generate_batch.py`
and re-run steps 3-4. (Automated nightly generation via GitHub Actions is planned.)
