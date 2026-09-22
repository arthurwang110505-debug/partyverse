import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { topScorers } from "./scoring";

export const CHAIN_GAME_ID = "wordchain";

export type ChainPhase = "chaining" | "voting" | "round_reveal" | "result";

export interface PendingWord {
  word: string;
  playerId: string;
  id: number;
}

export interface ChainGameState {
  phase: ChainPhase;
  timeLeft: number;
  /** The round clock parked while the table votes on an objection. */
  roundTimeLeft?: number;
  currentRound: number;
  totalRounds: number;
  /** The confirmed chain head everyone must link from. */
  headWord: string;
  /** Last character of `headWord` — the required first character. */
  requiredChar: string;
  /** Every accepted (and seeded) word this round; duplicates are illegal. */
  chain: string[];
  /** The word that just landed, awaiting the objection window. */
  pending: PendingWord | null;
  objectionWindow: number;
  objectors: string[];
  /** playerId -> true (valid) / false (invalid) while voting. */
  votes: Record<string, boolean>;
  wordSeq: number;
  stuckTimeouts: number;
  starterIndex: number;
  currentScores: Record<string, number>;
  winnerId: string | null;
  winnerIds: string[];
}

export interface SubmitWordAction {
  type: "submitWord";
  word: string;
}
export interface ObjectAction {
  type: "object";
}
export interface VoteWordAction {
  type: "voteWord";
  valid: boolean;
}

export type ChainAction = SubmitWordAction | ObjectAction | VoteWordAction;

export const OBJECTION_SECONDS = 5;
const VOTING_SECONDS = 4;
const REVEAL_SECONDS = 3;
const REJECT_RESTART_SECONDS = 10;
const LINK_POINTS = 10;
const OBJECT_POINTS = 5;
const REJECT_PENALTY = 5;

/**
 * Seed words used to open each round and to bail out of a two-timeout stall.
 * They only ever start chains — play itself is open-ended.
 */
export const STARTER_WORDS: string[] = [
  "開心", "心中", "中心", "心情", "情形", "情況", "概念", "思考", "考察", "清楚",
  "楚河", "河流", "流水", "水果", "果然", "然後", "後面", "面積", "積累", "累贅",
  "寶貝", "寶島", "寶藏", "勇敢", "敢言", "言語", "語言", "言詞", "詞語", "語文",
  "文章", "章程", "程序", "現代", "代表", "表現", "現場", "場地", "地方", "方便",
  "便利", "利益", "益處", "處所", "所有", "有限", "限制", "制度", "度日", "日常",
  "常規", "規律", "法律", "律所", "所以",
];

const CJK_WORD = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,4}$/;

