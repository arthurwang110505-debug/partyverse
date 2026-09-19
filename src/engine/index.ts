import type { GameEngine } from "@/types";
import { BOMB_GAME_ID, BombEngine } from "./bombCountdown";

/**
 * The registry of games that actually have a playable engine.
 *
 * The catalogue advertises ten games; only the ones listed here can be started.
 * Everything else renders as "Coming soon" and its Create Room CTA is disabled,
 * so nobody can be routed into a room that would sit on "Loading…" forever.
 */
const engines: Record<string, GameEngine<any>> = {
  [BOMB_GAME_ID]: BombEngine as GameEngine<any>,
};

export function getGameEngine(gameId: string): GameEngine<any> | null {
  return engines[gameId] ?? null;
}

export function isPlayable(gameId: string): boolean {
  return gameId in engines;
}

export function playableGameIds(): string[] {
  return Object.keys(engines);
}
