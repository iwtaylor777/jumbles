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
  challenge: boolean; // show a Submit button when full (Challenge mode)
  index: number;
  onFocus: () => void;
  onPlaceBank: (bankIdx: number) => void;
  onRemoveSlot: (slot: number) => void;
  onCommit: () => void;
};

export default function WordRow({
  word,
  placement,
  solved,
  revealed,
  focused,
  shaking,
  justSolved,
  challenge,
  onFocus,
  onPlaceBank,
  onRemoveSlot,
  onCommit,
}: Props) {
  const circled = new Set(word.circled);
  const full = placement.every((x) => x !== null);
  const rowVars = { "--n": word.answer.length } as React.CSSProperties;

  // solved (or revealed-on-fail) collapses to a compact row
  if (solved || revealed) {
    return (
      <div className="solvedrow fit py-1.5" style={rowVars} aria-label={`${solved ? "Solved" : "Answer"}: ${word.answer}`}>
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
                width: "calc(var(--cell) * 0.82)",
                height: "calc(var(--cell) * 0.82)",
                fontSize: "calc(var(--cell) * 0.38)",
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
    <div className={`wordcard fit${focused ? " focused" : ""} ${shaking ? "shake" : ""}`} style={rowVars} onClick={onFocus}>
      {/* answer slots — circled positions are hidden until the word is solved */}
      <div className="flex gap-1.5 justify-center">
        {placement.map((bankIdx, slot) => {
          const letter = bankIdx === null ? "" : word.scramble[bankIdx];
          const active = focused && bankIdx === null && placement.indexOf(null) === slot;
          return (
            <button
              key={slot}
              className={`tile slot${letter ? " filled" : ""}${active ? " active" : ""}`}
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

      {/* Challenge: a Submit button appears once the word is full */}
      {challenge && full && (
        <div className="flex justify-center mt-2.5">
          <button
            className="btn btn-primary submit-inline pulse"
            onClick={(e) => {
              e.stopPropagation();
              onCommit();
            }}
            aria-label={`Submit ${word.answer.length}-letter word`}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
