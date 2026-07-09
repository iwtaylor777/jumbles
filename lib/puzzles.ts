import raw from "@/data/puzzles.json";
import type { Puzzle } from "./types";

export const PUZZLES = raw as Puzzle[];
export const FIRST_DATE = PUZZLES[0].date;
export const LAST_DATE = PUZZLES[PUZZLES.length - 1].date;

/** Local calendar date as YYYY-MM-DD (rollover happens at the player's midnight). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + "T00:00:00");
  const b = Date.parse(toISO + "T00:00:00");
  return Math.round((b - a) / 86_400_000);
}

/** Index into PUZZLES for a given local date, clamped to the available range. */
export function indexForDate(iso: string): number {
  const offset = daysBetween(FIRST_DATE, iso);
  if (offset <= 0) return 0;
  if (offset >= PUZZLES.length) return PUZZLES.length - 1;
  return offset;
}

export function puzzleForDate(iso: string): Puzzle {
  return PUZZLES[indexForDate(iso)];
}

export function todaysPuzzle(now: Date = new Date()): Puzzle {
  return puzzleForDate(localISODate(now));
}

/** True once we're serving the final available puzzle (content runway ran out). */
export function isCaughtUp(iso: string): boolean {
  return daysBetween(FIRST_DATE, iso) >= PUZZLES.length - 1;
}

/** ms until the next local midnight — used for the "next puzzle" countdown. */
export function msUntilTomorrow(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}
