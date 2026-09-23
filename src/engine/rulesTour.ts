import type { GameEngine, Room } from "@/types";
import { participantIds } from "./participants";

/** The shared pre-game phase shown by `RulesTour` before any real gameplay. */
export const RULES_PHASE = "rules";

/**
 * Default tour length. Kept deliberately short for a party: hosts who want a
 * slower read-aloud can bump the per-game registration, and any participant
 * can always tap "開始遊戲" to skip early.
 */
export const DEFAULT_RULES_TOUR_SECONDS = 15;

interface StateShape {
  phase?: string;
  timeLeft?: number;
}

/**
 * Wraps an engine so every match opens with a generic, skippable rules tour.
 *
 * The wrapper is the only thing that knows about the tour: it stamps the
 * engine's real initial state onto the state (as `phaseAfterRules` /
 * `returnTimeLeft`), plays the fixed countdown, and then hands control back
 * to the untouched engine. `timeLeft` during the tour is the tour countdown,
 * so the shared `phaseEndsAt` deadline machinery, host ticks and the
 * results/switch flows keep working without any special-casing.
 *
 * `skipRules` (from any connected participant) ends the tour immediately;
 * every other action is frozen while the tour runs.
 */
export function withRulesPhase<S extends StateShape>(base: GameEngine<S>, seconds: number): GameEngine<S> {
  type Rules = S & Record<string, unknown>;
  const enterRules = (room: Room<S>): S => {
    const initial = base.createGame(room) as Rules;
    return {
      ...initial,
      phase: RULES_PHASE,
      timeLeft: seconds,
      phaseAfterRules: initial.phase,
      returnTimeLeft: initial.timeLeft ?? 0,
    };
  };

  const finishRules = (state: Rules): S =>
    ({ ...state, phase: state.phaseAfterRules, timeLeft: state.returnTimeLeft ?? 0 }) as S;

  return {
    createGame: (room) => enterRules(room),
    startGame: (room) => enterRules(room),
    updateGameState(room) {
      const state = room.gameState as Rules | undefined;
      if (state && state.phase === RULES_PHASE) {
        if ((state.timeLeft as number | undefined ?? 0) > 1) {
          return { ...state, timeLeft: (state.timeLeft as number) - 1 } as S;
        }
        return finishRules(state);
      }
      return base.updateGameState(room);
    },
    handlePlayerAction(room, playerId, action) {
      const state = room.gameState as Rules | undefined;
      if (!state) return state as unknown as S;
      if ((action as { type?: string } | null)?.type === "skipRules") {
        if (state.phase !== RULES_PHASE) return state as S;
        if (!participantIds(room).includes(playerId)) return state as S;
        return finishRules(state);
      }
      if (state.phase === RULES_PHASE) return state as S;
      return base.handlePlayerAction(room, playerId, action);
    },
    endRound: (room) => base.endRound(room),
    endGame: (room) => base.endGame(room),
    calculateScores: (room) => base.calculateScores(room),
  };
}
