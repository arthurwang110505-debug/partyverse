import { serverNow } from "./clock";
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

/** Titles used as extra wrong answers when a category has few songs. */
const EXTRA_TITLES: Record<string, string[]> = {"日語流行": ["打上花火", "Pretender", "夜に駆ける", "Kick Back"], "西洋流行": ["Blinding Lights", "Bad Guy", "Perfect", "Butter"]};

export const SONG_LIST: SongItem[] = [
  { id: "s1", title: "告白氣球", artist: "周杰倫", category: "華語流行", lyric: "塞納河畔 左岸的咖啡", options: [] },
  { id: "s2", title: "晴天", artist: "周杰倫", category: "華語流行", lyric: "故事的小黃花 從出生那年就飄著", options: [] },
  { id: "s3", title: "七里香", artist: "周杰倫", category: "華語流行", lyric: "窗外的麻雀 在電線桿上多嘴", options: [] },
  { id: "s4", title: "稻香", artist: "周杰倫", category: "華語流行", lyric: "還記得你說家是唯一的城堡", options: [] },
  { id: "s5", title: "青花瓷", artist: "周杰倫", category: "華語流行", lyric: "素胚勾勒出青花筆鋒濃轉淡", options: [] },
  { id: "s6", title: "夜曲", artist: "周杰倫", category: "華語流行", lyric: "一群嗜血的螞蟻 被腐肉所吸引", options: [] },
  { id: "s7", title: "小幸運", artist: "田馥甄", category: "電影主題曲", lyric: "原來你是我最想留住的幸運", options: [] },
  { id: "s8", title: "後來", artist: "劉若英", category: "華語經典", lyric: "後來 我總算學會了如何去愛", options: [] },
  { id: "s9", title: "愛你", artist: "王心凌", category: "甜蜜經典", lyric: "如果你突然打了個噴嚏 那一定就是我在想你", options: [] },
  { id: "s10", title: "光年之外", artist: "鄧紫棋", category: "電影主題曲", lyric: "緣份讓我們相遇亂世以外", options: [] },
  { id: "s11", title: "泡沫", artist: "鄧紫棋", category: "華語流行", lyric: "美麗的泡沫 雖然一剎花火", options: [] },
  { id: "s12", title: "孤勇者", artist: "陳奕迅", category: "影視金曲", lyric: "愛你孤身走暗巷 愛你不跪的模樣", options: [] },
  { id: "s13", title: "十年", artist: "陳奕迅", category: "華語經典", lyric: "如果那兩個字沒有顫抖 我不會發現我難受", options: [] },
  { id: "s14", title: "倔強", artist: "五月天", category: "樂團搖滾", lyric: "當我和世界不一樣 那就讓我不一樣", options: [] },
  { id: "s15", title: "知足", artist: "五月天", category: "樂團搖滾", lyric: "怎麼去擁有一道彩虹 怎麼去擁抱一夏天的風", options: [] },
  { id: "s16", title: "突然好想你", artist: "五月天", category: "樂團搖滾", lyric: "突然好想你 你會在哪裡 過得快樂或委屈", options: [] },
  { id: "s17", title: "溫柔", artist: "五月天", category: "樂團搖滾", lyric: "走在風中 今天陽光 突然好溫柔", options: [] },
  { id: "s18", title: "那些年", artist: "胡夏", category: "電影主題曲", lyric: "又回到最初的起點 呆呆地站在鏡子前", options: [] },
  { id: "s19", title: "修煉愛情", artist: "林俊傑", category: "華語流行", lyric: "修煉愛情的悲歡 我們這些努力不簡單", options: [] },
  { id: "s20", title: "江南", artist: "林俊傑", category: "華語流行", lyric: "風到這裡就是黏 黏住過客的思念", options: [] },
  { id: "s21", title: "小情歌", artist: "蘇打綠", category: "樂團搖滾", lyric: "這是一首簡單的小情歌 唱著人們心腸的曲折", options: [] },
  { id: "s22", title: "月亮代表我的心", artist: "鄧麗君", category: "華語經典", lyric: "你問我愛你有多深 我愛你有幾分", options: [] },
  { id: "s23", title: "童話", artist: "光良", category: "華語經典", lyric: "你哭著對我說 童話裡都是騙人的", options: [] },
  { id: "s24", title: "演員", artist: "薛之謙", category: "華語流行", lyric: "簡單點 說話的方式簡單點", options: [] },
  { id: "s25", title: "海闊天空", artist: "Beyond", category: "樂團搖滾", lyric: "今天我 寒夜裡看雪飄過", options: [] },
  { id: "s26", title: "野狼disco", artist: "寶石Gem", category: "洗腦神曲", lyric: "心裡的花 我想要帶你回家", options: [] },
  { id: "s27", title: "學貓叫", artist: "小潘潘、小峰峰", category: "洗腦神曲", lyric: "我們一起學貓叫 一起喵喵喵喵喵", options: [] },
  { id: "s28", title: "小蘋果", artist: "筷子兄弟", category: "洗腦神曲", lyric: "你是我的小呀小蘋果", options: [] },
  { id: "s29", title: "Lemon", artist: "米津玄師", category: "日語流行", lyric: "夢ならばどれほどよかったでしょう", options: [] },
  { id: "s30", title: "紅蓮華", artist: "LiSA", category: "日語流行", lyric: "強くなれる理由を知った", options: [] },
  { id: "s31", title: "Shape of You", artist: "Ed Sheeran", category: "西洋流行", lyric: "The club isn't the best place to find a lover", options: [] },
  { id: "s32", title: "Let It Go", artist: "Idina Menzel", category: "西洋流行", lyric: "Let it go, let it go, can't hold it back anymore", options: [] },
  { id: "s33", title: "Someone Like You", artist: "Adele", category: "西洋流行", lyric: "Never mind, I'll find someone like you", options: [] },
  { id: "s34", title: "Dynamite", artist: "BTS", category: "西洋流行", lyric: "'Cause I, I, I'm in the stars tonight", options: [] },
];

