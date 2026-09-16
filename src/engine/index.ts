import type { GameEngine } from "@/types";
import { BombEngine } from "./bombCountdown";

export const gameEngines: Record<string, GameEngine> = {
  bombcountdown: BombEngine,
};

export function getGameEngine(gameId: string): GameEngine | null {
  return gameEngines[gameId] || null;
}

export async function loadGameEngine(gameId: string): Promise<GameEngine | null> {
  try {
    const mod = await import(`./${gameId}`);
    return (mod as { BombEngine?: GameEngine }).BombEngine || null;
  } catch {
    return null;
  }
}