export function normalizeWord(raw: unknown): string {
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

export function isValidLink(word: string, requiredChar: string, used: string[]): boolean {
  if (!CJK_WORD.test(word)) return false;
  if (word[0] !== requiredChar) return false;
  if (used.includes(word)) return false;
  return true;
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

function starterWord(index: number): string {
  return STARTER_WORDS[Math.abs(index) % STARTER_WORDS.length];
}

export const WordChainEngine: GameEngine<ChainGameState> = {
  createGame(room) {
    const rounds = room.settings?.rounds ?? 5;
    const head = starterWord(Math.floor(Math.random() * STARTER_WORDS.length));
    return {
      phase: "chaining",
      timeLeft: room.settings?.timer ?? 20,
      currentRound: 1,
      totalRounds: Math.max(1, rounds),
      headWord: head,
      requiredChar: head[head.length - 1],
      chain: [head],
      pending: null,
      objectionWindow: 0,
      objectors: [],
      votes: {},
      wordSeq: 0,
      stuckTimeouts: 0,
      starterIndex: 0,
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
    if (!state) return state;
    const act = action as ChainAction;

    if (act?.type === "submitWord") {
      if (state.phase !== "chaining") return state;
      const word = normalizeWord(act.word);
      if (!isValidLink(word, state.requiredChar, state.chain)) return state;
      if (state.pending) {
        // A faster word arrives before the window closes: bank the pending
        // word, then put the new one under objection.
        const confirmed = confirmPending(state);
        return {
          ...confirmed,
          chain: [...confirmed.chain, word],
          pending: { word, playerId, id: confirmed.wordSeq + 1 },
          wordSeq: confirmed.wordSeq + 1,
          objectionWindow: OBJECTION_SECONDS,
        };
      }
      return {
        ...state,
        chain: [...state.chain, word],
        pending: { word, playerId, id: state.wordSeq + 1 },
        wordSeq: state.wordSeq + 1,
        objectionWindow: OBJECTION_SECONDS,
      };
    }

    if (act?.type === "object") {
      // Objecting is possible while the word is pending (chaining) AND while
      // the table is already voting — objectors share the +5 reward.
      const inWindow =
        (state.phase === "chaining" && state.objectionWindow > 0) || (state.phase === "voting" && state.pending);
      if (!inWindow || !state.pending) return state;
      if (playerId === state.pending.playerId) return state;
      if (state.objectors.includes(playerId)) return state;
      return {
        ...state,
        phase: "voting",
        // Park the round clock so an upheld vote resumes exactly where the
        // round left off (a rejected word gets a fresh REJECT_RESTART_SECONDS).
        roundTimeLeft: state.timeLeft,
        timeLeft: VOTING_SECONDS,
        objectors: [...state.objectors, playerId],
        votes: {},
      };
    }

    if (act?.type === "voteWord") {
      if (state.phase !== "voting" || !state.pending) return state;
      if (playerId === state.pending.playerId) return state; // no voting for yourself
      if (state.votes[playerId] !== undefined) return state;
      const votes = { ...state.votes, [playerId]: act.valid === true };
      const next = { ...state, votes };
      const eligible = Object.keys(room.players).filter((id) => id !== state.pending!.playerId);
      const allVoted = eligible.every((id) => next.votes[id] !== undefined);
      if (!allVoted) return next;
      return resolveVotes(next);
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "chaining") {
      let next = state;
      if (state.pending && state.objectionWindow > 0) {
        const window = state.objectionWindow - 1;
        if (window <= 0) next = confirmPending({ ...next, objectionWindow: 0 });
        else next = { ...next, objectionWindow: window };
      }
      if (next.timeLeft > 1) {
        return next === state ? { ...state, timeLeft: state.timeLeft - 1 } : { ...next, timeLeft: next.timeLeft - 1 };
      }
      // Round deadline.
      if (next.pending) {
        return { ...confirmPending(next), phase: "round_reveal", timeLeft: REVEAL_SECONDS };
      }
      // Nobody linked in time: one silent retry, then bail to a seed word.
      const stuck = state.stuckTimeouts + 1;
      const timer = room.settings?.timer ?? 20;
      if (stuck >= 2) {
        const head = starterWord(state.starterIndex + 1);
        return {
          ...next,
          headWord: head,
          requiredChar: head[head.length - 1],
          chain: [...next.chain, head],
          starterIndex: state.starterIndex + 1,
          stuckTimeouts: 0,
          timeLeft: timer,
        };
      }
      return { ...next, stuckTimeouts: stuck, timeLeft: timer };
    }

    if (state.phase === "voting") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return resolveVotes(state);
    }

    if (state.phase === "round_reveal") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      if (state.currentRound >= state.totalRounds) {
        const winnerIds = topScorers(state.currentScores);
        return { ...state, phase: "result", timeLeft: 0, winnerId: winnerIds[0] ?? null, winnerIds };
      }
      const head = starterWord(state.starterIndex + 1);
      const timer = room.settings?.timer ?? 20;
      return {
        ...state,
        phase: "chaining",
        currentRound: state.currentRound + 1,
        headWord: head,
        requiredChar: head[head.length - 1],
        chain: [head],
        pending: null,
        objectionWindow: 0,
        objectors: [],
        votes: {},
        stuckTimeouts: 0,
        starterIndex: state.starterIndex + 1,
        timeLeft: timer,
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
        id: "chain_master",
        name: "接龍高手",
        icon: "🀄",
        description: "文字接龍搶下最多分數",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId, winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function confirmPending(state: ChainGameState): ChainGameState {
  if (!state.pending) return state;
  const { word, playerId } = state.pending;
  return {
    ...state,
    headWord: word,
    requiredChar: word[word.length - 1],
    pending: null,
    objectionWindow: 0,
    objectors: [],
    currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + LINK_POINTS },
  };
}

function resolveVotes(state: ChainGameState): ChainGameState {
  const votes = Object.values(state.votes);
  const invalid = votes.filter((v) => v === false).length;
  const valid = votes.filter((v) => v === true).length;

  if (invalid > valid && state.pending) {
    // The table overrules the word.
    const scores = { ...state.currentScores };
    scores[state.pending.playerId] = Math.max(0, (scores[state.pending.playerId] ?? 0) - REJECT_PENALTY);
    for (const id of state.objectors) scores[id] = (scores[id] ?? 0) + OBJECT_POINTS;
    return {
      ...state,
      phase: "chaining",
      timeLeft: REJECT_RESTART_SECONDS,
      pending: null,
      objectionWindow: 0,
      objectors: [],
      votes: {},
      currentScores: scores,
    };
  }

  // Valid (or a tie): the word stands and the round clock resumes.
  const confirmed = state.pending ? confirmPending(state) : state;
  return {
    ...confirmed,
    phase: "chaining",
    timeLeft: confirmed.roundTimeLeft ?? REJECT_RESTART_SECONDS,
    objectionWindow: 0,
    objectors: [],
    votes: {},
  };
}
