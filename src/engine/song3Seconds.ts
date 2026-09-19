import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const SONG_GAME_ID = "song3seconds";

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  category: string;
  hint: string;
  options: string[];
}

export const SONG_LIST: SongItem[] = [
  {
    id: "s1",
    title: "告白氣球",
    artist: "周杰倫",
    category: "華語流行",
    hint: "塞納河畔 左岸的咖啡 我手一杯 品嚐你的美…",
    options: ["告白氣球", "青花瓷", "簡單愛", "七里香"],
  },
  {
    id: "s2",
    title: "如果可以",
    artist: "韋禮安",
    category: "電影主題曲",
    hint: "如果可以 我想和你看每場煙火…",
    options: ["如果可以", "女孩", "慢慢等", "還是會"],
  },
  {
    id: "s3",
    title: "愛你",
    artist: "王心凌",
    category: "甜蜜經典",
    hint: "話不能亂說 經過了這麼多 才能夠看透…",
    options: ["愛你", "睫毛彎彎", "心電心", "第一次愛的人"],
  },
  {
    id: "s4",
    title: "想見你想見你想見你",
    artist: "八三夭",
    category: "影視金曲",
    hint: "想見你 只想見你 未來過去 我只想見你…",
    options: ["想見你想見你想見你", "東區東區", "最後的831", "致青春"],
  },
  {
    id: "s5",
    title: "Lemon",
    artist: "米津玄師",
    category: "日語流行",
    hint: "夢ならばどれほどよかったでしょう…",
    options: ["Lemon", "打上花火", "Kick Back", "紅蓮華"],
  },
  {
    id: "s6",
    title: "怪美的",
    artist: "蔡依林",
    category: "流行舞曲",
    hint: "垂涎的邪惡 陪我喝醉翻了幾趟…",
    options: ["怪美的", "玫瑰少年", "大藝術家", "舞娘"],
  },
];

export type SongPhase = "listen" | "answering" | "reveal" | "result";

export interface SongGameState {
  phase: SongPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  currentSong: SongItem;
  /** playerId -> chosen song title */
  playerAnswers: Record<string, string>;
  /** playerId -> response time in ms for speed bonus */
  answerTimes: Record<string, number>;
  roundStartTime: number;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface SongAnswerAction {
  type: "answer";
  choice: string;
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function getSong(roundIndex: number): SongItem {
  return SONG_LIST[(roundIndex - 1) % SONG_LIST.length];
}

export const Song3SecondsEngine: GameEngine<SongGameState> = {
  createGame(room) {
    const song = getSong(1);
    return {
      phase: "listen",
      currentRound: 1,
      totalRounds: Math.min(room.settings?.rounds ?? 4, SONG_LIST.length),
      timeLeft: 3, // 3 seconds "listen / countdown"
      currentSong: song,
      playerAnswers: {},
      answerTimes: {},
      roundStartTime: Date.now() + 3000,
      currentScores: initialScores(room.players),
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "answering") return state;

    const act = action as SongAnswerAction;
    if (act?.type !== "answer" || typeof act.choice !== "string") return state;
    if (state.playerAnswers[playerId]) return state; // Already answered

    const now = Date.now();
    const elapsed = Math.max(100, now - state.roundStartTime);
    const answers = { ...state.playerAnswers, [playerId]: act.choice };
    const times = { ...state.answerTimes, [playerId]: elapsed };

    const livingIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
    const allAnswered = livingIds.every((id) => Boolean(answers[id]));

    if (allAnswered) {
      return tallySongRound(state, answers, times);
    }

    return {
      ...state,
      playerAnswers: answers,
      answerTimes: times,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "listen") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "answering",
          timeLeft: Math.max(6, room.settings?.timer ?? 8),
          roundStartTime: Date.now(),
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "answering") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return tallySongRound(state, state.playerAnswers, state.answerTimes);
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "reveal") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        if (state.currentRound >= state.totalRounds) {
          const scores = state.currentScores;
          const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          return {
            ...state,
            phase: "result",
            winnerId: entries[0]?.[0] ?? null,
            timeLeft: 0,
          };
        } else {
          const nextRound = state.currentRound + 1;
          return {
            ...state,
            phase: "listen",
            currentRound: nextRound,
            timeLeft: 3,
            currentSong: getSong(nextRound),
            playerAnswers: {},
            answerTimes: {},
            roundStartTime: Date.now() + 3000,
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
        id: "music_master",
        name: "金曲快手",
        icon: "🎵",
        description: "以極限速度聽音辨歌稱霸排行榜",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function tallySongRound(
  state: SongGameState,
  answers: Record<string, string>,
  times: Record<string, number>,
): SongGameState {
  const scores = { ...state.currentScores };
  const correct = state.currentSong.title;

  // Faster answers get higher bonus (up to 15 pts, minimum 5 for correct)
  for (const [id, choice] of Object.entries(answers)) {
    if (choice === correct) {
      const responseMs = times[id] ?? 5000;
      const speedBonus = Math.max(0, Math.floor((6000 - responseMs) / 1000) * 2);
      scores[id] = (scores[id] ?? 0) + 10 + speedBonus;
    }
  }

  return {
    ...state,
    playerAnswers: answers,
    answerTimes: times,
    currentScores: scores,
    phase: "reveal",
    timeLeft: 5,
  };
}
