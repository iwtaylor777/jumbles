"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Puzzle } from "@/lib/types";
import {
  loadState,
  saveState,
  loadStats,
  saveStats,
  recordResult,
  loadTheme,
  saveTheme,
  loadMode,
  saveMode,
  emptyStats,
  MAX_STRIKES,
  type GameState,
  type Stats,
  type Theme,
  type Mode,
} from "@/lib/storage";
import { todaysPuzzle, puzzleForDate } from "@/lib/puzzles";
import WordRow from "./WordRow";
import BonusPanel, { type BonusBankItem } from "./BonusPanel";
import { HelpModal, StatsModal, WinModal, FailModal } from "./Modals";
import { IconButton, InfoIcon, StatsIcon, SunIcon, MoonIcon, BulbIcon, ShareIcon, ClockIcon } from "./ui";
import { formatDuration } from "@/lib/score";

type Focus = { kind: "word"; i: number } | { kind: "bonus" };

/** The first real move starts the clock. */
const stampStart = (prev: GameState, next: GameState): GameState =>
  next !== prev && next.startedAt == null ? { ...next, startedAt: Date.now() } : next;

export default function Game() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [focus, setFocus] = useState<Focus>({ kind: "word", i: 0 });
  const [theme, setThemeState] = useState<Theme>("system");

  const [shakeWord, setShakeWord] = useState<number | null>(null);
  const [shakeBonus, setShakeBonus] = useState(false);
  const [justSolved, setJustSolved] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [showFail, setShowFail] = useState(false);
  const recorded = useRef(false);
  const prevSolved = useRef<boolean[]>([]);
  const focusRef = useRef<Focus>({ kind: "word", i: 0 });
  focusRef.current = focus;
  // live refs so commit guards never read stale animation state
  const shakeWordRef = useRef<number | null>(null);
  shakeWordRef.current = shakeWord;
  const shakeBonusRef = useRef(false);
  shakeBonusRef.current = shakeBonus;

  // ------------------------------------------------------------ mount / load
  useEffect(() => {
    let p = todaysPuzzle();
    // dev-only QA override: /?d=2026-07-17 previews that day's puzzle
    if (process.env.NODE_ENV !== "production") {
      const d = new URLSearchParams(window.location.search).get("d");
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) p = puzzleForDate(d);
    }
    const mode = loadMode();
    const st = loadState(p, mode);
    setPuzzle(p);
    setGs(st);
    prevSolved.current = [...st.solved];
    setStats(loadStats());
    recorded.current = st.completedAt != null || st.failed;
    setThemeState(loadTheme());
    const firstUnsolved = st.solved.findIndex((s) => !s);
    setFocus(firstUnsolved === -1 ? { kind: "bonus" } : { kind: "word", i: firstUnsolved });
    const stat = loadStats();
    if (stat.played === 0 && st.completedAt == null && !st.failed && st.solved.every((s) => !s)) {
      setShowHelp(true);
    }
  }, []);

  useEffect(() => {
    if (gs) saveState(gs);
  }, [gs]);

  const applyTheme = (t: Theme) => {
    setThemeState(t);
    saveTheme(t);
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };

  const setMode = (m: Mode) => {
    saveMode(m);
    // switching keeps board progress but resets stakes for the current puzzle
    setGs((c) => (c ? { ...c, mode: m, strikes: 0, failed: false } : c));
    recorded.current = false;
    setShowFail(false);
    setAnnounce(m === "relaxed" ? "Relaxed mode. No strikes." : "Challenge mode. Four strikes.");
  };

  // -------------------------------------------------------------- derived
  const bonusBank: BonusBankItem[] = useMemo(() => {
    if (!puzzle || !gs) return [];
    const items: BonusBankItem[] = [];
    puzzle.words.forEach((w, wi) => {
      [...w.circled]
        .sort((a, b) => a - b)
        .forEach((ci) => items.push({ letter: w.answer[ci], word: wi, available: gs.solved[wi] }));
    });
    return items;
  }, [puzzle, gs]);

  const bonusBankUsed = useMemo(
    () => new Set((gs?.bonusSrc ?? []).filter((x): x is number => x !== null)),
    [gs],
  );

  // ----------------------------------------------- pure state transitions
  const applyPlaceBank = (prev: GameState, w: number, bankIdx: number): GameState => {
    if (!puzzle || prev.solved[w] || prev.failed) return prev;
    const row = [...prev.placement[w]];
    if (row.includes(bankIdx) || !row.includes(null)) return prev;
    row[row.indexOf(null)] = bankIdx;
    const placement = prev.placement.map((r, i) => (i === w ? row : r));
    // auto-check ONLY in relaxed mode (challenge requires an explicit commit)
    if (prev.mode === "relaxed" && !row.includes(null)) {
      const attempt = row.map((bi) => puzzle.words[w].scramble[bi as number]).join("");
      if (attempt === puzzle.words[w].answer) {
        const solved = [...prev.solved];
        solved[w] = true;
        return { ...prev, placement, solved };
      }
    }
    return { ...prev, placement };
  };

  const applyPlaceChar = (prev: GameState, w: number, ch: string): GameState => {
    if (!puzzle || prev.solved[w] || prev.failed) return prev;
    const row = prev.placement[w];
    const scr = puzzle.words[w].scramble;
    for (let k = 0; k < scr.length; k++)
      if (scr[k] === ch && !row.includes(k)) return applyPlaceBank(prev, w, k);
    return prev;
  };

  const applyType = (prev: GameState, ch: string, f: Focus): GameState => {
    if (!puzzle || prev.failed) return prev;
    if (prev.solved.every(Boolean) || f.kind === "bonus") return applyBonusChar(prev, ch);
    const w = f.kind === "word" && !prev.solved[f.i] ? f.i : prev.solved.findIndex((s) => !s);
    if (w === -1) return applyBonusChar(prev, ch);
    return applyPlaceChar(prev, w, ch);
  };

  const applyRemoveSlot = (prev: GameState, w: number, slot: number): GameState => {
    if (prev.solved[w] || prev.failed) return prev;
    const row = [...prev.placement[w]];
    row[slot] = null;
    return { ...prev, placement: prev.placement.map((r, i) => (i === w ? row : r)) };
  };

  const applyBackspaceWord = (prev: GameState, w: number): GameState => {
    if (prev.solved[w] || prev.failed) return prev;
    const row = [...prev.placement[w]];
    for (let s = row.length - 1; s >= 0; s--)
      if (row[s] !== null) {
        row[s] = null;
        return { ...prev, placement: prev.placement.map((r, i) => (i === w ? row : r)) };
      }
    return prev;
  };

  const applyBonusPlace = (prev: GameState, letter: string, bankIdx: number | null): GameState => {
    if (!puzzle || prev.bonusSolved || prev.failed || !prev.bonusLetters.includes(null)) return prev;
    const slot = prev.bonusLetters.indexOf(null);
    const bonusLetters = [...prev.bonusLetters];
    const bonusSrc = [...prev.bonusSrc];
    bonusLetters[slot] = letter;
    bonusSrc[slot] = bankIdx;
    if (
      prev.mode === "relaxed" &&
      !bonusLetters.includes(null) &&
      bonusLetters.join("") === puzzle.bonus.answer
    ) {
      return {
        ...prev,
        bonusLetters,
        bonusSrc,
        bonusSolved: true,
        solvedCountWhenBonus: prev.solved.filter(Boolean).length,
      };
    }
    return { ...prev, bonusLetters, bonusSrc };
  };

  function applyBonusChar(prev: GameState, ch: string): GameState {
    if (prev.bonusSolved || prev.failed || !prev.bonusLetters.includes(null)) return prev;
    let bankIdx: number | null = null;
    for (let i = 0; i < bonusBank.length; i++)
      if (bonusBank[i].available && bonusBank[i].letter === ch && !prev.bonusSrc.includes(i)) {
        bankIdx = i;
        break;
      }
    return applyBonusPlace(prev, ch, bankIdx);
  }

  const applyRemoveBonus = (prev: GameState, slot: number): GameState => {
    if (prev.bonusSolved || prev.failed) return prev;
    const bonusLetters = [...prev.bonusLetters];
    const bonusSrc = [...prev.bonusSrc];
    bonusLetters[slot] = null;
    bonusSrc[slot] = null;
    return { ...prev, bonusLetters, bonusSrc };
  };

  const applyBackspaceBonus = (prev: GameState): GameState => {
    if (prev.bonusSolved || prev.failed) return prev;
    for (let s = prev.bonusLetters.length - 1; s >= 0; s--)
      if (prev.bonusLetters[s] !== null) return applyRemoveBonus(prev, s);
    return prev;
  };

  const update = useCallback((fn: (p: GameState) => GameState) => {
    setGs((cur) => (cur ? fn(cur) : cur));
  }, []);

  const placeBank = (w: number, bankIdx: number) =>
    update((p) => stampStart(p, applyPlaceBank(p, w, bankIdx)));
  const removeSlot = (w: number, slot: number) => update((p) => applyRemoveSlot(p, w, slot));
  const placeBonusBank = (bankIdx: number) =>
    update((p) => {
      const item = bonusBank[bankIdx];
      if (!item?.available || p.bonusSrc.includes(bankIdx)) return p;
      return stampStart(p, applyBonusPlace(p, item.letter, bankIdx));
    });
  const removeBonus = (slot: number) => update((p) => applyRemoveBonus(p, slot));

  // ------------------------------------------------ commit (challenge mode)
  const strike = () =>
    update((p) => {
      const strikes = p.strikes + 1;
      return { ...p, strikes, failed: strikes >= MAX_STRIKES };
    });

  const commitWord = (w: number) => {
    if (!puzzle || !gs || gs.mode !== "challenge" || gs.solved[w] || gs.failed || shakeWordRef.current === w)
      return;
    const row = gs.placement[w];
    if (row.includes(null)) {
      setAnnounce("Fill all the letters first.");
      return;
    }
    const attempt = row.map((bi) => puzzle.words[w].scramble[bi as number]).join("");
    if (attempt === puzzle.words[w].answer) {
      update((p) => {
        const solved = [...p.solved];
        solved[w] = true;
        return { ...p, solved };
      });
    } else {
      const next = gs.strikes + 1;
      strike();
      setShakeWord(w);
      setTimeout(() => setShakeWord((s) => (s === w ? null : s)), 460);
      setAnnounce(
        next >= MAX_STRIKES
          ? "Out of strikes. You've been jumbled."
          : `Not the word. Strike ${next} of ${MAX_STRIKES}.`,
      );
    }
  };

  const commitBonus = () => {
    if (!puzzle || !gs || gs.mode !== "challenge" || gs.bonusSolved || gs.failed || shakeBonusRef.current) return;
    if (gs.bonusLetters.includes(null)) {
      setAnnounce("Fill in the whole bonus first.");
      return;
    }
    if (gs.bonusLetters.join("") === puzzle.bonus.answer) {
      update((p) => ({
        ...p,
        bonusSolved: true,
        solvedCountWhenBonus: p.solved.filter(Boolean).length,
      }));
    } else {
      const next = gs.strikes + 1;
      strike();
      setShakeBonus(true);
      setTimeout(() => setShakeBonus(false), 460);
      setAnnounce(
        next >= MAX_STRIKES
          ? "Out of strikes. You've been jumbled."
          : `Not the bonus. Strike ${next} of ${MAX_STRIKES}.`,
      );
    }
  };

  const commitFocus = () => {
    const f = focusRef.current;
    if (!gs) return;
    if (gs.solved.every(Boolean) || f.kind === "bonus") commitBonus();
    else if (f.kind === "word") commitWord(f.i);
  };

  // ------------------------------------------------------------------ hint
  const hint = () => {
    if (!puzzle || !gs || gs.failed) return;
    const allSolved = gs.solved.every(Boolean);
    if (!allSolved) {
      const w = focus.kind === "word" && !gs.solved[focus.i] ? focus.i : gs.solved.findIndex((s) => !s);
      if (w === -1) return;
      update((p) => {
        const word = puzzle.words[w];
        const len = word.answer.length;
        const row = [...p.placement[w]];
        for (let slot = 0; slot < len; slot++) {
          const cur = row[slot] === null ? "" : word.scramble[row[slot] as number];
          if (cur === word.answer[slot]) continue;
          const need = word.answer[slot];
          let bi = -1;
          for (let k = 0; k < len; k++) if (word.scramble[k] === need && !row.includes(k)) { bi = k; break; }
          if (bi === -1)
            for (let k = 0; k < len; k++)
              if (word.scramble[k] === need) {
                const at = row.indexOf(k);
                if (at !== -1) row[at] = null;
                bi = k;
                break;
              }
          row[slot] = bi;
          break;
        }
        const placement = p.placement.map((r, i) => (i === w ? row : r));
        const hintedWords = [...p.hintedWords];
        hintedWords[w] = true;
        // a hint that completes the word in relaxed auto-solves; challenge still needs commit
        let solved = p.solved;
        if (
          p.mode === "relaxed" &&
          !row.includes(null) &&
          row.map((b) => word.scramble[b as number]).join("") === word.answer
        ) {
          solved = [...p.solved];
          solved[w] = true;
        }
        return stampStart(p, { ...p, placement, hintedWords, hintsUsed: p.hintsUsed + 1, solved });
      });
      setFocus({ kind: "word", i: w });
      setAnnounce("Hint used: a letter was revealed.");
      return;
    }
    if (gs.bonusSolved) return;
    update((p) => {
      const ans = puzzle.bonus.answer;
      for (let s = 0; s < ans.length; s++) {
        if (p.bonusLetters[s] === ans[s]) continue;
        let bankIdx: number | null = null;
        for (let i = 0; i < bonusBank.length; i++)
          if (bonusBank[i].available && bonusBank[i].letter === ans[s] && !p.bonusSrc.includes(i)) {
            bankIdx = i;
            break;
          }
        const bonusLetters = [...p.bonusLetters];
        const bonusSrc = [...p.bonusSrc];
        bonusLetters[s] = ans[s];
        bonusSrc[s] = bankIdx;
        const solvedNow =
          p.mode === "relaxed" && !bonusLetters.includes(null) && bonusLetters.join("") === ans;
        return stampStart(p, {
          ...p,
          bonusLetters,
          bonusSrc,
          bonusHinted: true,
          hintsUsed: p.hintsUsed + 1,
          bonusSolved: solvedNow ? true : p.bonusSolved,
          solvedCountWhenBonus: solvedNow ? p.solved.filter(Boolean).length : p.solvedCountWhenBonus,
        });
      }
      return p;
    });
    setAnnounce("Hint used: a bonus letter was revealed.");
  };

  // ---- declarative side effects ------------------------------------------
  useEffect(() => {
    if (!gs || !puzzle) return;
    gs.solved.forEach((s, w) => {
      if (s && !prevSolved.current[w]) {
        setJustSolved(w);
        setTimeout(() => setJustSolved((j) => (j === w ? null : j)), 700);
        setAnnounce(`${puzzle.words[w].answer} — solved.`);
        for (let d = 1; d <= gs.solved.length; d++) {
          const i = (w + d) % gs.solved.length;
          if (!gs.solved[i]) {
            setFocus({ kind: "word", i });
            break;
          }
          if (d === gs.solved.length) setFocus({ kind: "bonus" });
        }
      }
    });
    prevSolved.current = [...gs.solved];
  }, [gs?.solved]); // eslint-disable-line react-hooks/exhaustive-deps

  // relaxed-only: a full-but-wrong word shakes (once per arrangement) but keeps
  // the letters — clearing a 6-7 letter row for one wrong order is too punishing
  const lastWrongRow = useRef<Record<number, string>>({});
  useEffect(() => {
    if (!gs || gs.mode !== "relaxed") return;
    gs.placement.forEach((row, w) => {
      if (gs.solved[w] || row.includes(null)) return;
      const arrangement = row.join(",");
      if (lastWrongRow.current[w] === arrangement || shakeWord === w) return;
      lastWrongRow.current[w] = arrangement;
      setShakeWord(w);
      setAnnounce("Not quite — rearrange the letters.");
      setTimeout(() => setShakeWord((s) => (s === w ? null : s)), 460);
    });
  }, [gs, shakeWord]);

  // relaxed-only: a full-but-wrong bonus shakes (once per arrangement), keeps letters
  const lastWrongBonus = useRef("");
  useEffect(() => {
    if (!gs || gs.mode !== "relaxed" || gs.bonusSolved) return;
    if (gs.bonusLetters.includes(null) || shakeBonus) return;
    const arrangement = gs.bonusLetters.join(",");
    if (lastWrongBonus.current === arrangement) return;
    lastWrongBonus.current = arrangement;
    setShakeBonus(true);
    setAnnounce("Not the bonus yet — rearrange the letters.");
    setTimeout(() => setShakeBonus(false), 460);
  }, [gs, shakeBonus]);

  // win
  useEffect(() => {
    if (!puzzle || !gs || !gs.bonusSolved) return;
    const finishedAt = gs.completedAt ?? Date.now();
    if (gs.completedAt == null) update((p) => ({ ...p, completedAt: finishedAt }));
    if (!recorded.current) {
      recorded.current = true;
      const early = (gs.solvedCountWhenBonus ?? 0) < puzzle.words.length;
      const ns = recordResult(stats, puzzle.date, {
        won: true,
        mode: gs.mode,
        hintsUsed: gs.hintsUsed,
        strikes: gs.strikes,
        early,
        elapsedMs: gs.startedAt != null ? finishedAt - gs.startedAt : null,
      });
      setStats(ns);
      saveStats(ns);
      setAnnounce("Solved! Bonus complete.");
      import("canvas-confetti")
        .then((m) => m.default({ particleCount: 130, spread: 72, origin: { y: 0.6 }, disableForReducedMotion: true }))
        .catch(() => {});
      setTimeout(() => setShowWin(true), 560);
    }
  }, [gs?.bonusSolved]); // eslint-disable-line react-hooks/exhaustive-deps

  // loss
  useEffect(() => {
    if (!puzzle || !gs || !gs.failed) return;
    if (gs.completedAt == null) update((p) => ({ ...p, completedAt: Date.now() }));
    if (!recorded.current) {
      recorded.current = true;
      const ns = recordResult(stats, puzzle.date, {
        won: false,
        mode: gs.mode,
        hintsUsed: gs.hintsUsed,
        strikes: gs.strikes,
        early: false,
      });
      setStats(ns);
      saveStats(ns);
      setAnnounce("You've been jumbled. The answers are revealed.");
      setTimeout(() => setShowFail(true), 620);
    }
  }, [gs?.failed]); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------------------------------------------------- keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showHelp || showStats || showWin || showFail) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        update((p) => stampStart(p, applyType(p, e.key.toUpperCase(), focusRef.current)));
        e.preventDefault();
      } else if (e.key === "Backspace") {
        update((p) => {
          const f = focusRef.current;
          if (p.solved.every(Boolean) || f.kind === "bonus") return applyBackspaceBonus(p);
          return applyBackspaceWord(p, f.i);
        });
        e.preventDefault();
      } else if (e.key === "Enter") {
        commitFocus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp, showStats, showWin, showFail, bonusBank, gs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------ render
  if (!puzzle || !gs) {
    return (
      <div className="wrap pt-24 text-center" style={{ color: "var(--muted)" }}>
        <div className="masthead text-3xl" style={{ color: "var(--text)" }}>
          Jumbles
        </div>
        <p className="mt-3">Loading today&rsquo;s puzzle…</p>
      </div>
    );
  }

  const dateLabel = new Date(puzzle.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const dark = document.documentElement.classList.contains("dark");
  const done = gs.completedAt != null || gs.failed;
  const challenge = gs.mode === "challenge";

  return (
    <div className="wrap">
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <header className="flex items-center justify-between pt-4 pb-3">
        <div className="w-24 flex">
          <IconButton label="How to play" onClick={() => setShowHelp(true)}>
            <InfoIcon />
          </IconButton>
        </div>
        <h1 className="masthead text-center" style={{ fontSize: "1.9rem", lineHeight: 1 }}>
          Jumbles
        </h1>
        <div className="w-24 flex justify-end">
          <IconButton label="Statistics" onClick={() => setShowStats(true)}>
            <StatsIcon />
          </IconButton>
          <IconButton label="Toggle theme" onClick={() => applyTheme(dark ? "light" : "dark")}>
            {dark ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </div>
      </header>

      <div className="rule" />

      {/* status row: date/number + mode + strikes */}
      <div className="flex items-center justify-between mt-2.5 mb-4 text-[0.8rem]" style={{ color: "var(--muted)" }}>
        <span>
          {dateLabel} · No. {puzzle.id}
        </span>
        <div className="flex items-center gap-2">
          {challenge && (
            <TimerChip startedAt={gs.startedAt} completedAt={gs.completedAt} failed={gs.failed} />
          )}
          {challenge && !done && <Strikes used={gs.strikes} />}
          <button
            className="modepill"
            onClick={() => setMode(challenge ? "relaxed" : "challenge")}
            aria-label={`Mode: ${challenge ? "Challenge" : "Relaxed"}. Tap to switch.`}
            title="Switch mode"
          >
            {challenge ? "Challenge" : "Relaxed"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {puzzle.words.map((w, i) => (
          <WordRow
            key={i}
            index={i}
            word={w}
            placement={gs.placement[i]}
            solved={gs.solved[i]}
            revealed={gs.failed}
            focused={focus.kind === "word" && focus.i === i && !gs.solved[i]}
            shaking={shakeWord === i}
            justSolved={justSolved === i}
            challenge={challenge && !done}
            onFocus={() => setFocus({ kind: "word", i })}
            onPlaceBank={(bi) => placeBank(i, bi)}
            onRemoveSlot={(s) => removeSlot(i, s)}
            onCommit={() => commitWord(i)}
          />
        ))}
      </div>

      <div className="mt-4">
        <BonusPanel
          bonus={puzzle.bonus}
          bank={bonusBank}
          bankUsed={bonusBankUsed}
          letters={gs.bonusLetters}
          solved={gs.bonusSolved}
          revealed={gs.failed}
          challenge={challenge && !done}
          focused={focus.kind === "bonus"}
          shaking={shakeBonus}
          onFocus={() => setFocus({ kind: "bonus" })}
          onPlaceBank={placeBonusBank}
          onRemoveSlot={removeBonus}
          onCommit={commitBonus}
        />
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-3 mt-5">
        {done ? (
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => (gs.failed ? setShowFail(true) : setShowWin(true))}
          >
            <ShareIcon /> View result
          </button>
        ) : (
          <button className="btn btn-ghost flex items-center gap-2" onClick={hint} aria-label="Reveal a letter (costs your grade in Challenge)">
            <BulbIcon /> Hint
          </button>
        )}
      </div>

      {showHelp && <HelpModal mode={gs.mode} onClose={() => setShowHelp(false)} />}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
      {showWin && <WinModal puzzle={puzzle} state={gs} stats={stats} onClose={() => setShowWin(false)} />}
      {showFail && <FailModal puzzle={puzzle} state={gs} stats={stats} onClose={() => setShowFail(false)} />}
    </div>
  );
}

function TimerChip({
  startedAt,
  completedAt,
  failed,
}: {
  startedAt: number | null;
  completedAt: number | null;
  failed: boolean;
}) {
  const running = startedAt != null && completedAt == null && !failed;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  if (startedAt == null) return null;
  const ms = (completedAt ?? now) - startedAt;
  return (
    <span className="timerchip" aria-label={`Time: ${formatDuration(ms)}`}>
      <ClockIcon width={13} height={13} strokeWidth={2.4} />
      {formatDuration(ms)}
    </span>
  );
}

function Strikes({ used }: { used: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Strikes: ${used} of ${MAX_STRIKES}`}>
      {Array.from({ length: MAX_STRIKES }).map((_, i) => (
        <span key={i} className={`strike${i < used ? " spent" : ""}`} aria-hidden>
          {i < used ? "✕" : ""}
        </span>
      ))}
    </span>
  );
}
