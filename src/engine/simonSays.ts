import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { topScorers } from "./scoring";

export const SIMON_GAME_ID = "simonsays";

export type SimonPhase = "learning" | "repeat" | "round_reveal" | "result";

export interface SimonGameState {
  phase: SimonPhase;
  timeLeft: number;
  currentRound: number;
  totalRounds: number;
  /** Seeds the deterministic sequence stream for this round. */
  seqSeed: number;
  /** Current sequence length (starts at 3, grows by one per level). */
  level: number;
  /** How many elements have flashed so far in the current learning phase. */
  learnIndex: number;
  outThisRound: string[];
  /** Players who finished the cap and are waiting out the round. */
  maxedOut: string[];
  playerProgress: Record<string, number>;
  maxLevelReached: number;
  lastLevelUpId: string | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
  winnerIds: string[];
}

export interface SimonTapAction {
  type: "tap";
  quadrant: number;
}

export type SimonAction = SimonTapAction;

export const SIMON_QUADRANTS = 4;
export const START_LEVEL = 3;
export const MAX_LEVEL = 12;
const REPEAT_SECONDS = 20;
const REVEAL_SECONDS = 4;

/**
 * Deterministic sequence stream: the first `length` outputs are always the
 * prefix of any longer stream from the same seed, so level N+1 extends level
 * N and every client derives the identical pattern from state alone.
 */
export function simonSequence(seed: number, length: number): number[] {
  const seq: number[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    seq.push(s % SIMON_QUADRANTS);
  }
  return seq;
}

function freshSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

/** Players who must still complete the current level. */
function stillPlaying(state: SimonGameState, room: Room<SimonGameState>): string[] {
  return Object.keys(room.players).filter(
    (id) => !state.outThisRound.includes(id) && !state.maxedOut.includes(id),
  );
}

export const SimonSaysEngine: GameEngine<SimonGameState> = {
  createGame(room) {
    const rounds = room.settings?.rounds ?? 3;
    return {
      phase: "learning",
      timeLeft: START_LEVEL,
      currentRound: 1,
      totalRounds: Math.max(1, Math.min(5, rounds)),
      seqSeed: freshSeed(),
      level: START_LEVEL,
      learnIndex: 0,
      outThisRound: [],
      maxedOut: [],
      playerProgress: {},
      maxLevelReached: START_LEVEL,
      lastLevelUpId: null,
      currentScores: initialScores(room.players),
      winnerId: null,
      winnerIds: [],
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "repeat") return state;
    const act = action as SimonAction;
    if (act?.type !== "tap" || typeof act.quadrant !== "number" || !Number.isInteger(act.quadrant) || act.quadrant < 0 || act.quadrant >= SIMON_QUADRANTS) {
      return state;
    }
    if (state.outThisRound.includes(playerId) || state.maxedOut.includes(playerId)) return state;

    const seq = simonSequence(state.seqSeed, state.level);
    const progress = state.playerProgress[playerId] ?? 0;

    if (seq[progress] !== act.quadrant) {
      const out = [...state.outThisRound, playerId];
      if (out.length >= Object.keys(room.players).length) {
        return endRound(state, out, state.maxedOut);
      }
      return { ...state, outThisRound: out };
    }

    const nextProgress = progress + 1;
    if (nextProgress < state.level) {
      return { ...state, playerProgress: { ...state.playerProgress, [playerId]: nextProgress } };
    }

    // Completed the current level.
    const scores = { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + state.level };
    const maxed = state.level >= MAX_LEVEL ? [...state.maxedOut, playerId] : state.maxedOut;
    const others = stillPlaying({ ...state, outThisRound: state.outThisRound, maxedOut: maxed }, room).filter(
      (id) => id !== playerId,
    );
    const allDone = others.every((id) => (state.playerProgress[id] ?? 0) >= state.level);

    if (state.level >= MAX_LEVEL || allDone) {
      if (state.level >= MAX_LEVEL) {
        // Cap reached: whoever finished gets the points, round is over.
        return endRound({ ...state, currentScores: scores, maxedOut: maxed, maxLevelReached: state.level }, state.outThisRound, maxed);
      }
      const nextLevel = state.level + 1;
      return {
        ...state,
        phase: "learning",
        level: nextLevel,
        learnIndex: 0,
        timeLeft: nextLevel,
        playerProgress: {},
        currentScores: scores,
        maxedOut: maxed,
        maxLevelReached: nextLevel,
        lastLevelUpId: playerId,
      };
    }

    return {
      ...state,
      playerProgress: { ...state.playerProgress, [playerId]: nextProgress },
      currentScores: scores,
      maxedOut: maxed,
      maxLevelReached: Math.max(state.maxLevelReached, state.level),
      lastLevelUpId: playerId,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "learning") {
      if (state.learnIndex + 1 < state.level) {
        return { ...state, learnIndex: state.learnIndex + 1, timeLeft: state.level - state.learnIndex - 1 };
      }
      return { ...state, learnIndex: state.level, timeLeft: REPEAT_SECONDS, phase: "repeat", playerProgress: {} };
    }

    if (state.phase === "repeat") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      // Time is up: everyone still mid-sequence misses.
      const out = [...state.outThisRound, ...stillPlaying(state, room)];
      return endRound(state, out, state.maxedOut);
    }

    if (state.phase === "round_reveal") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      if (state.currentRound >= state.totalRounds) {
        const winnerIds = topScorers(state.currentScores);
        return { ...state, phase: "result", timeLeft: 0, winnerId: winnerIds[0] ?? null, winnerIds };
      }
      return {
        ...state,
        phase: "learning",
        currentRound: state.currentRound + 1,
        seqSeed: freshSeed(),
        level: START_LEVEL,
        learnIndex: 0,
        timeLeft: START_LEVEL,
        outThisRound: [],
        maxedOut: [],
        playerProgress: {},
        maxLevelReached: START_LEVEL,
        lastLevelUpId: null,
      };
    }

    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const winnerIds = topScorers(scores);
    const winnerId = state?.winnerId ?? winnerIds[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerIds.length === 1 && winnerId) {
      achievements.push({
        id: "simon_brain",
        name: "超級記憶力",
        icon: "🔷",
        description: "西蒙遊戲記憶之王",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId, winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function endRound(state: SimonGameState, out: string[], maxed: string[]): SimonGameState {
  const scores = { ...state.currentScores };
  // Maxing out the cap is a prize in itself.
  for (const id of maxed) {
    scores[id] = (scores[id] ?? 0) + MAX_LEVEL;
  }
  return {
    ...state,
    phase: "round_reveal",
    timeLeft: REVEAL_SECONDS,
    outThisRound: out,
    maxedOut: maxed,
    currentScores: scores,
  };
}
