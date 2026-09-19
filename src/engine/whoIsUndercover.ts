import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const UNDERCOVER_GAME_ID = "whoisundercoveragent";

export interface WordPair {
  civilianWord: string;
  undercoverWord: string;
}

export const WORD_PAIRS: WordPair[] = [
  { civilianWord: "珍珠奶茶", undercoverWord: "水果茶" },
  { civilianWord: "牛肉麵", undercoverWord: "羊肉爐" },
  { civilianWord: "捷運", undercoverWord: "高鐵" },
  { civilianWord: "企鵝", undercoverWord: "北極熊" },
  { civilianWord: "鹽酥雞", undercoverWord: "炸雞排" },
  { civilianWord: "麥當勞", undercoverWord: "肯德基" },
  { civilianWord: "自行車", undercoverWord: "滑板車" },
  { civilianWord: "太陽眼鏡", undercoverWord: "護目鏡" },
  { civilianWord: "吉他", undercoverWord: "烏克麗麗" },
  { civilianWord: "雨傘", undercoverWord: "雨衣" },
];

export type UndercoverPhase = "viewing_words" | "discussion" | "voting" | "eliminated" | "result";

export interface UndercoverGameState {
  phase: UndercoverPhase;
  currentRound: number;
  timeLeft: number;
  civilianWord: string;
  undercoverWord: string;
  undercoverPlayerId: string;
  /** playerId -> assigned secret word */
  playerWords: Record<string, string>;
  eliminatedPlayerIds: string[];
  votes: Record<string, string>;
  lastVotedOutId: string | null;
  winnerTeam: "civilians" | "undercover" | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface UndercoverVoteAction {
  type: "vote";
  targetPlayerId: string;
}

export interface ReadyAction {
  type: "ready";
}

export type UndercoverAction = UndercoverVoteAction | ReadyAction;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function assignWords(
  players: Room["players"],
  pair: WordPair,
): { words: Record<string, string>; undercoverId: string } {
  const playerIds = Object.keys(players).sort();
  const undercoverIndex = Math.floor(Math.random() * playerIds.length);
  const undercoverId = playerIds[undercoverIndex] ?? playerIds[0];

  const words: Record<string, string> = {};
  for (const id of playerIds) {
    words[id] = id === undercoverId ? pair.undercoverWord : pair.civilianWord;
  }

  return { words, undercoverId };
}

export const WhoIsUndercoverEngine: GameEngine<UndercoverGameState> = {
  createGame(room) {
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const { words, undercoverId } = assignWords(room.players, pair);

    return {
      phase: "viewing_words",
      currentRound: 1,
      timeLeft: 10, // 10s to read personal word quietly
      civilianWord: pair.civilianWord,
      undercoverWord: pair.undercoverWord,
      undercoverPlayerId: undercoverId,
      playerWords: words,
      eliminatedPlayerIds: [],
      votes: {},
      lastVotedOutId: null,
      winnerTeam: null,
      currentScores: initialScores(room.players),
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "voting") {
      const act = action as UndercoverVoteAction;
      if (act?.type !== "vote" || typeof act.targetPlayerId !== "string") return state;

      // Cannot vote if eliminated or voting for eliminated
      if (state.eliminatedPlayerIds.includes(playerId) || state.eliminatedPlayerIds.includes(act.targetPlayerId)) {
        return state;
      }

      const votes = { ...state.votes, [playerId]: act.targetPlayerId };
      const livingIds = Object.keys(room.players).filter(
        (id) => !state.eliminatedPlayerIds.includes(id) && room.players[id]?.isConnected !== false,
      );
      const allVoted = livingIds.every((id) => Boolean(votes[id]));

      if (allVoted) {
        return tallyVotesAndResolve(state, votes, room);
      }

      return { ...state, votes };
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "viewing_words") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "discussion",
          timeLeft: Math.max(30, room.settings?.timer ?? 45), // 45s discussion
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "discussion") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "voting",
          timeLeft: 20, // 20s to vote
          votes: {},
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "voting") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return tallyVotesAndResolve(state, state.votes, room);
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "eliminated") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        // Next round discussion or continue
        return {
          ...state,
          phase: "discussion",
          currentRound: state.currentRound + 1,
          timeLeft: Math.max(25, room.settings?.timer ?? 40),
          votes: {},
          lastVotedOutId: null,
        };
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
    if (state?.winnerTeam === "undercover" && state.undercoverPlayerId) {
      achievements.push({
        id: "master_spy",
        name: "影帝臥底",
        icon: "🕵️",
        description: "隱藏身分成功存活到底",
        playerId: state.undercoverPlayerId,
      });
    } else if (state?.winnerTeam === "civilians") {
      achievements.push({
        id: "detective",
        name: "神探破案",
        icon: "🔍",
        description: "平民陣營合力揪出臥底",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function tallyVotesAndResolve(
  state: UndercoverGameState,
  votes: Record<string, string>,
  room: Room<UndercoverGameState>,
): UndercoverGameState {
  const counts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }

  let maxCount = 0;
  let targetOut: string | null = null;
  for (const [id, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      targetOut = id;
    }
  }

  const eliminated = targetOut ? [...state.eliminatedPlayerIds, targetOut] : state.eliminatedPlayerIds;
  const livingPlayers = Object.keys(room.players).filter((id) => !eliminated.includes(id));
  const undercoverCaught = targetOut === state.undercoverPlayerId;
  const undercoverSurvives = livingPlayers.length <= 2 && livingPlayers.includes(state.undercoverPlayerId);

  const scores = { ...state.currentScores };

  if (undercoverCaught) {
    // Civilians win!
    for (const id of Object.keys(room.players)) {
      if (id !== state.undercoverPlayerId) {
        scores[id] = (scores[id] ?? 0) + 20;
      }
    }
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return {
      ...state,
      votes,
      eliminatedPlayerIds: eliminated,
      lastVotedOutId: targetOut,
      phase: "result",
      winnerTeam: "civilians",
      winnerId: entries[0]?.[0] ?? null,
      currentScores: scores,
      timeLeft: 0,
    };
  } else if (undercoverSurvives) {
    // Undercover wins!
    scores[state.undercoverPlayerId] = (scores[state.undercoverPlayerId] ?? 0) + 50;
    return {
      ...state,
      votes,
      eliminatedPlayerIds: eliminated,
      lastVotedOutId: targetOut,
      phase: "result",
      winnerTeam: "undercover",
      winnerId: state.undercoverPlayerId,
      currentScores: scores,
      timeLeft: 0,
    };
  }

  // Round continues
  return {
    ...state,
    votes,
    eliminatedPlayerIds: eliminated,
    lastVotedOutId: targetOut,
    phase: "eliminated",
    timeLeft: 6,
  };
}
