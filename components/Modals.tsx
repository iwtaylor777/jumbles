"use client";

import { useEffect, useState } from "react";
import type { Puzzle } from "@/lib/types";
import type { GameState, Stats } from "@/lib/storage";
import { buildShare } from "@/lib/share";
import { msUntilTomorrow } from "@/lib/puzzles";
import { CloseIcon, ShareIcon } from "./ui";

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2">
      <h2 className="masthead text-xl">{title}</h2>
      <button className="iconbtn" aria-label="Close" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- How to play
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <Header title="How to play" onClose={onClose} />
      <div className="px-5 pb-6 space-y-4 text-[0.95rem]" style={{ color: "var(--text)" }}>
        <p style={{ color: "var(--muted)" }}>
          Unscramble all four words, then use the <b style={{ color: "var(--gold)" }}>circled</b>{" "}
          letters to crack the bonus.
        </p>
        <ol className="space-y-3">
          {[
            ["Build each word", "Tap the jumbled letters to drop them into the slots. Tap a slot to send a letter back."],
            ["Watch the circles", "Each answer has circled positions. Those letters collect below in the bonus."],
            ["Solve the bonus", "Unscramble the circled letters — guided by the clue — to finish the day."],
          ].map(([h, b], i) => (
            <li key={i} className="flex gap-3">
              <span
                className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-sm font-bold"
                style={{ background: "var(--surface-2)", color: "var(--text)" }}
              >
                {i + 1}
              </span>
              <span>
                <b>{h}.</b> <span style={{ color: "var(--muted)" }}>{b}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A new puzzle arrives every day. Know the answer from the clue? Type it straight in for
          bonus bragging rights.
        </p>
        <button className="btn btn-primary w-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </Overlay>
  );
}

// --------------------------------------------------------------------- Stats
function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-[0.7rem] leading-tight mt-0.5" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

export function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  return (
    <Overlay onClose={onClose}>
      <Header title="Statistics" onClose={onClose} />
      <div className="px-5 pb-6">
        <div className="grid grid-cols-4 gap-2">
          <Stat n={stats.played} label="Played" />
          <Stat n={`${winPct}%`} label="Win rate" />
          <Stat n={stats.currentStreak} label="Streak" />
          <Stat n={stats.maxStreak} label="Max streak" />
        </div>
        <div className="rule my-5" />
        <div className="grid grid-cols-2 gap-2">
          <Stat n={stats.cleanSolves} label="No-hint solves" />
          <Stat n={stats.earlyBonus} label="Early bonuses" />
        </div>
      </div>
    </Overlay>
  );
}

// --------------------------------------------------------------- countdown
function useCountdown() {
  const [ms, setMs] = useState(() => msUntilTomorrow());
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// --------------------------------------------------------------------- Win
export function WinModal({
  puzzle,
  state,
  stats,
  onClose,
}: {
  puzzle: Puzzle;
  state: GameState;
  stats: Stats;
  onClose: () => void;
}) {
  const countdown = useCountdown();
  const [copied, setCopied] = useState(false);
  const early =
    state.solvedCountWhenBonus !== null && state.solvedCountWhenBonus < puzzle.words.length;
  const clean = state.hintsUsed === 0;

  async function share() {
    const text = buildShare(puzzle, state);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* user cancelled — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const headline = early ? "Cracked it early!" : clean ? "Flawless!" : "Solved!";

  return (
    <Overlay onClose={onClose}>
      <div className="px-6 pt-7 pb-6 text-center">
        <p className="text-[0.7rem] font-bold tracking-[0.18em] uppercase" style={{ color: "var(--gold)" }}>
          Bonus
        </p>
        <p
          className="masthead pop mt-1"
          style={{ color: "var(--gold)", fontSize: "clamp(1.8rem,9vw,2.4rem)", fontWeight: 600 }}
        >
          {puzzle.bonus.display}
        </p>
        <h2 className="masthead text-2xl mt-3">{headline}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Jumbles No. {puzzle.id}
          {early && state.bonusSolved
            ? ` · bonus with ${state.solvedCountWhenBonus}/${puzzle.words.length} words`
            : clean
              ? " · no hints"
              : ""}
        </p>

        <div className="grid grid-cols-3 gap-2 my-5">
          <Stat n={stats.played} label="Played" />
          <Stat n={stats.currentStreak} label="Streak" />
          <Stat n={stats.maxStreak} label="Max streak" />
        </div>

        <button className="btn btn-primary w-full flex items-center justify-center gap-2" onClick={share}>
          <ShareIcon />
          {copied ? "Copied!" : "Share"}
        </button>

        <div className="mt-5">
          <div className="text-[0.7rem] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Next puzzle
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{countdown}</div>
        </div>
      </div>
    </Overlay>
  );
}
