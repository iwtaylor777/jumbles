"use client";

import { useEffect, useState } from "react";
import type { Puzzle } from "@/lib/types";
import type { GameState, Stats, Mode } from "@/lib/storage";
import { buildShare } from "@/lib/share";
import { rankFor, isEarlyFlair } from "@/lib/score";
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
export function HelpModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <Header title="How to play" onClose={onClose} />
      <div className="px-5 pb-6 space-y-4 text-[0.95rem]" style={{ color: "var(--text)" }}>
        <p style={{ color: "var(--muted)" }}>
          Unscramble all four words, then use the <b style={{ color: "var(--gold)" }}>circled</b> letters
          — revealed as you solve — to crack the bonus.
        </p>
        <ol className="space-y-3">
          {[
            ["Build each word", "Tap the jumbled letters into the slots (or type). Tap a slot to send a letter back."],
            ["Reveal the circles", "Solve a word and its circled letters light up and drop into the bonus below."],
            ["Crack the bonus", "Unscramble the circled letters — guided by the clue — to finish the day."],
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
        <div className="rule" />
        <div className="text-sm space-y-2" style={{ color: "var(--muted)" }}>
          <p>
            <b style={{ color: "var(--text)" }}>Challenge</b> — fill a word, then tap <b>Submit</b> (or press
            Enter) to lock it in. Four wrong guesses and you&rsquo;re jumbled. Hints cost your rank.
          </p>
          <p>
            <b style={{ color: "var(--text)" }}>Relaxed</b> — no strikes, free hints, words check themselves.
            Switch anytime with the mode pill up top.
          </p>
          <p>You&rsquo;re currently in <b style={{ color: "var(--text)" }}>{mode === "challenge" ? "Challenge" : "Relaxed"}</b> mode.</p>
        </div>
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
        <div className="grid grid-cols-3 gap-2">
          <Stat n={stats.flawless} label="Jumble Masters" />
          <Stat n={stats.earlyBonus} label="Early bonuses" />
          <Stat n={stats.losses} label="Jumbled" />
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

function ShareButton({ puzzle, state }: { puzzle: Puzzle; state: GameState }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = buildShare(puzzle, state);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }
  return (
    <button className="btn btn-primary w-full flex items-center justify-center gap-2" onClick={share}>
      <ShareIcon />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

function Countdown() {
  const countdown = useCountdown();
  return (
    <div className="mt-5">
      <div className="text-[0.7rem] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Next puzzle
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{countdown}</div>
    </div>
  );
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
  const rank = rankFor(state);
  const early = isEarlyFlair(state, puzzle.words.length);

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

        {rank ? (
          <>
            <h2 className="masthead text-2xl mt-3">
              {rank.emoji} {rank.label}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {rank.blurb}
              {early ? ` · early bonus` : ""}
            </p>
          </>
        ) : (
          <>
            <h2 className="masthead text-2xl mt-3">Nicely done{early ? " — early!" : ""}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Jumbles No. {puzzle.id} · Relaxed
            </p>
          </>
        )}

        <div className="grid grid-cols-3 gap-2 my-5">
          <Stat n={stats.played} label="Played" />
          <Stat n={stats.currentStreak} label="Streak" />
          <Stat n={stats.maxStreak} label="Max streak" />
        </div>

        <ShareButton puzzle={puzzle} state={state} />
        <Countdown />
      </div>
    </Overlay>
  );
}

// --------------------------------------------------------------------- Fail
export function FailModal({
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
  return (
    <Overlay onClose={onClose}>
      <div className="px-6 pt-7 pb-6 text-center">
        <div className="scatter text-4xl" aria-hidden>
          🤪
        </div>
        <h2 className="masthead mt-2" style={{ fontSize: "clamp(1.5rem,7.5vw,2rem)" }}>
          You&rsquo;ve been jumbled, fool!
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Out of strikes on Jumbles No. {puzzle.id}. The answer was:
        </p>
        <p className="masthead mt-1" style={{ color: "var(--gold)", fontSize: "clamp(1.4rem,7vw,1.9rem)", fontWeight: 600 }}>
          {puzzle.bonus.display}
        </p>

        <div className="grid grid-cols-3 gap-2 my-5">
          <Stat n={stats.played} label="Played" />
          <Stat n={stats.currentStreak} label="Streak" />
          <Stat n={stats.losses} label="Jumbled" />
        </div>

        <ShareButton puzzle={puzzle} state={state} />
        <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
          Prefer no strikes? Switch to Relaxed with the mode pill.
        </p>
        <Countdown />
      </div>
    </Overlay>
  );
}
