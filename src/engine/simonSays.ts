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

export interface SimonSubmitAction {
  type: "submitSequence";
  taps: number[];
}

export type SimonAction = SimonSubmitAction;

export const SIMON_QUADRANTS = 4;
export const START_LEVEL = 3;
export const MAX_LEVEL = 12;
/** Seconds to repeat a sequence: longer sequences get more time. */
export function repeatSeconds(level: number): number {
  return 10 + level * 2;
}
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
      timeLeft: START_LEVEL + 1,
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
    if (state.outThisRound.includes(playerId) || state.maxedOut.includes(playerId)) return state;
    if ((state.playerProgress[playerId] ?? 0) >= state.level) return state; // already done this level

    // Phones collect the whole answer locally and submit it in one go, so a
    // dropped/late transaction or a double-fired tap can't desync the index.
    let taps: number[] | null = null;
    if (act?.type === "submitSequence" && Array.isArray(act.taps)) taps = act.taps.slice(0, MAX_LEVEL);
    if (!taps || taps.some((q) => typeof q !== "number" || !Number.isInteger(q) || q < 0 || q >= SIMON_QUADRANTS)) {
      return state;
    }

    const seq = simonSequence(state.seqSeed, state.level);
    const correct = taps.length === seq.length && taps.every((q, i) => q === seq[i]);

    if (!correct) {
      const out = [...state.outThisRound, playerId];
      const remaining = stillPlaying({ ...state, outThisRound: out }, room);
      if (remaining.length === 0) return endRound(state, out, state.maxedOut);
      // Everyone left has already finished this level → advance.
      if (remaining.every((id) => (state.playerProgress[id] ?? 0) >= state.level)) {
        return nextLevel({ ...state, outThisRound: out }, state.lastLevelUpId);
      }
      return { ...state, outThisRound: out };
    }

    // Completed the current level.
    const scores = { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + state.level };
    const progress = { ...state.playerProgress, [playerId]: state.level };
    if (state.level >= MAX_LEVEL) {
      const maxed = [...state.maxedOut, playerId];
      const done = { ...state, currentScores: scores, playerProgress: progress, maxedOut: maxed, maxLevelReached: state.level };
      const others = stillPlaying(done, room);
      if (others.every((id) => (progress[id] ?? 0) >= state.level)) return endRound(done, state.outThisRound, maxed);
      return done;
    }
    const updated = { ...state, playerProgress: progress, currentScores: scores, lastLevelUpId: playerId };
    const allDone = stillPlaying(updated, room).every((id) => (progress[id] ?? 0) >= state.level);
    return allDone ? nextLevel(updated, playerId) : updated;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "learning") {
      // learnIndex N means element N-1 is lit; every element (including the
      // last one) stays lit for a full tick before the repeat phase begins.
      if (state.learnIndex < state.level) {
        return { ...state, learnIndex: state.learnIndex + 1, timeLeft: state.level - state.learnIndex };
      }
      return { ...state, timeLeft: repeatSeconds(state.level), phase: "repeat", playerProgress: {} };
    }

    if (state.phase === "repeat") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      // Time is up: everyone still mid-sequence misses.
      const late = stillPlaying(state, room).filter((id) => (state.playerProgress[id] ?? 0) < state.level);
      const out = [...state.outThisRound, ...late];
      const survivors = stillPlaying({ ...state, outThisRound: out }, room);
      if (survivors.length > 0) return nextLevel({ ...state, outThisRound: out }, state.lastLevelUpId);
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
        timeLeft: START_LEVEL + 1,
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

function nextLevel(state: SimonGameState, leaderId: string | null): SimonGameState {
  const level = state.level + 1;
  return {
    ...state,
    phase: "learning",
    level,
    learnIndex: 0,
    timeLeft: level + 1,
    playerProgress: {},
    maxLevelReached: Math.max(state.maxLevelReached, level),
    lastLevelUpId: leaderId,
  };
}
