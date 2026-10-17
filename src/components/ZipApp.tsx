"use client";

import { useState, useSyncExternalStore } from "react";
import Game from "@/components/Game";
import PuzzleList from "@/components/PuzzleList";
import { PUZZLES, isDifficulty, type Difficulty } from "@/lib/zip";

// Routes live in the hash: #/easy (list) or #/easy/12 (puzzle 12).
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const PREF_KEY = "lizip:difficulty";

const getHash = () => window.location.hash || `#/${preferredDifficulty()}`;
const getServerHash = () => "";

function preferredDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v && isDifficulty(v)) return v;
  } catch {}
  return "easy";
}

function parse(hash: string): { difficulty: Difficulty; number: number | null } {
  const [d, n] = hash.replace(/^#\/?/, "").split("/");
  if (!isDifficulty(d)) return { difficulty: "easy", number: null };
  const num = Number(n);
  const valid = Number.isInteger(num) && num >= 1 && num <= PUZZLES[d].length;
  return { difficulty: d, number: valid ? num : null };
}

function go(difficulty: Difficulty, number?: number) {
  try {
    localStorage.setItem(PREF_KEY, difficulty);
  } catch {}
  window.location.hash = number ? `/${difficulty}/${number}` : `/${difficulty}`;
  window.scrollTo(0, 0);
}

export default function ZipApp() {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const { difficulty, number } = parse(hash);
  // Bumped to remount the current puzzle fresh for a replay.
  const [round, setRound] = useState(0);

  if (number) {
    const total = PUZZLES[difficulty].length;
    return (
      <Game
        key={`${difficulty}-${number}-${round}`}
        difficulty={difficulty}
        number={number}
        onBack={() => go(difficulty)}
        onReplay={() => setRound((r) => r + 1)}
        onNext={number < total ? () => go(difficulty, number + 1) : null}
      />
    );
  }
  return <PuzzleList difficulty={difficulty} onDifficulty={(d) => go(d)} onPlay={(n) => go(difficulty, n)} />;
}
