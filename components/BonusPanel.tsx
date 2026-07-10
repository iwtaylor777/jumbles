"use client";

import type { BonusSpec } from "@/lib/types";

export type BonusBankItem = { letter: string; word: number; available: boolean };

type Props = {
  bonus: BonusSpec;
  bank: BonusBankItem[];
  bankUsed: Set<number>;
  letters: (string | null)[];
  solved: boolean;
  revealed: boolean; // failed run — show the answer, greyed
  challenge: boolean;
  focused: boolean;
  shaking: boolean;
  onFocus: () => void;
  onPlaceBank: (bankIdx: number) => void;
  onRemoveSlot: (slot: number) => void;
  onCommit: () => void;
};

export default function BonusPanel({
  bonus,
  bank,
  bankUsed,
  letters,
  solved,
  revealed,
  challenge,
  focused,
  shaking,
  onFocus,
  onPlaceBank,
  onRemoveSlot,
  onCommit,
}: Props) {
  const full = letters.every((x) => x !== null);
  // group flat slot indices by the word-length pattern
  const groups: number[][] = [];
  let idx = 0;
  for (const len of bonus.pattern) {
    groups.push(Array.from({ length: len }, () => idx++));
  }

  return (
    <section
      className={`mt-1 rounded-2xl px-4 py-5 ${shaking ? "shake" : ""}`}
      style={{ background: "var(--surface-2)" }}
      onClick={onFocus}
      aria-label="Bonus round"
    >
      <div className="flex items-center gap-2 justify-center">
        <span
          className="text-[0.68rem] font-bold tracking-[0.18em] uppercase"
          style={{ color: "var(--gold)" }}
        >
          Bonus
        </span>
      </div>

      <p
        className="text-center mt-1.5 mb-4 text-[0.98rem] leading-snug"
        style={{ color: "var(--muted)" }}
      >
        &ldquo;{bonus.clue}&rdquo;
      </p>

      {solved || revealed ? (
        <p
          className={`masthead text-center${solved ? " pop" : ""}`}
          style={{
            color: solved ? "var(--gold)" : "var(--muted)",
            fontSize: "clamp(1.6rem, 8vw, 2.2rem)",
            fontWeight: 600,
          }}
        >
          {bonus.display}
        </p>
      ) : (
        <>
          {/* bonus slots */}
          <div className="flex gap-2 justify-center flex-wrap">
            {groups.map((g, gi) => (
              <div key={gi} className="flex gap-1.5">
                {g.map((slot) => {
                  const l = letters[slot];
                  return (
                    <button
                      key={slot}
                      className={`tile slot${l ? " filled" : ""}`}
                      style={{
                        width: "calc(var(--tile-size) * 0.9)",
                        height: "calc(var(--tile-size) * 0.9)",
                        fontSize: "calc(var(--tile-size) * 0.42)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l) onRemoveSlot(slot);
                        else onFocus();
                      }}
                      aria-label={l ? `Bonus letter ${l}, tap to remove` : "Empty bonus slot"}
                    >
                      {l ?? ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* circled-letter bank */}
          <div className="flex gap-1.5 justify-center mt-4 flex-wrap">
            {bank.map((b, i) =>
              !b.available ? (
                <span
                  key={i}
                  className="tile chip"
                  style={{ opacity: 0.35, cursor: "default", boxShadow: "none" }}
                  aria-hidden
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: "var(--muted)",
                      display: "block",
                    }}
                  />
                </span>
              ) : (
                <button
                  key={i}
                  className={`tile chip${bankUsed.has(i) ? " used" : ""}`}
                  style={{ borderColor: "var(--gold-tile)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlaceBank(i);
                  }}
                  disabled={bankUsed.has(i)}
                  aria-label={`Add circled letter ${b.letter}`}
                >
                  {b.letter}
                </button>
              ),
            )}
          </div>

          {challenge && full && (
            <div className="flex justify-center mt-4">
              <button
                className="btn btn-primary submit-inline pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommit();
                }}
                aria-label="Submit the bonus answer"
              >
                Submit bonus
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
