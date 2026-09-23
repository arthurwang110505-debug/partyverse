import type { GameEngine, Room } from "@/types";
import { engineRoom } from "./participants";
import { normalizeGameState } from "./state";
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
import { CHAIRS_GAME_ID, MusicalChairsEngine } from "./musicalChairs";
import { MOLES_GAME_ID, WhackMolesEngine } from "./whackMoles";
import { SIMON_GAME_ID, SimonSaysEngine } from "./simonSays";
import { CHAIN_GAME_ID, WordChainEngine } from "./wordChain";
import { POKER_GAME_ID, PokerLiteEngine } from "./pokerLite";
import { RULES_PHASE, withRulesPhase } from "./rulesTour";

/**
 * The registry of all games with playable engines.
 * Normalize database collections at every engine boundary.
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
  [CHAIRS_GAME_ID]: MusicalChairsEngine as GameEngine<any>,
  [MOLES_GAME_ID]: WhackMolesEngine as GameEngine<any>,
  [SIMON_GAME_ID]: SimonSaysEngine as GameEngine<any>,
  [CHAIN_GAME_ID]: WordChainEngine as GameEngine<any>,
  [POKER_GAME_ID]: PokerLiteEngine as GameEngine<any>,
};

function prepare(room: Room<any>): Room<any> {
  return engineRoom({ ...room, gameState: normalizeGameState(room.gameId, room.gameState) });
}
const guardedEngines: Record<string, GameEngine<any>> = Object.fromEntries(
  Object.entries(engines).map(([id, base]) => {
    const engine = withRulesPhase(base);
    return [
      id,
      {
        createGame: (room: Room<any>) => engine.createGame(prepare(room)),
        startGame: (room: Room<any>) => engine.startGame(prepare(room)),
        handlePlayerAction: (room: Room<any>, playerId: string, action: unknown) => {
          const current = prepare(room);
          const hostStart =
            current.gameState.phase === RULES_PHASE &&
            playerId === room.hostPlayerId &&
            (action as { type?: string } | null)?.type === "skipRules";
          if (
            !room.players[playerId] ||
            room.players[playerId].isConnected === false ||
            (!current.players[playerId] && !hostStart)
          )
            return current.gameState;
          return engine.handlePlayerAction(current, playerId, action);
        },
        updateGameState: (room: Room<any>) => engine.updateGameState(prepare(room)),
        endRound: (room: Room<any>) => engine.endRound(prepare(room)),
        endGame: (room: Room<any>) => engine.endGame(prepare(room)),
        calculateScores: (room: Room<any>) => engine.calculateScores(prepare(room)),
      },
    ];
  }),
);

export function getGameEngine(gameId: string): GameEngine<any> | null {
  return guardedEngines[gameId] ?? null;
}

export function isPlayable(gameId: string): boolean {
  return gameId in guardedEngines;
}

export function playableGameIds(): string[] {
  return Object.keys(guardedEngines);
}
