"use client";

import { GAMES } from "@/constants/games";

/**
 * What this browser has already played, newest last.
 *
 * Random party modes draw playlists from `GAMES`, and "盡量不重複" only means
 * something if the draw knows what the group just played. One device (the host)
 * does the drawing, so plain localStorage is enough — no room state and no
 * database field needed.
 *
 * Entries older than `FRESH_WINDOW_MS` are ignored, so tonight's history does
 * not bias next weekend's party back into the games nobody wanted.
 */

const KEY = "partyverse_play_history";
/** Keep the tail bounded; 16 games ship today and the draw only needs recency. */
const MAX_ENTRIES = 24;
/** A game played longer ago than this counts as "fresh" again. */
const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

interface StoredPlay {
  gameId: string;
  at: number;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(): StoredPlay[] {
  const store = storage();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is StoredPlay =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as StoredPlay).gameId === "string" &&
        Number.isFinite((entry as StoredPlay).at),
    );
  } catch {
    return [];
  }
}

function write(entries: StoredPlay[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Private mode / quota — history is a nicety, never a requirement.
  }
}

/**
 * Games played recently, oldest first. Unknown ids are dropped so a game that
 * disappears from the catalogue cannot block a draw forever.
 */
export function loadPlayHistory(now = Date.now()): string[] {
  const known = new Set(GAMES.map((game) => game.id));
  return read()
    .filter((entry) => now - entry.at < FRESH_WINDOW_MS && known.has(entry.gameId))
    .map((entry) => entry.gameId);
}

/** Records a finished game. Repeat plays move the game to the newest slot. */
export function rememberPlayedGame(gameId: string, now = Date.now()): string[] {
  if (!GAMES.some((game) => game.id === gameId)) return loadPlayHistory(now);
  const withoutGame = read().filter((entry) => entry.gameId !== gameId);
  write([...withoutGame, { gameId, at: now }].slice(-MAX_ENTRIES));
  return loadPlayHistory(now);
}

export function clearPlayHistory(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // ignore
  }
}
