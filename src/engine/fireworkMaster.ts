import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const FIREWORK_GAME_ID = "fireworkmaster";

/** One hand-drawn line; points are x,y pairs on a 400×400 canvas. */
export interface FireworkStroke {
  c: string;
  w: number;
  p: number[];
}

/** A firework is whatever the player drew on their phone. */
export interface FireworkDesign {
  strokes: FireworkStroke[];
}

export const FIREWORK_COLORS = ["#ff3b6b", "#ff9f1c", "#ffe600", "#39ff14", "#00f0ff", "#4d7cff", "#bf00ff", "#ffffff"];
export const MAX_FW_STROKES = 40;
export const MAX_FW_POINTS = 240; // numbers per stroke (= 120 points)

export type FireworkPhase = "designing" | "show" | "voting" | "result";

export interface FireworkGameState {
  phase: FireworkPhase;
  currentRound: number;
  timeLeft: number;
  /** playerId -> FireworkDesign */
  designs: Record<string, FireworkDesign>;
  /** voterId -> votedPlayerId */
  votes: Record<string, string>;
  voteCounts: Record<string, number>;
  winnerId: string | null;
  currentScores: Record<string, number>;
}

export interface SubmitDesignAction {
  type: "submitDesign";
  design: FireworkDesign;
}

export interface VoteDesignAction {
  type: "voteDesign";
  targetPlayerId: string;
}

export type FireworkAction = SubmitDesignAction | VoteDesignAction;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function arr(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

/** Coerce a submitted drawing to safe, in-range values (also repairs RTDB round trips). */
export function sanitizeDesign(input: unknown): FireworkDesign {
  const strokes: FireworkStroke[] = [];
  for (const raw of arr((input as { strokes?: unknown } | null)?.strokes).slice(0, MAX_FW_STROKES)) {
    const line = raw as Partial<FireworkStroke> | null;
    if (!line) continue;
    const nums = arr(line.p).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const even = nums.slice(0, Math.min(MAX_FW_POINTS, nums.length - (nums.length % 2)));
    if (even.length < 2) continue;
    strokes.push({
      c: typeof line.c === "string" && /^#[0-9a-fA-F]{6}$/.test(line.c) ? line.c : FIREWORK_COLORS[0],
      w: typeof line.w === "number" && Number.isFinite(line.w) ? Math.round(Math.min(16, Math.max(2, line.w))) : 6,
      p: even.map((n) => Math.round(Math.min(400, Math.max(0, n)))),
    });
  }
  return { strokes };
}

/** A simple starburst for anyone who ran out of time without drawing. */
export function fallbackDesign(rand: () => number = Math.random): FireworkDesign {
  const c = FIREWORK_COLORS[Math.floor(rand() * (FIREWORK_COLORS.length - 1))];
  const rays = 10 + Math.floor(rand() * 6);
  const strokes: FireworkStroke[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    strokes.push({ c, w: 5, p: [200 + Math.cos(a) * 40, 200 + Math.sin(a) * 40, 200 + Math.cos(a) * 150, 200 + Math.sin(a) * 150].map(Math.round) });
  }
  return { strokes };
}

function drawTime(room: Room<FireworkGameState>): number {
  return Math.max(30, room.settings?.timer ?? 60);
}

function showTime(count: number): number {
  return Math.max(12, count * 3 + 4);
}

export const FireworkMasterEngine: GameEngine<FireworkGameState> = {
  createGame(room) {
    return {
      phase: "designing",
      currentRound: 1,
      timeLeft: drawTime(room),
      designs: {},
      votes: {},
      voteCounts: {},
      winnerId: null,
      currentScores: initialScores(room.players),
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "designing") {
      const act = action as SubmitDesignAction;
      if (act?.type !== "submitDesign") return state;

      const design = sanitizeDesign(act.design);
      if (design.strokes.length === 0) return state;
      const designs = { ...state.designs, [playerId]: design };
      const livingIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      const allSubmitted = livingIds.every((id) => Boolean(designs[id]));

      if (allSubmitted) {
        return {
          ...state,
          designs,
          phase: "show",
          timeLeft: showTime(Object.keys(designs).length),
        };
      }
      return { ...state, designs };
    }

    if (state.phase === "voting") {
      const act = action as VoteDesignAction;
      if (act?.type !== "voteDesign" || typeof act.targetPlayerId !== "string") return state;
      if (act.targetPlayerId === playerId) return state; // cannot vote for yourself

      const votes = { ...state.votes, [playerId]: act.targetPlayerId };
      const livingIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      const allVoted = livingIds.every((id) => Boolean(votes[id]));

      if (allVoted) {
        return tallyFireworkVotes({ ...state, votes });
      }
      return { ...state, votes };
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "designing") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        // Fallback default designs for players who didn't submit
        const designs = { ...state.designs };
        for (const id of Object.keys(room.players)) {
          if (!designs[id] || sanitizeDesign(designs[id]).strokes.length === 0) designs[id] = fallbackDesign();
        }
        return {
          ...state,
          designs,
          phase: "show",
          timeLeft: showTime(Object.keys(designs).length),
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "show") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "voting",
          timeLeft: 15,
          votes: {},
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "voting") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return tallyFireworkVotes(state);
      }
      return { ...state, timeLeft: nextTime };
    }

    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerId = state?.winnerId ?? entries[0]?.[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "grand_artisan",
        name: "傳奇煙火匠人",
        icon: "🎆",
        description: "以最壯麗璀璨的夜空煙火奪得全場掌聲",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function tallyFireworkVotes(state: FireworkGameState): FireworkGameState {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(state.votes)) {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }

  let maxCount = -1;
  let winner: string | null = null;
  for (const [id, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winner = id;
    }
  }

  const scores = { ...state.currentScores };
  for (const [id, count] of Object.entries(counts)) {
    scores[id] = (scores[id] ?? 0) + count * 15;
  }

  return {
    ...state,
    phase: "result",
    voteCounts: counts,
    winnerId: winner,
    currentScores: scores,
    timeLeft: 0,
  };
}
