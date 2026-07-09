import type { Puzzle } from "./types";
import type { GameState } from "./storage";
import { computeRank, isEarlyFlair } from "./score";

export const SITE_URL = "https://playjumbles.com";

/**
 * Spoiler-free share text that encodes HOW you solved:
 *  - one square per word (green = clean, yellow = used a hint)
 *  - a bonus marker (early ⚡ / clean 🔷 / hinted 🟡 / failed 💀)
 *  - Challenge: the rank + a strikes pip row
 */
export function buildShare(p: Puzzle, s: GameState): string {
  const words = p.words
    .map((_, i) => (s.hintedWords[i] ? "🟨" : "🟩"))
    .join("");

  const early = isEarlyFlair(s, p.words.length);
  let bonusMark = "⬛";
  if (s.failed) bonusMark = "💀";
  else if (s.bonusSolved) bonusMark = s.bonusHinted ? "🟡" : early ? "⚡" : "🔷";

  const lines: string[] = [];

  if (s.mode === "challenge") {
    const rank = computeRank(s.failed, s.hintsUsed, s.strikes);
    const pips = "🟥".repeat(s.strikes) + "⬜".repeat(Math.max(0, 4 - s.strikes));
    lines.push(`Jumbles No. ${p.id} — ${rank.emoji} ${rank.label}`);
    lines.push(`${words} ${bonusMark}`);
    if (!s.failed) lines.push(`Strikes ${pips}${s.hintsUsed ? `  ·  ${s.hintsUsed} hint${s.hintsUsed > 1 ? "s" : ""}` : ""}`);
  } else {
    lines.push(`Jumbles No. ${p.id} — Relaxed`);
    lines.push(`${words} ${bonusMark}`);
  }

  if (early && s.bonusSolved && !s.bonusHinted && !s.failed) {
    lines.push(`Cracked the bonus with ${s.solvedCountWhenBonus}/${p.words.length} words!`);
  }

  lines.push(SITE_URL);
  return lines.join("\n");
}
