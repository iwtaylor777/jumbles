"use client";

import type { WordSpec } from "@/lib/types";

type Props = {
  word: WordSpec;
  placement: (number | null)[];
  solved: boolean;
  revealed: boolean; // failed run — show the answer, greyed
  focused: boolean;
  shaking: boolean;
  justSolved: boolean;
  index: number;
  onFocus: () => void;
  onPlaceBank: (bankIdx: number) => void;
  onRemoveSlot: (slot: number) => void;
};

export default function WordRow({
  word,
  placement,
  solved,
  revealed,
  focused,
  shaking,
  justSolved,
  onFocus,
  onPlaceBank,
  onRemoveSlot,
}: Props) {
  const circled = new Set(word.circled);

  // solved (or revealed-on-fail) collapses to a compact row
  if (solved || revealed) {
    return (
      <div className="solvedrow py-1.5" aria-label={`${solved ? "Solved" : "Answer"}: ${word.answer}`}>
        <span className={solved ? "text-accent shrink-0" : "shrink-0"} style={solved ? undefined : { color: "var(--muted)" }} aria-hidden>
          {solved ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          )}
        </span>
        <div className="flex gap-1.5">
          {word.answer.split("").map((ch, i) => (
            <span
              key={i}
              className={`tile slot ${solved ? "solved" : "revealed"}${circled.has(i) ? " circled" : ""}${justSolved && solved && circled.has(i) ? " pop" : ""}`}
              style={{
                width: "calc(var(--tile-size) * 0.82)",
                height: "calc(var(--tile-size) * 0.82)",
                fontSize: "calc(var(--tile-size) * 0.38)",
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const bankUsed = new Set(placement.filter((x): x is number => x !== null));

  return (
    <div className={`wordcard${focused ? " focused" : ""} ${shaking ? "shake" : ""}`} onClick={onFocus}>
      {/* answer slots — circled positions are hidden until the word is solved */}
      <div className="flex gap-1.5 justify-center">
        {placement.map((bankIdx, slot) => {
          const letter = bankIdx === null ? "" : word.scramble[bankIdx];
          return (
            <button
              key={slot}
              className={`tile slot${letter ? " filled" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (letter) onRemoveSlot(slot);
                else onFocus();
              }}
              aria-label={letter ? `Slot ${slot + 1}, ${letter}. Tap to remove` : `Empty slot ${slot + 1}`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* letter bank */}
      <div className="flex gap-1.5 justify-center mt-2.5">
        {word.scramble.split("").map((ch, i) => (
          <button
            key={i}
            className={`tile chip${bankUsed.has(i) ? " used" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlaceBank(i);
            }}
            disabled={bankUsed.has(i)}
            aria-label={`Add letter ${ch}`}
            aria-hidden={bankUsed.has(i)}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
}
