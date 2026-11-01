/**
 * Split secret fields out of the public room `gameState` so a curious client
 * (or a leaked RTDB dump) cannot read every player's word / impostor roster.
 *
 * Layout (Firebase + local demo):
 *   rooms/{code}/gameState          — public, no secrets
 *   rooms/{code}/private/{playerId} — only that uid should read (rules)
 *   rooms/{code}/privateHost        — host/TV only; full secret mirror for engine ticks
 *
 * Engines still run with a fully-hydrated state (public ⊔ host secrets).
 * Views call `viewGameState(room, playerId)` so phones only see their own secrets.
 */

import type { Room } from "@/types";
import { lyricMask } from "@/engine/song3Seconds";

/** Fields that must never sit on the public gameState blob. */
export const SECRET_FIELDS_BY_GAME: Record<string, string[]> = {
  whoisundercoveragent: ["playerWords", "undercoverPlayerId", "undercoverWord", "civilianWord"],
  drawandguess: ["prompt"],
  mysteryroom: ["correctCode", "playerClues"],
};

export type HostSecrets = Record<string, unknown>;
export type PlayerPrivate = Record<string, unknown>;

export interface SecretSplit {
  /** Safe to publish on rooms/{code}/gameState. */
  publicState: Record<string, unknown>;
  /** Full secret mirror for the host tick / engine. */
  hostSecrets: HostSecrets;
  /** Per-player private payload (only their own secrets). */
  playerSecrets: Record<string, PlayerPrivate>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Quiz games hide nested answer fields rather than whole top-level keys. */
const QUIZ_SECRET_GAMES = new Set(["brainteaser", "song3seconds", "aibullshit"]);

function answerRevealed(phase: unknown): boolean {
  return phase === "reveal" || phase === "result";
}

/** Pull secret fields out of a fully-hydrated engine state. */
export function splitSecrets(gameId: string, fullState: Record<string, unknown>): SecretSplit {
  const publicState: Record<string, unknown> = { ...fullState };
  const hostSecrets: HostSecrets = {};
  const playerSecrets: Record<string, PlayerPrivate> = {};
  if (!fullState || typeof fullState !== "object") {
    return { publicState, hostSecrets, playerSecrets };
  }

  const secretKeys = SECRET_FIELDS_BY_GAME[gameId] ?? [];
  for (const key of secretKeys) {
    if (key in publicState) {
      hostSecrets[key] = publicState[key];
      delete publicState[key];
    }
  }

  if (gameId === "whoisundercoveragent") {
    const words = (hostSecrets.playerWords ?? {}) as Record<string, string>;
    for (const [id, word] of Object.entries(words)) {
      playerSecrets[id] = { ...(playerSecrets[id] ?? {}), myWord: word };
    }
  }

  if (gameId === "drawandguess") {
    const prompt = hostSecrets.prompt as { word?: string; category?: string; aliases?: string[] } | undefined;
    // Only the current drawer learns the word; guessers get category via public state.
    const drawerId = fullState.drawerPlayerId;
    if (typeof drawerId === "string" && prompt) {
      playerSecrets[drawerId] = {
        ...(playerSecrets[drawerId] ?? {}),
        prompt,
      };
    }
    // Non-secret chrome for guessers (never the word itself).
    if (prompt) {
      if (typeof prompt.category === "string") publicState.promptCategory = prompt.category;
      if (typeof prompt.word === "string") {
        publicState.promptLength = Array.from(prompt.word).length;
        // First-letter hint is itself a mild secret; only publish when the
        // engine would have revealed it (timeLeft threshold is re-checked in UI).
      }
    }
  }

  if (gameId === "mysteryroom") {
    const clues = (hostSecrets.playerClues ?? {}) as Record<string, unknown>;
    for (const [id, clue] of Object.entries(clues)) {
      playerSecrets[id] = { ...(playerSecrets[id] ?? {}), myClue: clue };
    }
    // Publish only the digits the table has already unlocked via hints.
    const code = typeof hostSecrets.correctCode === "string" ? hostSecrets.correctCode : "";
    const revealed = typeof fullState.hintRevealed === "number" ? fullState.hintRevealed : 0;
    if (code) {
      publicState.hintDigits = Array.from(code)
        .map((d, i) => (i < revealed ? d : null))
        .filter((d): d is string => d != null)
        .join("");
    }
  }

  // Quiz answers stay host-only until the reveal/result phase. Players still
  // receive the question, choices and any intentionally public clue.
  if (QUIZ_SECRET_GAMES.has(gameId) && !answerRevealed(fullState.phase)) {
    if (gameId === "brainteaser") {
      const riddle = fullState.riddle;
      if (riddle && typeof riddle === "object") {
        const r = riddle as Record<string, unknown>;
        hostSecrets.riddle = r;
        publicState.riddle = { id: r.id, question: r.question };
      }
    }

    if (gameId === "song3seconds") {
      const song = fullState.currentSong;
      if (song && typeof song === "object") {
        const s = song as { id?: unknown; category?: unknown; options?: unknown; lyric?: unknown };
        hostSecrets.currentSong = song;
        publicState.currentSong = { id: s.id, category: s.category, options: s.options };
        if (typeof s.lyric === "string") {
          publicState.lyricClue = lyricMask(
            song as Parameters<typeof lyricMask>[0],
            typeof fullState.lyricRevealed === "number" ? fullState.lyricRevealed : 0,
          );
        }
      }
    }

    if (gameId === "aibullshit") {
      const prompt = fullState.prompt;
      if (prompt && typeof prompt === "object") {
        const p = prompt as Record<string, unknown>;
        hostSecrets.prompt = prompt;
        publicState.prompt = { id: p.id, question: p.question };
      }
      const options = fullState.options;
      if (Array.isArray(options)) {
        hostSecrets.options = options;
        publicState.options = options.map((opt) => {
          const o = (opt ?? {}) as Record<string, unknown>;
          return { id: o.id, text: o.text, authorPlayerId: o.authorPlayerId };
        });
      }
    }
  }

  return { publicState, hostSecrets, playerSecrets };
}

/** Re-attach host secrets so engines see a complete state. */
export function hydrateGameState(
  publicState: Record<string, unknown> | undefined | null,
  hostSecrets: HostSecrets | undefined | null,
): Record<string, unknown> {
  return {
    ...(isPlainObject(publicState) ? publicState : {}),
    ...(isPlainObject(hostSecrets) ? hostSecrets : {}),
  };
}

/**
 * What a specific player is allowed to see on their phone.
 * Host/display seats get the full hydrated state (they already run the clock).
 */
export function viewGameState(
  room: Room,
  playerId: string | undefined,
  options: {
    hostSecrets?: HostSecrets | null;
    myPrivate?: PlayerPrivate | null;
    /** True when this client is the current host (TV or recovered host phone). */
    asHost?: boolean;
  } = {},
): Record<string, unknown> {
  const publicState = isPlainObject(room.gameState) ? (room.gameState as Record<string, unknown>) : {};
  if (options.asHost) {
    return hydrateGameState(publicState, options.hostSecrets ?? null);
  }

  const mine = isPlainObject(options.myPrivate) ? options.myPrivate : {};
  const view: Record<string, unknown> = { ...publicState };

  // Undercover: only my word, never the undercover id or the other word.
  if (typeof mine.myWord === "string") {
    view.myWord = mine.myWord;
    if (playerId) {
      view.playerWords = { [playerId]: mine.myWord };
    }
  }

  // Draw: drawer-only prompt; guessers get category + length only.
  if (isPlainObject(mine.prompt)) {
    view.prompt = mine.prompt;
  } else if (room.gameId === "drawandguess") {
    view.prompt = {
      id: "",
      word: "",
      category: (publicState.promptCategory as string) ?? "",
      aliases: [],
    };
    if (typeof publicState.promptLength === "number") {
      view.promptLength = publicState.promptLength;
    }
  }

  // Mystery: only my clue + publicly unlocked hint digits.
  if (mine.myClue) {
    view.myClue = mine.myClue;
    if (playerId) view.playerClues = { [playerId]: mine.myClue };
  }
  // Never leave the passcode on a phone view.
  if ("correctCode" in view && !options.asHost) delete view.correctCode;
  // Build a display mask from hintDigits (known prefix) without the rest.
  if (typeof publicState.hintDigits === "string") {
    const known = publicState.hintDigits as string;
    view.displayCode = known.padEnd(4, "•");
  } else {
    view.displayCode = "••••";
  }

  return view;
}

/** True when this game carries secrets that should be split. */
export function gameHasSecrets(gameId: string): boolean {
  return (SECRET_FIELDS_BY_GAME[gameId] ?? []).length > 0 || QUIZ_SECRET_GAMES.has(gameId);
}
