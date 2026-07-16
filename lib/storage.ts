import type { Puzzle } from "./types";

const STATE_KEY = "jumbles:state:v2";
const STATS_KEY = "jumbles:stats:v2";
const PREF_KEY = "jumbles:prefs:v1";

export const MAX_STRIKES = 4;

export type Mode = "challenge" | "relaxed";

export type GameState = {
  id: number;
  date: string;
  /** content signature — resets saved state if the puzzle data changes under it */
  sig: string;
  mode: Mode;
  placement: (number | null)[][]; // [word][slot] -> bank index
  solved: boolean[];
  bonusLetters: (string | null)[]; // [bonus slot] -> letter
  bonusSrc: (number | null)[]; // [bonus slot] -> bonus-bank index (null if typed)
  bonusSolved: boolean;
  hintedWords: boolean[];
  bonusHinted: boolean;
  hintsUsed: number;
  strikes: number;
  failed: boolean;
  solvedCountWhenBonus: number | null;
  startedAt: number | null; // first move (timer start)
  completedAt: number | null;
};

export type Stats = {
  played: number;
  wins: number;
  losses: number;
  currentStreak: number;
  maxStreak: number;
  lastResultDate: string | null;
  earlyBonus: number;
  flawless: number; // Challenge wins with no hints AND no strikes
  bestTimeMs: number | null; // fastest Challenge win
};

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastResultDate: null,
  earlyBonus: 0,
  flawless: 0,
  bestTimeMs: null,
});

export function puzzleSig(p: Puzzle): string {
  return p.words.map((w) => w.scramble).join("|") + "::" + p.bonus.answer;
}

export function freshState(p: Puzzle, mode: Mode): GameState {
  return {
    id: p.id,
    date: p.date,
    sig: puzzleSig(p),
    mode,
    placement: p.words.map((w) => Array(w.answer.length).fill(null)),
    solved: p.words.map(() => false),
    bonusLetters: Array(p.bonus.answer.length).fill(null),
    bonusSrc: Array(p.bonus.answer.length).fill(null),
    bonusSolved: false,
    hintedWords: p.words.map(() => false),
    bonusHinted: false,
    hintsUsed: 0,
    strikes: 0,
    failed: false,
    solvedCountWhenBonus: null,
    startedAt: null,
    completedAt: null,
  };
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Saved state (possibly from an older build) still matches this puzzle's shape. */
function compatible(s: GameState, p: Puzzle): boolean {
  if (s.sig !== undefined) return s.sig === puzzleSig(p);
  // legacy state (pre-sig): accept only if it structurally fits the puzzle
  return (
    Array.isArray(s.placement) &&
    s.placement.length === p.words.length &&
    s.placement.every(
      (row, i) =>
        Array.isArray(row) &&
        row.length === p.words[i].answer.length &&
        row.every((b) => b === null || (typeof b === "number" && b >= 0 && b < p.words[i].answer.length)),
    ) &&
    Array.isArray(s.bonusLetters) &&
    s.bonusLetters.length === p.bonus.answer.length
  );
}

export function loadState(p: Puzzle, mode: Mode): GameState {
  const s = read<GameState>(STATE_KEY);
  if (s && s.id === p.id && s.date === p.date && compatible(s, p)) {
    // merge over fresh defaults so fields added in newer builds exist
    return { ...freshState(p, s.mode ?? mode), ...s, sig: puzzleSig(p) };
  }
  return freshState(p, mode);
}

export const saveState = (s: GameState) => write(STATE_KEY, s);

export function loadStats(): Stats {
  return { ...emptyStats(), ...(read<Stats>(STATS_KEY) ?? {}) };
}

export const saveStats = (s: Stats) => write(STATS_KEY, s);

function isoAddDays(iso: string, days: number): string {
  const t = Date.parse(iso + "T00:00:00") + days * 86_400_000;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Fold a completed puzzle (win or loss) into stats. Idempotent per date:
 * calling twice for the same date is a no-op after the first.
 */
export function recordResult(
  prev: Stats,
  date: string,
  opts: {
    won: boolean;
    mode: Mode;
    hintsUsed: number;
    strikes: number;
    early: boolean;
    elapsedMs?: number | null;
  },
): Stats {
  if (prev.lastResultDate === date) return prev; // already counted today
  const next: Stats = { ...prev, played: prev.played + 1, lastResultDate: date };

  if (opts.won) {
    next.wins += 1;
    if (opts.early) next.earlyBonus += 1;
    if (opts.mode === "challenge" && opts.hintsUsed === 0 && opts.strikes === 0) next.flawless += 1;
    if (
      opts.mode === "challenge" &&
      opts.elapsedMs != null &&
      (prev.bestTimeMs == null || opts.elapsedMs < prev.bestTimeMs)
    ) {
      next.bestTimeMs = opts.elapsedMs;
    }
    // streak: consecutive calendar days with a win
    if (prev.lastResultDate && isoAddDays(prev.lastResultDate, 1) === date) {
      next.currentStreak = prev.currentStreak + 1;
    } else {
      next.currentStreak = 1;
    }
    next.maxStreak = Math.max(prev.maxStreak, next.currentStreak);
  } else {
    next.losses += 1;
    next.currentStreak = 0; // a loss breaks the streak
  }
  return next;
}

// ---- preferences -----------------------------------------------------------
export type Theme = "light" | "dark" | "system";
type Prefs = { theme?: Theme; mode?: Mode };

export function loadPrefs(): Prefs {
  return read<Prefs>(PREF_KEY) ?? {};
}
export function loadTheme(): Theme {
  return loadPrefs().theme ?? "system";
}
export function loadMode(): Mode {
  return loadPrefs().mode ?? "challenge";
}
export function saveTheme(theme: Theme) {
  write(PREF_KEY, { ...loadPrefs(), theme });
}
export function saveMode(mode: Mode) {
  write(PREF_KEY, { ...loadPrefs(), mode });
}
