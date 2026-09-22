import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { topScorers } from "./scoring";

export const CHAIRS_GAME_ID = "musicalchairs";

export type ChairsPhase = "briefing" | "music" | "sit" | "round_reveal" | "result";

export interface ChairsGameState {
  phase: ChairsPhase;
  timeLeft: number;
  currentRound: number;
  totalRounds: number;
  /** Players still in the game, in seat order. */
  survivors: string[];
  eliminatedPlayerIds: string[];
  /** Seconds of music for the current/last round (for the TV metronome). */
  musicDuration: number;
  /** playerId -> tap sequence index (1-based). */
  sitOrder: Record<string, number>;
  roundEliminatedId: string | null;
  lastStandId: string | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
  winnerIds: string[];
}

export interface SitAction {
  type: "sit";
}

export type ChairsAction = SitAction;

const BRIEFING_SECONDS = 3;
export const SIT_SECONDS = 3;
const REVEAL_SECONDS = 3;
const SURVIVE_POINTS = 10;
const FINAL_POINTS = 50;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

/** 5-11s of music, creeping shorter as the table shrinks. */
function musicDurationFor(round: number): number {
  const roll = 5 + Math.floor(Math.random() * 7);
  return Math.max(4, roll - (round - 1));
}

export const MusicalChairsEngine: GameEngine<ChairsGameState> = {
  createGame(room) {
    const ids = Object.keys(room.players);
    return {
      phase: "briefing",
      timeLeft: BRIEFING_SECONDS,
      currentRound: 1,
      totalRounds: Math.max(1, ids.length - 1),
      survivors: [...ids],
      eliminatedPlayerIds: [],
      musicDuration: 0,
      sitOrder: {},
      roundEliminatedId: null,
      lastStandId: null,
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
    if (!state || state.phase !== "sit") return state;
    const act = action as ChairsAction;
    if (act?.type !== "sit") return state;
    if (!state.survivors.includes(playerId)) return state;
    if (state.sitOrder[playerId] !== undefined) return state; // only the first tap counts
    const last = Math.max(0, ...Object.values(state.sitOrder));
    return { ...state, sitOrder: { ...state.sitOrder, [playerId]: last + 1 } };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "briefing") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      const dur = musicDurationFor(state.currentRound);
      return { ...state, phase: "music", timeLeft: dur, musicDuration: dur };
    }

    if (state.phase === "music") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return { ...state, phase: "sit", timeLeft: SIT_SECONDS, sitOrder: {} };
    }

    if (state.phase === "sit") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return resolveSit(state, room);
    }

    if (state.phase === "round_reveal") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      const nextRound = state.currentRound + 1;
      const dur = musicDurationFor(nextRound);
      return {
        ...state,
        phase: "music",
        currentRound: nextRound,
        timeLeft: dur,
        musicDuration: dur,
        roundEliminatedId: null,
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
    const winnerId = state?.lastStandId ?? winnerIds[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "last_stand",
        name: "音樂椅之王",
        icon: "🪑",
        description: "一路坐到最後一把椅子",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId, winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function resolveSit(state: ChairsGameState, room: Room<ChairsGameState>): ChairsGameState {
  const connected = (id: string) => room.players[id]?.isConnected !== false;
  // Tappers in tap order, then the rest (they got no chair at all).
  const tappers = state.survivors
    .filter((id) => state.sitOrder[id] !== undefined && connected(id))
    .sort((a, b) => state.sitOrder[a] - state.sitOrder[b]);
  const rest = state.survivors.filter((id) => !tappers.includes(id));
  const seated = [...tappers, ...rest];
  const chairs = seated.length - 1;
  const eliminated = seated[chairs] ?? null;
  const remaining = seated.slice(0, chairs);
  const scores = { ...state.currentScores };

  const isFinal = state.currentRound >= state.totalRounds;
  if (isFinal) {
    const winner = remaining[0] ?? null;
    if (winner) scores[winner] = (scores[winner] ?? 0) + FINAL_POINTS;
    return {
      ...state,
      phase: "result",
      timeLeft: 0,
      roundEliminatedId: eliminated,
      lastStandId: winner,
      currentScores: scores,
      winnerId: winner,
      winnerIds: winner ? [winner] : [],
      survivors: remaining,
      eliminatedPlayerIds: eliminated ? [...state.eliminatedPlayerIds, eliminated] : state.eliminatedPlayerIds,
    };
  }

  for (const id of remaining) scores[id] = (scores[id] ?? 0) + SURVIVE_POINTS;
  return {
    ...state,
    phase: "round_reveal",
    timeLeft: REVEAL_SECONDS,
    roundEliminatedId: eliminated,
    currentScores: scores,
    survivors: remaining,
    eliminatedPlayerIds: eliminated ? [...state.eliminatedPlayerIds, eliminated] : state.eliminatedPlayerIds,
  };
}
