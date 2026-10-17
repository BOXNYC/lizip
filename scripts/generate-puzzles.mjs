// Generates src/data/puzzles.json: 100 uniquely-solvable Zip puzzles per difficulty.
// Usage: node scripts/generate-puzzles.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PER_DIFFICULTY = 100;

const DIFFICULTIES = {
  easy: { size: 6, walls: [0, 0], minClues: 10, maxClues: 13, seed: 1001 },
  medium: { size: 7, walls: [0, 3], minClues: 8, maxClues: 11, seed: 2002 },
  hard: { size: 8, walls: [3, 7], minClues: 5, maxClues: 9, seed: 3003 },
};

// Mulberry32 — small deterministic PRNG so the puzzle set is reproducible.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function gridNeighbors(size) {
  const nbs = [];
  for (let c = 0; c < size * size; c++) {
    const r = Math.floor(c / size);
    const col = c % size;
    const list = [];
    if (r > 0) list.push(c - size);
    if (r < size - 1) list.push(c + size);
    if (col > 0) list.push(c - 1);
    if (col < size - 1) list.push(c + 1);
    nbs.push(list);
  }
  return nbs;
}

const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Random Hamiltonian path via the backbite algorithm, starting from a serpentine.
function randomHamiltonianPath(size, rng) {
  const nbs = gridNeighbors(size);
  let path = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      path.push(r * size + (r % 2 === 0 ? c : size - 1 - c));
    }
  }
  const n = path.length;
  const steps = n * n * 4;
  for (let s = 0; s < steps; s++) {
    if (rng() < 0.5) path.reverse();
    const end = path[n - 1];
    const prev = path[n - 2];
    const options = nbs[end].filter((x) => x !== prev);
    const pick = options[Math.floor(rng() * options.length)];
    const i = path.indexOf(pick);
    path = path.slice(0, i + 1).concat(path.slice(i + 1).reverse());
  }
  return path;
}

// Counts solutions (up to `limit`). Returns { count, solutions, aborted }.
function solve(size, clues, walls, limit = 2, nodeLimit = 400000) {
  const total = size * size;
  const wallSet = new Set(walls.map(([a, b]) => edgeKey(a, b)));
  const adj = gridNeighbors(size).map((list, c) =>
    list.filter((x) => !wallSet.has(edgeKey(c, x)))
  );
  const clueAt = new Int32Array(total);
  let maxClue = 0;
  let start = -1;
  let endCell = -1;
  for (const [cell, num] of clues) {
    clueAt[cell] = num;
    if (num === 1) start = cell;
    if (num > maxClue) {
      maxClue = num;
      endCell = cell;
    }
  }
  const visited = new Uint8Array(total);
  const path = [start];
  visited[start] = 1;
  const solutions = [];
  let nodes = 0;
  let aborted = false;
  const stack = new Int32Array(total);

  function connected(head, remaining) {
    // Flood fill unvisited cells reachable from head.
    let top = 0;
    let seen = 0;
    const mark = new Uint8Array(total);
    mark[head] = 1;
    stack[top++] = head;
    while (top) {
      const c = stack[--top];
      for (const x of adj[c]) {
        if (!visited[x] && !mark[x]) {
          mark[x] = 1;
          seen++;
          stack[top++] = x;
        }
      }
    }
    return seen === remaining;
  }

  function deadEnd(cell, head) {
    if (visited[cell] || cell === endCell) return false;
    let deg = 0;
    for (const x of adj[cell]) if (!visited[x] || x === head) deg++;
    return deg < 2;
  }

  function dfs(cur, count, nextClue) {
    if (aborted || solutions.length >= limit) return;
    if (++nodes > nodeLimit) {
      aborted = true;
      return;
    }
    if (count === total) {
      if (cur === endCell) solutions.push(path.slice());
      return;
    }
    for (const nb of adj[cur]) {
      if (visited[nb]) continue;
      const c = clueAt[nb];
      if (c && c !== nextClue) continue;
      if (nb === endCell && count + 1 !== total) continue;
      visited[nb] = 1;
      path.push(nb);
      let ok = true;
      for (const x of adj[cur]) {
        if (deadEnd(x, nb)) {
          ok = false;
          break;
        }
      }
      if (ok && count + 1 < total && !connected(nb, total - count - 1)) ok = false;
      if (ok) dfs(nb, count + 1, c ? nextClue + 1 : nextClue);
      path.pop();
      visited[nb] = 0;
      if (aborted || solutions.length >= limit) return;
    }
  }

  dfs(start, 1, 2);
  return { count: solutions.length, solutions, aborted };
}

