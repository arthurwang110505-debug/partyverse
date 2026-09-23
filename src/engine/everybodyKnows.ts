import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const EVERYBODY_GAME_ID = "everybodyknows";

export interface QuestionDef {
  id: string;
  question: string;
}

export const QUESTIONS: QuestionDef[] = [
  { id: "q1", question: "誰最容易在旅行中迷路？" },
  { id: "q2", question: "誰喝醉後最容易做出瘋狂的事？" },
  { id: "q3", question: "如果世界末日來臨，誰最可能活到最後？" },
  { id: "q4", question: "誰手機螢幕使用時間絕對是最長的？" },
  { id: "q5", question: "誰在團體中最像大家的媽媽/保母？" },
  { id: "q6", question: "誰最容易買一堆廢物回家堆著？" },
  { id: "q7", question: "誰最可能偷偷去報名實境秀或選秀？" },
  { id: "q8", question: "遇到危險時，誰會第一個尖叫逃跑？" },
  { id: "q9", question: "誰最擅長講冷笑話讓氣氛結冰？" },
  { id: "q10", question: "如果突然中了一億樂透，誰最會隱瞞到底？" },
  { id: "q11", question: "誰最容易把別人的秘密不小心說溜嘴？" },
  { id: "q12", question: "誰出門準備時間總是要最久？" },
  { id: "q13", question: "誰最可能半夜三點爬起来煮宵夜？" },
  { id: "q14", question: "誰最常在團體游中當「落單的那個」？" },
  { id: "q15", question: "誰的錢包裡絕對有一堆來路不明的收據？" },
  { id: "q16", question: "誰最可能把簡訊打錯人還沒發現？" },
  { id: "q17", question: "誰唱卡拉OK時最自以為是天王天后？" },
  { id: "q18", question: "誰最可能邊聽電話邊走路結果撞到人？" },
  { id: "q19", question: "誰的冰箱裡一定過期了還捨不得丟？" },
  { id: "q20", question: "誰最可能在聚會結束後還在發廢話訊息？" },
];

export type EverybodyPhase = "voting" | "reveal" | "result";

export interface EverybodyGameState {
  phase: EverybodyPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  question: QuestionDef;
  /** playerId -> targetPlayerId voted for */
  votes: Record<string, string>;
  /** targetPlayerId -> count */
  voteCounts: Record<string, number>;
  mostVotedPlayerIds: string[];
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface EverybodyVoteAction {
  type: "vote";
  targetPlayerId: string;
}

function isVoteAction(action: unknown): action is EverybodyVoteAction {
  return (
    typeof action === "object" &&
    action !== null &&
    (action as { type?: unknown }).type === "vote" &&
    typeof (action as { targetPlayerId?: unknown }).targetPlayerId === "string"
  );
}

function getRandomQuestion(excludeIds: string[] = []): QuestionDef {
  const available = QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  const pool = available.length > 0 ? available : QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

export const EverybodyKnowsEngine: GameEngine<EverybodyGameState> = {
  createGame(room) {
    const q = getRandomQuestion();
    return {
      phase: "voting",
      currentRound: 1,
      totalRounds: room.settings?.rounds ?? 3,
      timeLeft: room.settings?.timer ?? 15,
      question: q,
      votes: {},
      voteCounts: {},
      mostVotedPlayerIds: [],
      currentScores: initialScores(room.players),
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "voting") return state;
    if (!isVoteAction(action)) return state;

    // Must vote for a valid player in the room
    if (!room.players[action.targetPlayerId]) return state;

    const nextVotes = { ...state.votes, [playerId]: action.targetPlayerId };
    const onlinePlayerIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
    const allVoted = onlinePlayerIds.every((id) => Boolean(nextVotes[id]));

    // If everyone has voted, immediately transition to reveal phase
    if (allVoted) {
      return tallyVotesAndTransition(state, nextVotes, room);
    }

    return {
      ...state,
      votes: nextVotes,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "voting") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return tallyVotesAndTransition(state, state.votes, room);
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "reveal") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        if (state.currentRound >= state.totalRounds) {
          // Finish game
          const scores = state.currentScores;
          const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          const winnerId = entries[0]?.[0] ?? null;
          return {
            ...state,
            phase: "result",
            winnerId,
            timeLeft: 0,
          };
        } else {
          // Next round
          const nextQ = getRandomQuestion([state.question.id]);
          return {
            ...state,
            phase: "voting",
            currentRound: state.currentRound + 1,
            timeLeft: room.settings?.timer ?? 15,
            question: nextQ,
            votes: {},
            voteCounts: {},
            mostVotedPlayerIds: [],
          };
        }
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
        id: "popular",
        name: "全場焦點",
        icon: "👑",
        description: "獲得最高人氣或最高得分",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function tallyVotesAndTransition(
  state: EverybodyGameState,
  votes: Record<string, string>,
  _room: Room<EverybodyGameState>,
): EverybodyGameState {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }

  let maxCount = 0;
  for (const count of Object.values(counts)) {
    if (count > maxCount) maxCount = count;
  }

  const mostVoted = maxCount > 0 ? Object.keys(counts).filter((id) => counts[id] === maxCount) : [];

  // Scoring: Players who voted for the consensus winner get 10 points
  const updatedScores = { ...state.currentScores };
  for (const [voterId, targetId] of Object.entries(votes)) {
    if (mostVoted.includes(targetId)) {
      updatedScores[voterId] = (updatedScores[voterId] ?? 0) + 10;
    }
  }

  return {
    ...state,
    votes,
    voteCounts: counts,
    mostVotedPlayerIds: mostVoted,
    phase: "reveal",
    timeLeft: 7, // 7 seconds reveal animation/discussion
    currentScores: updatedScores,
  };
}
