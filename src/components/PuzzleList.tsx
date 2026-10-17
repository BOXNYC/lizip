"use client";

import { useProgress } from "@/lib/progress";
import { DIFFICULTIES, PUZZLES, formatTime, type Difficulty } from "@/lib/zip";

interface PuzzleListProps {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onPlay: (n: number) => void;
}

export default function PuzzleList({ difficulty, onDifficulty, onPlay }: PuzzleListProps) {
  const progress = useProgress();
  const puzzles = PUZZLES[difficulty];
  const solvedCount = puzzles.filter((p) => progress[p.id]).length;
  const firstUnsolved = puzzles.findIndex((p) => !progress[p.id]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-12 pt-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--wall)] text-[var(--board)]">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.6}>
            <path d="M5 5h14v4.5H5V14h14v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LIZip</h1>
          <p className="text-sm text-[var(--muted)]">Connect the dots in order. Fill every cell.</p>
        </div>
      </header>

      <div role="tablist" className="mb-5 grid grid-cols-3 gap-1 rounded-full bg-[var(--surface)] p-1">
        {DIFFICULTIES.map((d) => {
          const active = d.key === difficulty;
          const size = PUZZLES[d.key][0].size;
          return (
            <button
              key={d.key}
              role="tab"
              aria-selected={active}
              onClick={() => onDifficulty(d.key)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                active ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {d.label} <span className="font-normal opacity-60">{size}×{size}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1.5 text-sm font-medium">
            {solvedCount}/{puzzles.length} solved
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
              style={{ width: `${(solvedCount / puzzles.length) * 100}%` }}
            />
          </div>
        </div>
        {firstUnsolved >= 0 && (
          <button className="btn-primary !w-auto px-5" onClick={() => onPlay(firstUnsolved + 1)}>
            Play #{firstUnsolved + 1}
          </button>
        )}
      </div>

      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {puzzles.map((p, i) => {
          const r = progress[p.id];
          return (
            <li key={p.id}>
              <button
                onClick={() => onPlay(i + 1)}
                aria-label={`Puzzle ${i + 1}${r ? `, solved in ${formatTime(r.best)}` : ""}`}
                className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-xl border text-base font-semibold transition hover:-translate-y-0.5 hover:shadow-md ${
                  r
                    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--grid)] bg-[var(--card)]"
                }`}
              >
                {r && (
                  <svg
                    viewBox="0 0 24 24"
                    className="absolute right-1 top-1 size-3.5 text-[var(--accent)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    aria-hidden
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="leading-none">{i + 1}</span>
                {r && <span className="mt-1 text-[10px] font-medium tabular-nums opacity-80">{formatTime(r.best)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
