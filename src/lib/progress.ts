"use client";

import { useSyncExternalStore } from "react";

export interface Result {
  /** best solve time in ms */
  best: number;
  /** most recent solve time in ms */
  last: number;
  solvedAt: string;
}

export type Progress = Record<string, Result>;

const KEY = "lizip:progress:v1";
const EVENT = "lizip:progress";
const EMPTY: Progress = {};

let cachedRaw: string | null = null;
let cached: Progress = EMPTY;

function read(): Progress {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as Progress) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function saveResult(id: string, ms: number) {
  const current = read();
  const prev = current[id];
  const next: Progress = {
    ...current,
    [id]: { best: prev ? Math.min(prev.best, ms) : ms, last: ms, solvedAt: new Date().toISOString() },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, quota) — keep the in-memory copy.
    cached = next;
  }
  window.dispatchEvent(new Event(EVENT));
}
