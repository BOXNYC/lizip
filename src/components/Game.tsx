"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/Board";
import { saveResult, useProgress } from "@/lib/progress";
import { DIFFICULTIES, PUZZLES, formatTime, hintPath, indexPuzzle, moveToward, stepTo, type Difficulty } from "@/lib/zip";

interface GameProps {
  difficulty: Difficulty;
  number: number;
  onBack: () => void;
  onNext: (() => void) | null;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export default function Game({ difficulty, number, onBack, onNext }: GameProps) {
  const puzzle = PUZZLES[difficulty][number - 1];
  const ix = useMemo(() => indexPuzzle(puzzle), [puzzle]);
  const progress = useProgress();
  const result = progress[puzzle.id];

  const [path, setPath] = useState<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [solvedIn, setSolvedIn] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hints, setHints] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const pathRef = useRef<number[]>([]);
  const gestureStart = useRef<number[] | null>(null);
  const solved = solvedIn !== null;

  function update(next: number[]) {
    if (next === pathRef.current || solved) return;
    pathRef.current = next;
    setPath(next);
    if (next.length === ix.total) {
      const ms = Date.now() - startedAt;
      setSolvedIn(ms);
      setNewBest(result !== undefined && ms < result.best);
      saveResult(puzzle.id, ms);
      setTimeout(() => setShowModal(true), 900);
    }
  }

  function commit(next: number[]) {
    const prev = pathRef.current;
    if (next === prev) return;
    setHistory((h) => [...h, prev]);
    update(next);
  }

  function undo() {
    if (solved || !history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    update(prev);
  }

  function clear() {
    if (solved || !pathRef.current.length) return;
    commit([]);
  }

  function hint() {
    if (solved) return;
    setHints((n) => n + 1);
    commit(hintPath(puzzle, ix, pathRef.current));
  }

  // Timer tick.
  useEffect(() => {
    if (solved) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [solved]);

  // Keyboard: arrows extend/backtrack from the head, Ctrl/Cmd+Z undoes.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      const dir = ARROWS[e.key];
      if (!dir) return;
      e.preventDefault();
      const cur = pathRef.current;
      if (!cur.length) {
        const start = puzzle.clues.find(([, n]) => n === 1)![0];
        commit([start]);
        return;
      }
      const head = cur[cur.length - 1];
      const r = Math.floor(head / ix.size) + dir[0];
      const c = (head % ix.size) + dir[1];
      if (r < 0 || c < 0 || r >= ix.size || c >= ix.size) return;
      const next = stepTo(ix, cur, r * ix.size + c);
      if (next) commit(next);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const elapsed = solvedIn ?? now - startedAt;
  const label = DIFFICULTIES.find((d) => d.key === difficulty)!.label;

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <button onClick={onBack} className="btn-ghost -ml-2" aria-label="Back to puzzles">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Puzzles
        </button>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-lg font-bold tracking-tight">LIZip #{number}</span>
          <span className="text-xs font-medium text-[var(--muted)]">
            {label} · {puzzle.size}×{puzzle.size}
          </span>
        </div>
        <div
          className="flex min-w-[84px] items-center justify-end gap-1.5 font-semibold tabular-nums"
          aria-label="Elapsed time"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" strokeLinecap="round" />
          </svg>
          {formatTime(elapsed)}
        </div>
      </header>

      <div className="relative overflow-hidden rounded-2xl border-[3px] border-[var(--wall)] shadow-sm">
        <Board
          puzzle={puzzle}
          path={path}
          solved={solved}
          onPress={(cell) => {
            gestureStart.current = pathRef.current;
            const next = stepTo(ix, pathRef.current, cell);
            if (next) update(next);
          }}
          onDrag={(cell) => update(moveToward(ix, pathRef.current, cell))}
          canMoveTo={(cell) => stepTo(ix, path, cell) !== null}
          onRelease={() => {
            const start = gestureStart.current;
            gestureStart.current = null;
            if (start && start !== pathRef.current) setHistory((h) => [...h, start]);
          }}
        />
      </div>

      {solved ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="font-semibold tabular-nums">Solved in {formatTime(solvedIn)}</span>
          {onNext && (
            <button className="btn-pill" onClick={onNext}>
              Next puzzle
            </button>
          )}
        </div>
      ) : (
      <div className="mt-4 flex items-center justify-center gap-3">
        <button className="btn-pill" onClick={undo} disabled={!history.length}>
          Undo
        </button>
        <button className="btn-pill" onClick={hint}>
          Hint
        </button>
        <button className="btn-pill" onClick={clear} disabled={!path.length}>
          Clear
        </button>
      </div>
      )}

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Connect the dots in order and fill every cell.
        {result && !solved && <> Your best: <b className="tabular-nums">{formatTime(result.best)}</b></>}
      </p>

      {solved && showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="zip-pop w-full max-w-sm rounded-3xl bg-[var(--card)] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)]">
              <svg viewBox="0 0 24 24" className="size-8 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">You&apos;re crushing it!</h2>
            <p className="mt-1 text-[var(--muted)]">
              LIZip #{number} · {label}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Time</div>
                <div className="text-2xl font-bold tabular-nums">{formatTime(solvedIn!)}</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Best</div>
                <div className="text-2xl font-bold tabular-nums">{result ? formatTime(result.best) : "—"}</div>
              </div>
            </div>
            <p className="mt-3 h-5 text-sm font-medium text-[var(--accent)]">
              {newBest ? "New personal best!" : ""}
              {hints > 0 && ` ${hints} hint${hints > 1 ? "s" : ""} used`}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {onNext && (
                <button className="btn-primary" onClick={onNext}>
                  Next puzzle
                </button>
              )}
              <button className="btn-secondary" onClick={onBack}>
                All puzzles
              </button>
              <button className="text-sm font-medium text-[var(--muted)] hover:underline" onClick={() => setShowModal(false)}>
                View board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
