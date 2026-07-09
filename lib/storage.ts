import type { Puzzle } from "./types";

const STATE_KEY = "jumbles:state:v1";
const STATS_KEY = "jumbles:stats:v1";
const PREF_KEY = "jumbles:prefs:v1";

export type GameState = {
  id: number;
  date: string;
  placement: (number | null)[][]; // [word][slot] -> bank index
  solved: boolean[];
  bonusLetters: (string | null)[]; // [bonus slot] -> letter (typed or from bank)
  bonusSrc: (number | null)[]; // [bonus slot] -> bonus-bank index (null if typed)
  bonusSolved: boolean;
  hintedWords: boolean[];
  bonusHinted: boolean;
  hintsUsed: number;
  solvedCountWhenBonus: number | null;
  completedAt: number | null;
};

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastWinDate: string | null;
  earlyBonus: number;
  cleanSolves: number;
};

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastWinDate: null,
  earlyBonus: 0,
  cleanSolves: 0,
});

export function freshState(p: Puzzle): GameState {
  return {
    id: p.id,
    date: p.date,
    placement: p.words.map(() => Array(5).fill(null)),
    solved: p.words.map(() => false),
    bonusLetters: Array(p.bonus.answer.length).fill(null),
    bonusSrc: Array(p.bonus.answer.length).fill(null),
    bonusSolved: false,
    hintedWords: p.words.map(() => false),
    bonusHinted: false,
    hintsUsed: 0,
    solvedCountWhenBonus: null,
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

export function loadState(p: Puzzle): GameState {
  const s = read<GameState>(STATE_KEY);
  if (s && s.id === p.id && s.date === p.date) return s;
  return freshState(p);
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

/** Fold a completed puzzle into the stats (idempotent-ish; call once on win). */
export function recordWin(
  prev: Stats,
  puzzleDate: string,
  hintsUsed: number,
  early: boolean,
): Stats {
  const next: Stats = { ...prev };
  next.played += 1;
  next.wins += 1;
  if (hintsUsed === 0) next.cleanSolves += 1;
  if (early) next.earlyBonus += 1;

  if (next.lastWinDate === puzzleDate) {
    // already counted today — undo the double count above
    return prev;
  }
  if (next.lastWinDate && isoAddDays(next.lastWinDate, 1) === puzzleDate) {
    next.currentStreak += 1;
  } else {
    next.currentStreak = 1;
  }
  next.lastWinDate = puzzleDate;
  next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
  return next;
}

// ---- theme preference ------------------------------------------------------
export type Theme = "light" | "dark" | "system";

export function loadTheme(): Theme {
  return (read<{ theme: Theme }>(PREF_KEY)?.theme ?? "system") as Theme;
}
export function saveTheme(theme: Theme) {
  write(PREF_KEY, { theme });
}