// Builds clue list from a set of path indices (numbers assigned in path order).
function cluesFromIndices(path, indices) {
  return [...indices].sort((a, b) => a - b).map((idx, i) => [path[idx], i + 1]);
}

function pickWalls(size, path, count, rng) {
  const used = new Set();
  for (let i = 0; i < path.length - 1; i++) used.add(edgeKey(path[i], path[i + 1]));
  const candidates = [];
  const nbs = gridNeighbors(size);
  for (let c = 0; c < size * size; c++) {
    for (const x of nbs[c]) if (c < x && !used.has(edgeKey(c, x))) candidates.push([c, x]);
  }
  shuffle(candidates, rng);
  return candidates.slice(0, count);
}

function generatePuzzle(cfg, rng) {
  const { size } = cfg;
  const total = size * size;
  for (;;) {
    const path = randomHamiltonianPath(size, rng);
    const wallCount = cfg.walls[0] + Math.floor(rng() * (cfg.walls[1] - cfg.walls[0] + 1));
    const walls = pickWalls(size, path, wallCount, rng);

    // Start dense: endpoints plus roughly every 3rd cell.
    const indices = new Set([0, total - 1]);
    for (let i = 2; i < total - 2; i += 2 + Math.floor(rng() * 3)) indices.add(i);

    // Add clues until the puzzle has exactly one solution.
    let unique = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = solve(size, cluesFromIndices(path, indices), walls);
      if (!res.aborted && res.count === 1) {
        unique = true;
        break;
      }
      const alt = res.solutions.find((s) => s.some((c, i) => c !== path[i]));
      let idx = -1;
      if (alt) {
        const diff = alt.findIndex((c, i) => c !== path[i]);
        // Pin the true path a few steps past where the alternative diverges.
        for (let k = diff; k < total - 1; k++) {
          if (!indices.has(k)) {
            idx = k;
            break;
          }
        }
      }
      if (idx < 0) {
        const free = [];
        for (let k = 1; k < total - 1; k++) if (!indices.has(k)) free.push(k);
        if (!free.length) break;
        idx = free[Math.floor(rng() * free.length)];
      }
      indices.add(idx);
    }
    if (!unique) continue;

    // Remove clues while the solution stays unique.
    const removable = shuffle([...indices].filter((i) => i !== 0 && i !== total - 1), rng);
    const target = cfg.minClues + Math.floor(rng() * (cfg.maxClues - cfg.minClues + 1));
    for (const idx of removable) {
      if (indices.size <= target) break;
      indices.delete(idx);
      const res = solve(size, cluesFromIndices(path, indices), walls);
      if (res.aborted || res.count !== 1) indices.add(idx);
    }
    if (indices.size > cfg.maxClues + 2) continue;

    return {
      size,
      clues: cluesFromIndices(path, indices),
      walls,
      solution: path,
    };
  }
}

const out = {};
for (const [name, cfg] of Object.entries(DIFFICULTIES)) {
  const rng = makeRng(cfg.seed);
  const list = [];
  const seen = new Set();
  const t0 = Date.now();
  while (list.length < PER_DIFFICULTY) {
    const p = generatePuzzle(cfg, rng);
    const sig = p.solution.join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    list.push({ id: `${name}-${list.length + 1}`, ...p });
    process.stdout.write(`\r${name}: ${list.length}/${PER_DIFFICULTY}`);
  }
  const avg = list.reduce((s, p) => s + p.clues.length, 0) / list.length;
  console.log(` (${((Date.now() - t0) / 1000).toFixed(1)}s, avg clues ${avg.toFixed(1)})`);
  out[name] = list;
}

const file = join(dirname(fileURLToPath(import.meta.url)), "../src/data/puzzles.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
console.log(`Wrote ${file}`);
