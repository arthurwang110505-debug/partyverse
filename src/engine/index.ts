import type { GameEngine } from "@/types";
import { BOMB_GAME_ID, BombEngine } from "./bombCountdown";
import { EVERYBODY_GAME_ID, EverybodyKnowsEngine } from "./everybodyKnows";
import { AIBULLSHIT_GAME_ID, AIBullshitEngine } from "./aiBullshit";
import { UNDERCOVER_GAME_ID, WhoIsUndercoverEngine } from "./whoIsUndercover";
import { SONG_GAME_ID, Song3SecondsEngine } from "./song3Seconds";
import { KING_GAME_ID, KingTonightEngine } from "./kingTonight";
import { FIREWORK_GAME_ID, FireworkMasterEngine } from "./fireworkMaster";
import { DRAW_GAME_ID, DrawAndGuessEngine } from "./drawAndGuess";
import { BATTLE_GAME_ID, RealBattleEngine } from "./realBattle";
import { MYSTERY_GAME_ID, MysteryRoomEngine } from "./mysteryRoom";

/**
 * The registry of all games with playable engines.
 * All 10 party games are implemented and fully playable!
 */
const engines: Record<string, GameEngine<any>> = {
  [BOMB_GAME_ID]: BombEngine as GameEngine<any>,
  [EVERYBODY_GAME_ID]: EverybodyKnowsEngine as GameEngine<any>,
  [AIBULLSHIT_GAME_ID]: AIBullshitEngine as GameEngine<any>,
  [UNDERCOVER_GAME_ID]: WhoIsUndercoverEngine as GameEngine<any>,
  [SONG_GAME_ID]: Song3SecondsEngine as GameEngine<any>,
  [KING_GAME_ID]: KingTonightEngine as GameEngine<any>,
  [FIREWORK_GAME_ID]: FireworkMasterEngine as GameEngine<any>,
  [DRAW_GAME_ID]: DrawAndGuessEngine as GameEngine<any>,
  [BATTLE_GAME_ID]: RealBattleEngine as GameEngine<any>,
  [MYSTERY_GAME_ID]: MysteryRoomEngine as GameEngine<any>,
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
