import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { topScorers } from "./scoring";

export const MOLES_GAME_ID = "whackmoles";

export type MolesPhase = "round_intro" | "hunting" | "round_reveal" | "result";

export interface MoleSpawn {
  cell: number;
  startAt: number;
  endAt: number;
  hitBy: string[];
}

export interface MolesGameState {
  phase: MolesPhase;
  timeLeft: number;
  currentRound: number;
  totalRounds: number;
  /** 3x3 grid. */
  grid: number;
  spawns: MoleSpawn[];
  roundStartedAt: number;
  roundDuration: number;
  hits: Record<string, number>;
  misses: Record<string, number>;
  streaks: Record<string, number>;
  totalHits: Record<string, number>;
  currentScores: Record<string, number>;
  lastHitPlayerId: string | null;
  winnerId: string | null;
  winnerIds: string[];
}

export interface WhackAction {
  type: "whack";
  cell: number;
}

export type MolesAction = WhackAction;

const INTRO_SECONDS = 2;
const REVEAL_SECONDS = 3;
export const COMBO_SIZE = 5;
const COMBO_BONUS = 5;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

export function moleRoundDuration(round: number): number {
  return Math.max(15, 30 - (round - 1) * 5);
}

/**
 * Pre-generate the whole round as absolute-time spawn events. Phones validate
 * taps against this schedule (pure state), and the TV reveals the same events
 * with a local clock — no host race either way.
 */
export function generateSpawns(now: number, round: number, duration: number): MoleSpawn[] {
  const spawns: MoleSpawn[] = [];
  const baseInterval = 1150 - (round - 1) * 180;
  const windowMs = Math.max(550, 950 - (round - 1) * 120);
  const endAt = now + duration * 1000 - 1200;
  let t = 800;
  let prevCell = -1;
  while (now + t < endAt) {
    let cell = Math.floor(Math.random() * 9);
    if (cell === prevCell) cell = (cell + 1 + Math.floor(Math.random() * 8)) % 9;
    spawns.push({ cell, startAt: now + t, endAt: now + t + windowMs, hitBy: [] });
    prevCell = cell;
    t += baseInterval + Math.floor(Math.random() * 400 - 200);
  }
  return spawns;
}

export const WhackMolesEngine: GameEngine<MolesGameState> = {
  createGame(room) {
    const rounds = room.settings?.rounds ?? 3;
    return {
      phase: "round_intro",
      timeLeft: INTRO_SECONDS,
      currentRound: 1,
      totalRounds: Math.max(1, Math.min(5, rounds)),
      grid: 3,
      spawns: [],
      roundStartedAt: 0,
      roundDuration: moleRoundDuration(1),
      hits: {},
      misses: {},
      streaks: {},
      totalHits: {},
      currentScores: initialScores(room.players),
      lastHitPlayerId: null,
      winnerId: null,
      winnerIds: [],
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "hunting") return state;
    const act = action as MolesAction;
    if (act?.type !== "whack" || typeof act.cell !== "number" || !Number.isInteger(act.cell) || act.cell < 0 || act.cell > 8) {
      return state;
    }
    const now = Date.now();
    const spawn = state.spawns.find(
      (s) => s.cell === act.cell && now >= s.startAt && now < s.endAt && s.hitBy.length === 0,
    );
    if (!spawn) {
      // Whacking air: no penalty, but the streak resets.
      return {
        ...state,
        misses: { ...state.misses, [playerId]: (state.misses[playerId] ?? 0) + 1 },
        streaks: { ...state.streaks, [playerId]: 0 },
      };
    }
    const streak = (state.streaks[playerId] ?? 0) + 1;
    const bonus = streak % COMBO_SIZE === 0 ? COMBO_BONUS : 0;
    return {
      ...state,
      spawns: state.spawns.map((s) => (s === spawn ? { ...s, hitBy: [playerId] } : s)),
      hits: { ...state.hits, [playerId]: (state.hits[playerId] ?? 0) + 1 },
      totalHits: { ...state.totalHits, [playerId]: (state.totalHits[playerId] ?? 0) + 1 },
      streaks: { ...state.streaks, [playerId]: streak },
      currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + 1 + bonus },
      lastHitPlayerId: playerId,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "round_intro") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      const now = Date.now();
      const duration = moleRoundDuration(state.currentRound);
      return {
        ...state,
        phase: "hunting",
        timeLeft: duration,
        spawns: generateSpawns(now, state.currentRound, duration),
        roundStartedAt: now,
        roundDuration: duration,
        hits: {},
        misses: {},
        streaks: {},
        lastHitPlayerId: null,
      };
    }

    if (state.phase === "hunting") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return { ...state, phase: "round_reveal", timeLeft: REVEAL_SECONDS };
    }

    if (state.phase === "round_reveal") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      if (state.currentRound >= state.totalRounds) {
        const winnerIds = topScorers(state.currentScores);
        return { ...state, phase: "result", timeLeft: 0, winnerId: winnerIds[0] ?? null, winnerIds };
      }
      const nextRound = state.currentRound + 1;
      return { ...state, phase: "round_intro", currentRound: nextRound, timeLeft: INTRO_SECONDS, roundDuration: moleRoundDuration(nextRound) };
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
        id: "whack_champion",
        name: "敲木頭之王",
        icon: "🐹",
        description: "全場敲中最多的木頭",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId, winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
