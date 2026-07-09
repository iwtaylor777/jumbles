"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Puzzle } from "@/lib/types";
import {
  loadState,
  saveState,
  loadStats,
  saveStats,
  recordWin,
  loadTheme,
  saveTheme,
  emptyStats,
  type GameState,
  type Stats,
  type Theme,
} from "@/lib/storage";
import { todaysPuzzle } from "@/lib/puzzles";
import WordRow from "./WordRow";
import BonusPanel, { type BonusBankItem } from "./BonusPanel";
import { HelpModal, StatsModal, WinModal } from "./Modals";
import { IconButton, InfoIcon, StatsIcon, SunIcon, MoonIcon, BulbIcon, ShareIcon } from "./ui";

type Focus = { kind: "word"; i: number } | { kind: "bonus" };

export default function Game() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [focus, setFocus] = useState<Focus>({ kind: "word", i: 0 });
  const [theme, setThemeState] = useState<Theme>("system");

  const [shakeWord, setShakeWord] = useState<number | null>(null);
  const [shakeBonus, setShakeBonus] = useState(false);
  const [justSolved, setJustSolved] = useState<number | null>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const recorded = useRef(false);
  const prevSolved = useRef<boolean[]>([]);
  const focusRef = useRef<Focus>({ kind: "word", i: 0 });
  focusRef.current = focus;

  // ------------------------------------------------------------ mount / load
  useEffect(() => {
    const p = todaysPuzzle();
    const st = loadState(p);
    setPuzzle(p);
    setGs(st);
    prevSolved.current = [...st.solved];
    const stat = loadStats();
    setStats(stat);
    recorded.current = st.completedAt != null;
    setThemeState(loadTheme());
    const firstUnsolved = st.solved.findIndex((s) => !s);
    const f: Focus = firstUnsolved === -1 ? { kind: "bonus" } : { kind: "word", i: firstUnsolved };
    setFocus(f);
    if (stat.played === 0 && st.completedAt == null && st.solved.every((s) => !s)) {
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
  // All mutations are pure (prev -> next) so functional setState composes
  // correctly even under very fast keyboard input (no stale-closure races).
  const applyPlaceBank = (prev: GameState, w: number, bankIdx: number): GameState => {
    if (!puzzle || prev.solved[w]) return prev;
    const row = [...prev.placement[w]];
    if (row.includes(bankIdx) || !row.includes(null)) return prev;
    row[row.indexOf(null)] = bankIdx;
    const placement = prev.placement.map((r, i) => (i === w ? row : r));
    if (!row.includes(null)) {
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
    if (!puzzle || prev.solved[w]) return prev;
    const row = prev.placement[w];
    for (let k = 0; k < 5; k++) {
      if (puzzle.words[w].scramble[k] === ch && !row.includes(k)) return applyPlaceBank(prev, w, k);
    }
    return prev;
  };

  const applyType = (prev: GameState, ch: string, f: Focus): GameState => {
    if (!puzzle) return prev;
    if (prev.solved.every(Boolean) || f.kind === "bonus") return applyBonusChar(prev, ch);
    const w = f.kind === "word" && !prev.solved[f.i] ? f.i : prev.solved.findIndex((s) => !s);
    if (w === -1) return applyBonusChar(prev, ch);
    return applyPlaceChar(prev, w, ch);
  };

  const applyRemoveSlot = (prev: GameState, w: number, slot: number): GameState => {
    if (prev.solved[w]) return prev;
    const row = [...prev.placement[w]];
    row[slot] = null;
    return { ...prev, placement: prev.placement.map((r, i) => (i === w ? row : r)) };
  };

  const applyBackspaceWord = (prev: GameState, w: number): GameState => {
    if (prev.solved[w]) return prev;
    const row = [...prev.placement[w]];
    for (let s = 4; s >= 0; s--)
      if (row[s] !== null) {
        row[s] = null;
        return { ...prev, placement: prev.placement.map((r, i) => (i === w ? row : r)) };
      }
    return prev;
  };

  const applyBonusPlace = (prev: GameState, letter: string, bankIdx: number | null): GameState => {
    if (!puzzle || prev.bonusSolved || !prev.bonusLetters.includes(null)) return prev;
    const slot = prev.bonusLetters.indexOf(null);
    const bonusLetters = [...prev.bonusLetters];
    const bonusSrc = [...prev.bonusSrc];
    bonusLetters[slot] = letter;
    bonusSrc[slot] = bankIdx;
    if (!bonusLetters.includes(null) && bonusLetters.join("") === puzzle.bonus.answer) {
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
    if (prev.bonusSolved || !prev.bonusLetters.includes(null)) return prev;
    let bankIdx: number | null = null;
    for (let i = 0; i < bonusBank.length; i++)
      if (bonusBank[i].available && bonusBank[i].letter === ch && !prev.bonusSrc.includes(i)) {
        bankIdx = i;
        break;
      }
    return applyBonusPlace(prev, ch, bankIdx);
  }

  const applyRemoveBonus = (prev: GameState, slot: number): GameState => {
    if (prev.bonusSolved) return prev;
    const bonusLetters = [...prev.bonusLetters];
    const bonusSrc = [...prev.bonusSrc];
    bonusLetters[slot] = null;
    bonusSrc[slot] = null;
    return { ...prev, bonusLetters, bonusSrc };
  };

  const applyBackspaceBonus = (prev: GameState): GameState => {
    if (prev.bonusSolved) return prev;
    for (let s = prev.bonusLetters.length - 1; s >= 0; s--)
      if (prev.bonusLetters[s] !== null) return applyRemoveBonus(prev, s);
    return prev;
  };

  const update = useCallback((fn: (p: GameState) => GameState) => {
    setGs((cur) => (cur ? fn(cur) : cur));
  }, []);

  // ---- tap handlers -------------------------------------------------------
  const placeBank = (w: number, bankIdx: number) => update((p) => applyPlaceBank(p, w, bankIdx));
  const removeSlot = (w: number, slot: number) => update((p) => applyRemoveSlot(p, w, slot));
  const placeBonusBank = (bankIdx: number) =>
    update((p) => {
      const item = bonusBank[bankIdx];
      if (!item?.available || p.bonusSrc.includes(bankIdx)) return p;
      return applyBonusPlace(p, item.letter, bankIdx);
    });
  const removeBonus = (slot: number) => update((p) => applyRemoveBonus(p, slot));

  // ------------------------------------------------------------------ hint
  const hint = () => {
    if (!puzzle || !gs) return;
    const allSolved = gs.solved.every(Boolean);
    if (!allSolved) {
      const w = focus.kind === "word" && !gs.solved[focus.i] ? focus.i : gs.solved.findIndex((s) => !s);
      if (w === -1) return;
      update((p) => {
        const word = puzzle.words[w];
        const row = [...p.placement[w]];
        for (let slot = 0; slot < 5; slot++) {
          const cur = row[slot] === null ? "" : word.scramble[row[slot] as number];
          if (cur === word.answer[slot]) continue;
          const need = word.answer[slot];
          let bi = -1;
          for (let k = 0; k < 5; k++) if (word.scramble[k] === need && !row.includes(k)) { bi = k; break; }
          if (bi === -1)
            for (let k = 0; k < 5; k++)
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
        let solved = p.solved;
        if (!row.includes(null) && row.map((b) => word.scramble[b as number]).join("") === word.answer) {
          solved = [...p.solved];
          solved[w] = true;
        }
        return { ...p, placement, hintedWords, hintsUsed: p.hintsUsed + 1, solved };
      });
      setFocus({ kind: "word", i: w });
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
          !bonusLetters.includes(null) && bonusLetters.join("") === ans;
        return {
          ...p,
          bonusLetters,
          bonusSrc,
          bonusHinted: true,
          hintsUsed: p.hintsUsed + 1,
          bonusSolved: solvedNow ? true : p.bonusSolved,
          solvedCountWhenBonus: solvedNow ? p.solved.filter(Boolean).length : p.solvedCountWhenBonus,
        };
      }
      return p;
    });
  };

  // ---- declarative side effects (no stale closures) -----------------------
  // newly solved word -> pop animation + advance focus
  useEffect(() => {
    if (!gs) return;
    gs.solved.forEach((s, w) => {
      if (s && !prevSolved.current[w]) {
        setJustSolved(w);
        setTimeout(() => setJustSolved((j) => (j === w ? null : j)), 700);
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

  // full-but-wrong word -> shake, then clear
  useEffect(() => {
    if (!gs) return;
    gs.placement.forEach((row, w) => {
      if (!gs.solved[w] && !row.includes(null) && shakeWord !== w) {
        setShakeWord(w);
        setTimeout(() => {
          setShakeWord((s) => (s === w ? null : s));
          update((p) => ({ ...p, placement: p.placement.map((r, i) => (i === w ? Array(5).fill(null) : r)) }));
        }, 460);
      }
    });
  }, [gs, shakeWord, update]);

  // full-but-wrong bonus -> shake, then clear
  useEffect(() => {
    if (!gs || gs.bonusSolved) return;
    if (!gs.bonusLetters.includes(null) && !shakeBonus) {
      setShakeBonus(true);
      setTimeout(() => {
        setShakeBonus(false);
        update((p) => ({ ...p, bonusLetters: p.bonusLetters.map(() => null), bonusSrc: p.bonusSrc.map(() => null) }));
      }, 460);
    }
  }, [gs, shakeBonus, update]);

  // bonus solved -> reveal board, record stats, confetti, win modal
  useEffect(() => {
    if (!puzzle || !gs || !gs.bonusSolved) return;
    if (!gs.solved.every(Boolean)) {
      update((p) => ({ ...p, solved: p.solved.map(() => true) }));
      return;
    }
    if (gs.completedAt == null) update((p) => ({ ...p, completedAt: Date.now() }));
    if (!recorded.current) {
      recorded.current = true;
      const early = (gs.solvedCountWhenBonus ?? 0) < puzzle.words.length;
      const ns = recordWin(stats, puzzle.date, gs.hintsUsed, early);
      setStats(ns);
      saveStats(ns);
      import("canvas-confetti")
        .then((m) => m.default({ particleCount: 130, spread: 72, origin: { y: 0.6 }, disableForReducedMotion: true }))
        .catch(() => {});
      setTimeout(() => setShowWin(true), 560);
    }
  }, [gs?.bonusSolved, gs?.solved]); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------------------------------------------------- keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showHelp || showStats || showWin) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        update((p) => applyType(p, e.key.toUpperCase(), focusRef.current));
        e.preventDefault();
      } else if (e.key === "Backspace") {
        update((p) => {
          const f = focusRef.current;
          if (p.solved.every(Boolean) || f.kind === "bonus") return applyBackspaceBonus(p);
          return applyBackspaceWord(p, f.i);
        });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp, showStats, showWin, bonusBank]); // eslint-disable-line react-hooks/exhaustive-deps

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
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const dark = document.documentElement.classList.contains("dark");
  const completed = gs.completedAt != null;

  return (
    <div className="wrap">
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
      <p className="text-center text-[0.8rem] tracking-wide mt-2.5 mb-4" style={{ color: "var(--muted)" }}>
        {dateLabel} · No. {puzzle.id}
      </p>

      <div className="space-y-3">
        {puzzle.words.map((w, i) => (
          <WordRow
            key={i}
            index={i}
            word={w}
            placement={gs.placement[i]}
            solved={gs.solved[i]}
            focused={focus.kind === "word" && focus.i === i && !gs.solved[i]}
            shaking={shakeWord === i}
            justSolved={justSolved === i}
            onFocus={() => setFocus({ kind: "word", i })}
            onPlaceBank={(bi) => placeBank(i, bi)}
            onRemoveSlot={(s) => removeSlot(i, s)}
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
          focused={focus.kind === "bonus"}
          shaking={shakeBonus}
          onFocus={() => setFocus({ kind: "bonus" })}
          onPlaceBank={placeBonusBank}
          onRemoveSlot={removeBonus}
        />
      </div>

      <div className="flex items-center justify-center gap-3 mt-5">
        {completed ? (
          <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowWin(true)}>
            <ShareIcon /> View result
          </button>
        ) : (
          <button className="btn btn-ghost flex items-center gap-2" onClick={hint} aria-label="Reveal a letter">
            <BulbIcon /> Hint
          </button>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
      {showWin && <WinModal puzzle={puzzle} state={gs} stats={stats} onClose={() => setShowWin(false)} />}
    </div>
  );
}
