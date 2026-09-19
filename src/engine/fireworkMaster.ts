import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const FIREWORK_GAME_ID = "fireworkmaster";

export interface FireworkDesign {
  color: string;
  shape: "circle" | "star" | "heart" | "ring";
  trailEffect: "sparkle" | "smoke" | "glitter";
  density: number;
}

export const DEFAULT_DESIGN: FireworkDesign = {
  color: "#ff007f",
  shape: "circle",
  trailEffect: "sparkle",
  density: 30,
};

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

export const FireworkMasterEngine: GameEngine<FireworkGameState> = {
  createGame(room) {
    return {
      phase: "designing",
      currentRound: 1,
      timeLeft: Math.max(25, room.settings?.timer ?? 30),
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
      if (act?.type !== "submitDesign" || !act.design) return state;

      const designs = { ...state.designs, [playerId]: act.design };
      const livingIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      const allSubmitted = livingIds.every((id) => Boolean(designs[id]));

      if (allSubmitted) {
        return {
          ...state,
          designs,
          phase: "show",
          timeLeft: 12, // 12 seconds grand firework show
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
          if (!designs[id]) designs[id] = { ...DEFAULT_DESIGN, color: "#" + Math.floor(Math.random()*16777215).toString(16) };
        }
        return {
          ...state,
          designs,
          phase: "show",
          timeLeft: 12,
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