/** Correct title + 3 wrong titles (same category first), shuffled. */
export function songOptions(song: SongItem, rand: () => number = Math.random): string[] {
  const shuffle = <T,>(items: T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const sameCat = SONG_LIST.filter((s) => s.category === song.category && s.title !== song.title).map((s) => s.title);
  const extra = (EXTRA_TITLES[song.category] ?? []).filter((t) => t !== song.title);
  const others = SONG_LIST.filter((s) => s.category !== song.category).map((s) => s.title);
  const wrong = Array.from(new Set([...shuffle(sameCat), ...shuffle(extra), ...shuffle(others)])).slice(0, 3);
  return shuffle([song.title, ...wrong]);
}

function withOptions(song: SongItem): SongItem {
  return { ...song, options: songOptions(song) };
}

function shuffledSongIds(exclude: string[] = []): string[] {
  const fresh = SONG_LIST.filter((s) => !exclude.includes(s.id)).map((s) => s.id);
  const pool = fresh.length >= 5 ? fresh : SONG_LIST.map((s) => s.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export type SongPhase = "listen" | "answering" | "reveal" | "result";

export interface SongGameState {
  phase: SongPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  currentSong: SongItem;
  /** Shuffled song ids for this match, so every game plays a different set. */
  songOrder?: string[];
  usedPromptIds?: string[];
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

function getSong(order: string[] | undefined, roundIndex: number): SongItem {
  const ids = order && order.length ? order : SONG_LIST.map((s) => s.id);
  const id = ids[(roundIndex - 1) % ids.length];
  return withOptions(SONG_LIST.find((s) => s.id === id) ?? SONG_LIST[(roundIndex - 1) % SONG_LIST.length]);
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
    const songOrder = shuffledSongIds(room.contentHistory?.[SONG_GAME_ID] ?? []);
    const song = getSong(songOrder, 1);
    return {
      songOrder,
      usedPromptIds: [song.id],
      phase: "listen",
      currentRound: 1,
      totalRounds: Math.min(room.settings?.rounds ?? 10, SONG_LIST.length),
      timeLeft: 3, // 3 seconds "listen / countdown"
      currentSong: song,
      lyricRevealed: initialLyricRevealed(song, room.settings?.difficulty ?? "easy"),
      playerAnswers: {},
      answerTimes: {},
      roundStartTime: serverNow() + 3000,
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

    const now = serverNow();
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
          roundStartTime: serverNow(),
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
          const song = getSong(state.songOrder, nextRound);
          return {
            ...state,
            phase: "listen",
            currentRound: nextRound,
            timeLeft: 3,
            currentSong: song,
            usedPromptIds: [...(state.usedPromptIds ?? []), song.id],
            lyricRevealed: initialLyricRevealed(song, room.settings?.difficulty ?? "easy"),
            playerAnswers: {},
            answerTimes: {},
            roundStartTime: serverNow() + 3000,
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
