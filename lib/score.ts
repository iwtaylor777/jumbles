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

export function isEarlyFlair(gs: GameState, wordCount: number): boolean {
  return (
    gs.bonusSolved &&
    gs.solvedCountWhenBonus !== null &&
    gs.solvedCountWhenBonus < wordCount
  );
}
