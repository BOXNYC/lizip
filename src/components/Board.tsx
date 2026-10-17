"use client";

import { useRef } from "react";
import type { Puzzle } from "@/lib/zip";

const CELL = 100;

interface BoardProps {
  puzzle: Puzzle;
  path: number[];
  solved: boolean;
  onPress: (cell: number) => void;
  onDrag: (cell: number) => void;
  onRelease: () => void;
}

// Trail color runs from warm orange to magenta along the path.
function trailColor(t: number, alpha = 1) {
  const hue = 24 - t * 54; // 24 → -30 (≈330)
  return `hsla(${(hue + 360) % 360}, 92%, ${56 - t * 4}%, ${alpha})`;
}

export default function Board({ puzzle, path, solved, onPress, onDrag, onRelease }: BoardProps) {
  const { size, clues, walls } = puzzle;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const view = size * CELL;
  const center = (c: number) => ({
    x: (c % size) * CELL + CELL / 2,
    y: Math.floor(c / size) * CELL + CELL / 2,
  });
  const denom = Math.max(1, size * size - 1);

  // Maps a pointer to a cell; while dragging, ignore the outer band of each
  // cell so diagonal swipes across corners don't register the wrong neighbor.
  function cellAt(e: React.PointerEvent, strict: boolean) {
    const rect = svgRef.current!.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * size;
    const fy = ((e.clientY - rect.top) / rect.height) * size;
    if (fx < 0 || fy < 0 || fx >= size || fy >= size) return -1;
    if (strict) {
      const ox = fx % 1;
      const oy = fy % 1;
      if (ox < 0.15 || ox > 0.85 || oy < 0.15 || oy > 0.85) return -1;
    }
    return Math.floor(fy) * size + Math.floor(fx);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${view} ${view}`}
      className="block w-full touch-none select-none"
      role="img"
      aria-label={`Zip puzzle grid, ${size} by ${size}`}
      onPointerDown={(e) => {
        if (solved) return;
        const cell = cellAt(e, false);
        if (cell < 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onPress(cell);
      }}
      onPointerMove={(e) => {
        if (!dragging.current || solved) return;
        const cell = cellAt(e, true);
        if (cell >= 0) onDrag(cell);
      }}
      onPointerUp={() => {
        dragging.current = false;
        onRelease();
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onRelease();
      }}
    >
      <rect width={view} height={view} fill="var(--board)" />

      {/* visited cell tint */}
      {path.map((c, i) => (
        <rect
          key={`v${c}`}
          x={(c % size) * CELL}
          y={Math.floor(c / size) * CELL}
          width={CELL}
          height={CELL}
          fill={trailColor(i / denom, solved ? 0.3 : 0.2)}
          className="transition-[fill] duration-500"
        />
      ))}

      {/* grid lines */}
      {Array.from({ length: size - 1 }, (_, i) => (
        <g key={`g${i}`} stroke="var(--grid)" strokeWidth={2}>
          <line x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={view} />
          <line x1={0} y1={(i + 1) * CELL} x2={view} y2={(i + 1) * CELL} />
        </g>
      ))}

      {/* trail */}
      <g strokeLinecap="round" strokeLinejoin="round" className={solved ? "zip-solved" : undefined}>
        {path.slice(1).map((c, i) => {
          const a = center(path[i]);
          const b = center(c);
          return (
            <line
              key={`s${path[i]}-${c}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={trailColor(i / denom)}
              strokeWidth={CELL * 0.36}
            />
          );
        })}
      </g>
      {path.length > 0 && (
        <circle
          cx={center(path[path.length - 1]).x}
          cy={center(path[path.length - 1]).y}
          r={CELL * 0.18}
          fill={trailColor((path.length - 1) / denom)}
        />
      )}

      {/* walls */}
      {walls.map(([a, b]) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const r = Math.floor(lo / size);
        const c = lo % size;
        const horizontal = hi - lo === 1; // neighbors in a row → vertical wall
        const x1 = horizontal ? (c + 1) * CELL : c * CELL;
        const y1 = horizontal ? r * CELL : (r + 1) * CELL;
        const x2 = horizontal ? x1 : x1 + CELL;
        const y2 = horizontal ? y1 + CELL : y1;
        return (
          <line
            key={`w${lo}-${hi}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--wall)"
            strokeWidth={12}
            strokeLinecap="round"
          />
        );
      })}

      {/* numbered cells */}
      {clues.map(([cell, n]) => {
        const { x, y } = center(cell);
        return (
          <g key={`c${cell}`}>
            <circle cx={x} cy={y} r={CELL * 0.3} fill="var(--dot)" />
            <text
              x={x}
              y={y}
              dy="0.36em"
              textAnchor="middle"
              fontSize={CELL * 0.32}
              fontWeight={700}
              fill="var(--dot-text)"
              style={{ pointerEvents: "none" }}
            >
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
