import data from "@/data/puzzles.json";

export type Difficulty = "easy" | "medium" | "hard";

export interface Puzzle {
  id: string;
  size: number;
  /** [cell, number] pairs; cell = row * size + col */
  clues: [number, number][];
  /** pairs of adjacent cells with a wall between them */
  walls: [number, number][];
  solution: number[];
}

export const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

export const PUZZLES = data as unknown as Record<Difficulty, Puzzle[]>;

export function isDifficulty(value: string): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export const wallKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export interface PuzzleIndex {
  size: number;
  total: number;
  clueAt: Map<number, number>;
  maxClue: number;
  walls: Set<string>;
}

export function indexPuzzle(p: Puzzle): PuzzleIndex {
  return {
    size: p.size,
    total: p.size * p.size,
    clueAt: new Map(p.clues),
    maxClue: p.clues.length,
    walls: new Set(p.walls.map(([a, b]) => wallKey(a, b))),
  };
}

function canStep(ix: PuzzleIndex, path: number[], from: number, to: number) {
  const { size } = ix;
  const dr = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const dc = Math.abs((from % size) - (to % size));
  if (dr + dc !== 1) return false;
  if (ix.walls.has(wallKey(from, to))) return false;
  const reached = path.reduce((n, c) => (ix.clueAt.has(c) ? n + 1 : n), 0);
  if (reached >= ix.maxClue) return false;
  const clue = ix.clueAt.get(to);
  return clue === undefined || clue === reached + 1;
}

/** Applies a single cell touch: start, extend, or backtrack. Returns null if not allowed. */
export function stepTo(ix: PuzzleIndex, path: number[], cell: number): number[] | null {
  const idx = path.indexOf(cell);
  if (idx >= 0) return idx === path.length - 1 ? path : path.slice(0, idx + 1);
  if (!path.length) return ix.clueAt.get(cell) === 1 ? [cell] : null;
  if (!canStep(ix, path, path[path.length - 1], cell)) return null;
  return [...path, cell];
}

/**
 * Moves the head toward a (possibly non-adjacent) target cell, filling in the
 * cells in between — fast drags can skip cells between pointer events.
 */
export function moveToward(ix: PuzzleIndex, path: number[], target: number): number[] {
  const idx = path.indexOf(target);
  if (idx >= 0) return retraceTo(ix, path, idx);
  const direct = stepTo(ix, path, target);
  if (direct) return direct;
  if (!path.length) return path;
  const { size } = ix;
  let cur = path;
  for (let guard = 0; guard < size * 2; guard++) {
    const head = cur[cur.length - 1];
    if (head === target) break;
    const dr = Math.floor(target / size) - Math.floor(head / size);
    const dc = (target % size) - (head % size);
    const vert = dr ? head + Math.sign(dr) * size : -1;
    const horiz = dc ? head + Math.sign(dc) : -1;
    const order = Math.abs(dr) >= Math.abs(dc) ? [vert, horiz] : [horiz, vert];
    let next: number[] | null = null;
    for (const cand of order) {
      if (cand < 0 || cur.includes(cand)) continue;
      next = stepTo(ix, cur, cand);
      if (next) break;
    }
    if (!next) break;
    cur = next;
  }
  return cur;
}

/**
 * Dragging onto a cell already in the path only backs up when retracing the
 * line itself: the previous cell, or a few cells back in a straight run (fast
 * drags skip cells). Crossing over any other part of the path is ignored.
 */
function retraceTo(ix: PuzzleIndex, path: number[], idx: number): number[] {
  const back = path.length - 1 - idx;
  if (back === 0 || back > 3) return path;
  const { size } = ix;
  const head = path[path.length - 1];
  const step = path[path.length - 2] - head;
  for (let k = 1; k <= back; k++) {
    if (path[path.length - 1 - k] !== head + step * k) return path;
  }
  if (back > 1 && Math.abs(step) === 1 && Math.floor(head / size) !== Math.floor(path[idx] / size)) return path;
  return path.slice(0, idx + 1);
}

/** Whether a drag may move onto this cell: extend forward or retrace one step. */
export function canDragTo(ix: PuzzleIndex, path: number[], cell: number): boolean {
  if (path.length >= 2 && path[path.length - 2] === cell) return true;
  if (path.includes(cell)) return false;
  return stepTo(ix, path, cell) !== null;
}

/** Path for a hint: the correct prefix extended through the next numbered cell. */
export function hintPath(p: Puzzle, ix: PuzzleIndex, path: number[]): number[] {
  let k = 0;
  while (k < path.length && path[k] === p.solution[k]) k++;
  for (let j = Math.max(k, 1); j < p.solution.length; j++) {
    if (ix.clueAt.has(p.solution[j])) return p.solution.slice(0, j + 1);
  }
  return p.solution.slice();
}
