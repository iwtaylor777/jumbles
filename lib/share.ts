import type { Puzzle } from "./types";
import type { GameState } from "./storage";

export const SITE_URL = "https://jumbles.vercel.app";

/**
 * Spoiler-free share text: one row of squares (one per word — green = solved
 * clean, yellow = used a hint) plus a bonus indicator and the puzzle number.
 */
export function buildShare(p: Puzzle, s: GameState): string {
  const squares = p.words
    .map((_, i) => (s.hintedWords[i] ? "🟨" : "🟩"))
    .join("");

  const early =
    s.solvedCountWhenBonus !== null && s.solvedCountWhenBonus < p.words.length;
  let bonusMark = "⬛";
  if (s.bonusSolved) bonusMark = s.bonusHinted ? "🟡" : early ? "⭐" : "🟦";

  const lines = [
    `Jumbles No. ${p.id}  ${squares} ${bonusMark}`,
    early && s.bonusSolved && !s.bonusHinted
      ? `Cracked the bonus with ${s.solvedCountWhenBonus}/${p.words.length} words!`
      : null,
    SITE_URL,
  ].filter(Boolean);

  return lines.join("\n");
}
