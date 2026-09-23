import type { GameEngine, Room } from "@/types";
import { connectedParticipantIds } from "./participants";

export const RULES_PHASE = "rules";

export interface RulesState {
  phase?: string;
  timeLeft?: number;
  rulesReady?: Record<string, boolean>;
}

/** No forced reading deadline: everyone confirms, or the current host starts. */
export function withRulesPhase<S extends RulesState>(base: GameEngine<S>): GameEngine<S> {
  const enterRules = (room: Room<S>): S => ({
    ...base.createGame(room),
    phase: RULES_PHASE,
    timeLeft: 0,
    rulesReady: {},
  });
  // Create fresh when play actually starts: reaction windows/lyric clocks must
  // not age while people are reading. The pre-tour state is never playable.
  const finishRules = (room: Room<S>): S => base.createGame(room);
  const allReady = (room: Room<S>, ready: Record<string, boolean>) => {
    const ids = connectedParticipantIds(room);
    return ids.length > 0 && ids.every((id) => ready[id] === true);
  };
  return {
    createGame: enterRules,
    startGame: enterRules,
    updateGameState(room) {
      const state = room.gameState;
      if (state?.phase === RULES_PHASE) {
        return allReady(room, state.rulesReady ?? {}) ? finishRules(room) : { ...state, timeLeft: 0 };
      }
      return base.updateGameState(room);
    },
    handlePlayerAction(room, playerId, action) {
      const state = room.gameState;
      const type = (action as { type?: string } | null)?.type;
      if (state?.phase === RULES_PHASE) {
        if (type === "skipRules" && playerId === room.hostPlayerId) return finishRules(room);
        if (type !== "readyRules" || !connectedParticipantIds(room).includes(playerId)) return state;
        const rulesReady = { ...state.rulesReady, [playerId]: true };
        return allReady(room, rulesReady) ? finishRules(room) : { ...state, rulesReady };
      }
      // Old/duplicate briefing actions never reach an underlying game.
      if (type === "skipRules" || type === "readyRules") return state;
      return base.handlePlayerAction(room, playerId, action);
    },
    endRound: (room) => base.endRound(room),
    endGame: (room) => base.endGame(room),
    calculateScores: (room) => base.calculateScores(room),
  };
}
