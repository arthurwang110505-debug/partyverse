import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const SONG_GAME_ID = "song3seconds";

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  category: string;
  /** The iconic line that flashes on the TV and gets un-masked over time. */
  lyric: string;
  options: string[];
}

export const SONG_LIST: SongItem[] = [
  {
    id: "s1",
    title: "告白氣球",
    artist: "周杰倫",
    category: "華語流行",
    lyric: "塞納河畔 左岸的咖啡",
    options: ["告白氣球", "青花瓷", "七里香", "簡單愛"],
  },
  {
    id: "s2",
    title: "如果可以",
    artist: "韋禮安",
    category: "電影主題曲",
    lyric: "如果可以 我想和你看每場煙火",
    options: ["如果可以", "慢慢等", "還是會", "女孩"],
  },
  {
    id: "s3",
    title: "愛你",
    artist: "王心凌",
    category: "甜蜜經典",
    lyric: "話不能亂說 經過了這麼多",
    options: ["愛你", "睫毛彎彎", "心電心", "第一次愛的人"],
  },
  {
    id: "s4",
    title: "想見你想見你想見你",
    artist: "八三夭",
    category: "影視金曲",
    lyric: "想見你 只想見你 未來過去",
    options: ["想見你想見你想見你", "東區東區", "最後的831", "致青春"],
  },
  {
    id: "s5",
    title: "Lemon",
    artist: "米津玄師",
    category: "日語流行",
    lyric: "夢ならばどれほどよかったでしょう",
    options: ["Lemon", "紅蓮華", "打上花火", "Kick Back"],
  },
  {
    id: "s6",
    title: "怪美的",
    artist: "蔡依林",
    category: "流行舞曲",
    lyric: "垂涎的邪惡 陪我喝醉翻了幾趟",
    options: ["怪美的", "玫瑰少年", "大藝術家", "舞娘"],
  },
  {
    id: "s7",
    title: "夜曲",
    artist: "周杰倫",
    category: "華語流行",
    lyric: "窗外的麻雀 在電線桿上多嘴",
    options: ["夜曲", "告白氣球", "園遊會", "蘭亭序"],
  },
  {
    id: "s8",
    title: "光年之外",
    artist: "鄧紫棋",
    category: "電影主題曲",
    lyric: "當我抬起頭 才發覺 聖潔的遠方",
    options: ["光年之外", "泡沫", "多遠都要在一起", "喜欢你"],
  },
  {
    id: "s9",
    title: "愛你一萬年",
    artist: "劉若英",
    category: "影視金曲",
    lyric: "我願愛你一萬年 直到天荒地老",
    options: ["愛你一萬年", "後來", "我在他鄉", "約定"],
  },
  {
    id: "s10",
    title: "稻香",
    artist: "周杰倫",
    category: "田園治癒",
    lyric: "回家吧 回到最初的美好",
    options: ["稻香", "晴天", "聽媽媽的話", "菊花台"],
  },
  {
    id: "s11",
    title: "孤勇者",
    artist: "陳奕迅",
    category: "影視金曲",
    lyric: "愛你不執著 被愛不孤單",
    options: ["孤勇者", "海闊天空", "浮誇", "紅梅開"],
  },
  {
    id: "s12",
    title: "Dynamite",
    artist: "BTS",
    category: "西洋流行",
    lyric: "I got love in my heart, don't know how to say it",
    options: ["Dynamite", "Butter", "Permission to Dance", "Blueberry Nights"],
  },
];

export type SongPhase = "listen" | "answering" | "reveal" | "result";

export interface SongGameState {
  phase: SongPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  currentSong: SongItem;
  /** How many characters of the lyric are un-masked on the TV (and phones). */
  lyricRevealed: number;
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

/** First-mask how much of the lyric depends on the room difficulty. */
export function initialLyricRevealed(song: SongItem, difficulty: string): number {
  const letters = Array.from(song.lyric);
  const ratio = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0.15 : 0.25;
  return Math.max(1, Math.floor(letters.length * ratio));
}

/** Per-character mask, stable across TV and phone renderers. */
export function lyricMask(song: SongItem, revealed: number): Array<{ char: string; shown: boolean }> {
  const letters = Array.from(song.lyric);
  const cap = Math.max(0, Math.min(letters.length, revealed));
  return letters.map((char, index) => ({ char, shown: index < cap }));
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
      lyricRevealed: initialLyricRevealed(song, room.settings?.difficulty ?? "easy"),
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
      // Every two seconds the TV un-masks one more lyric character: the
      // longer nobody answers, the easier the song becomes.
      const letters = Array.from(state.currentSong.lyric).length;
      const nextRevealed =
        nextTime > 0 && nextTime % 2 === 0
          ? Math.min(letters, (state.lyricRevealed ?? 0) + 1)
          : state.lyricRevealed;
      if (nextTime <= 0) {
        return tallySongRound(state, state.playerAnswers, state.answerTimes);
      }
      return { ...state, timeLeft: nextTime, lyricRevealed: nextRevealed };
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
          const song = getSong(nextRound);
          return {
            ...state,
            phase: "listen",
            currentRound: nextRound,
            timeLeft: 3,
            currentSong: song,
            lyricRevealed: initialLyricRevealed(song, room.settings?.difficulty ?? "easy"),
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
        description: "以極限速度解鎖歌詞並稱霸排行榜",
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
