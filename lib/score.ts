import type { GameState } from "./storage";

export type Rank = {
  key: string;
  label: string;
  emoji: string;
  blurb: string;
};

/**
 * Challenge-mode rank. Driven by "slips" = hints + strikes. A flawless run
 * (no hints, no strikes) is Jumble Master; running out of strikes is Jumbled.
 * Relaxed mode is unranked (returns null from rankFor).
 */
export function computeRank(failed: boolean, hintsUsed: number, strikes: number): Rank {
  if (failed) {
    return { key: "jumbled", label: "Jumbled", emoji: "💀", blurb: "You've been jumbled, fool!" };
  }
  const slips = hintsUsed + strikes;
  if (slips === 0)
    return { key: "master", label: "Jumble Master", emoji: "🏆", blurb: "A flawless solve." };
  if (slips === 1)
    return { key: "genius", label: "Genius", emoji: "🌟", blurb: "So close to flawless." };
  if (slips === 2) return { key: "sharp", label: "Sharp", emoji: "🔷", blurb: "Sharp work." };
  if (slips <= 4) return { key: "solid", label: "Solid", emoji: "✅", blurb: "Solid solve." };
  return { key: "scrappy", label: "Scrappy", emoji: "🧩", blurb: "You got there!" };
}

export function rankFor(gs: GameState): Rank | null {
  if (gs.mode !== "challenge") return null;
  if (!gs.failed && !gs.bonusSolved) return null;
  return computeRank(gs.failed, gs.hintsUsed, gs.strikes);
}

/** Elapsed solve time in ms (null until the first move is made). */
export function elapsedMs(gs: GameState): number | null {
  if (gs.startedAt == null) return null;
  return Math.max(0, (gs.completedAt ?? Date.now()) - gs.startedAt);
}

/** 73_000 -> "1:13"; 3_673_000 -> "1:01:13" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function isEarlyFlair(gs: GameState, wordCount: number): boolean {
  return (
    gs.bonusSolved &&
    gs.solvedCountWhenBonus !== null &&
    gs.solvedCountWhenBonus < wordCount
  );
}
