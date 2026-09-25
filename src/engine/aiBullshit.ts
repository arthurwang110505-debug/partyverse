import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const AIBULLSHIT_GAME_ID = "aibullshit";

export interface TriviaPrompt {
  id: string;
  question: string;
  realAnswer: string;
  /** Built-in "AI" bluffs that pad the ballot when only a few people wrote one. */
  decoys?: string[];
}

export const TRIVIA_PROMPTS: TriviaPrompt[] = [
  { id: "t1", question: "中古歐洲人曾經相信把什麼放在枕頭下能治療頭痛？", realAnswer: "未洗過的綿羊毛", decoys: ["一把生鏽的鑰匙", "烤過的洋蔥片"] },
  { id: "t2", question: "在古代羅馬，人們曾經拿什麼來漱口美白牙齒？", realAnswer: "進口的人類尿液", decoys: ["磨碎的珍珠粉", "燒焦的橄欖核"] },
  { id: "t3", question: "在 18 世紀的英國，鳳梨的主要用途是什麼？", realAnswer: "租來當作身分地位的派對擺飾", decoys: ["當作貴族的枕頭香氛", "做成高級靴子的鞋墊"] },
  { id: "t4", question: "長頸鹿清理自己耳朵的方法是什麼？", realAnswer: "用將近半公尺長的舌頭舔", decoys: ["請啄木鳥幫忙啄", "倒立讓耳垢自己掉出來"] },
  { id: "t5", question: "古埃及人在家中貓咪過世時，全家會做什麼哀悼？", realAnswer: "剃掉自己的眉毛", decoys: ["一整週不准吃魚", "把家門漆成黑色"] },
  { id: "t6", question: "巴布亞企鵝求偶時，會送給心儀對象什麼禮物？", realAnswer: "一顆精挑細選的光滑石頭", decoys: ["一根最長的羽毛", "一條還在跳的小魚"] },
  { id: "t7", question: "北韓官方媒體在 2012 年宣稱考古學家發現了什麼的巢穴？", realAnswer: "獨角獸", decoys: ["九尾狐", "金色神龜"] },
  { id: "t8", question: "早期保齡球主要是用什麼材料做的？", realAnswer: "非常堅硬的癒創木", decoys: ["曬乾的牛骨", "壓縮的火山灰"] },
  { id: "t9", question: "在瑞士，只單獨飼養一隻哪種動物會違法？", realAnswer: "天竺鼠", decoys: ["金魚", "鸚鵡"] },
  { id: "t10", question: "澳洲在 1932 年曾出動軍隊帶機槍攻打什麼動物？", realAnswer: "鴯鶓", decoys: ["袋鼠", "野兔"] },
  { id: "t11", question: "1830 年代的美國，番茄醬曾被當作什麼販賣？", realAnswer: "治療消化不良的藥丸", decoys: ["男士髮油", "皮鞋亮光劑"] },
  { id: "t12", question: "劍橋大學架設史上第一台網路攝影機，是為了監看什麼？", realAnswer: "茶水間的咖啡壺空了沒", decoys: ["實驗室的倉鼠", "教授有沒有在辦公室"] },
  { id: "t13", question: "蜂蜜幾乎不會壞，考古學家曾在哪裡找到還能吃的蜂蜜？", realAnswer: "數千年前的古埃及墓穴", decoys: ["沉船裡的木桶", "冰島的火山洞"] },
  { id: "t14", question: "從植物學來看，下列哪個其實是「漿果」？", realAnswer: "香蕉", decoys: ["草莓", "覆盆子"] },
  { id: "t15", question: "澳洲修建了超過 5000 公里的圍籬，是為了擋住什麼動物？", realAnswer: "澳洲野犬（丁格犬）", decoys: ["袋鼠", "無尾熊"] },
  { id: "t16", question: "阿波羅 14 號的太空人在月球表面做了什麼運動？", realAnswer: "打高爾夫球", decoys: ["踢足球", "跳繩"] },
  { id: "t17", question: "鯨魚主要靠哪個部位「聽」聲音？", realAnswer: "下顎骨傳導", decoys: ["背上的噴氣孔", "尾鰭上的神經"] },
  { id: "t18", question: "中國人發明的指南針，最早是用來做什麼的？", realAnswer: "看風水與占卜", decoys: ["航海找方向", "決定皇帝吃什麼"] },
  { id: "t19", question: "章魚一共有幾顆心臟？", realAnswer: "三顆", decoys: ["八顆，每隻腳一顆", "一顆但有兩個心室"] },
  { id: "t20", question: "樹懶一週大約只會做幾次這件事：爬下樹上廁所？", realAnswer: "大約一次", decoys: ["每天三次", "一個月一次"] },
  { id: "t21", question: "牛有「好朋友」嗎？研究發現牛和好朋友分開時會怎樣？", realAnswer: "壓力變大、心跳加快", decoys: ["產出的牛奶變甜", "會開始大聲唱歌"] },
  { id: "t22", question: "法國國王路易十四一生大約洗過幾次澡？", realAnswer: "據說只有兩三次", decoys: ["每天洗五次", "只在生日洗"] },
  { id: "t23", question: "1904 年奧運馬拉松的冠軍，比賽途中做了什麼？", realAnswer: "搭了一段汽車", decoys: ["停下來吃了一頓午餐", "騎了一段馬"] },
  { id: "t24", question: "海獺睡覺時為了不漂走，會做什麼？", realAnswer: "和同伴手牽手", decoys: ["把尾巴綁在石頭上", "輪流站崗叫醒對方"] },
  { id: "t25", question: "蝴蝶是用身體哪個部位「嚐味道」的？", realAnswer: "腳", decoys: ["翅膀", "觸角尖端"] },
  { id: "t26", question: "日本有一座島上住著大量兔子，那座島以前是做什麼的？", realAnswer: "秘密製造毒氣的基地", decoys: ["皇室的度假村", "監獄島"] },
  { id: "t27", question: "蘇格蘭的國家動物是什麼？", realAnswer: "獨角獸", decoys: ["尼斯湖水怪", "紅鹿"] },
  { id: "t28", question: "早期的橡皮擦發明之前，人們用什麼擦掉鉛筆字？", realAnswer: "揉成團的麵包", decoys: ["濕的樹葉", "羊的舌頭"] },
  { id: "t29", question: "袋熊的便便有什麼特別之處？", realAnswer: "是立方體形狀", decoys: ["會在黑暗中發光", "聞起來像薄荷"] },
  { id: "t30", question: "可口可樂最早被發明時，是當作什麼賣的？", realAnswer: "提神補腦的藥水", decoys: ["洗衣精", "驅蚊液"] },
];

/** Keep at least this many choices on the ballot. */
export const MIN_OPTIONS = 4;
/** Max bluffs one player may submit per round. */
export const MAX_BLUFFS_PER_PLAYER = 2;

export type AIBullshitPhase = "submitting" | "voting" | "reveal" | "result";

export interface AnswerOption {
  id: string;
  text: string;
  authorPlayerId: string | null; // null if real answer
  isReal: boolean;
}

export interface AIBullshitGameState {
  phase: AIBullshitPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  prompt: TriviaPrompt;
  /** playerId -> fake answers submitted (older rooms stored a single string) */
  submissions: Record<string, string[] | string>;
  /** Players who pressed "done" (no more bluffs from them this round). */
  doneIds?: Record<string, boolean>;
  options: AnswerOption[];
  /** voterPlayerId -> chosen option id */
  votes: Record<string, string>;
  currentScores: Record<string, number>;
  winnerId: string | null;
  usedPromptIds?: string[];
}

export interface SubmitBluffAction {
  type: "submitBluff";
  text: string;
}

export interface FinishBluffAction {
  type: "finishBluffs";
}

export interface VoteAnswerAction {
  type: "voteAnswer";
  optionId: string;
}

export type AIBullshitAction = SubmitBluffAction | FinishBluffAction | VoteAnswerAction;

/** Normalise one player's bluffs to a clean list. */
export function bluffsOf(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (value && typeof value === "object") return bluffsOf(Object.values(value));
  return [];
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getRandomPrompt(excludeIds: string[] = []): TriviaPrompt {
  const pool = TRIVIA_PROMPTS.filter((p) => !excludeIds.includes(p.id));
  const available = pool.length > 0 ? pool : TRIVIA_PROMPTS;
  return available[Math.floor(Math.random() * available.length)];
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function buildOptions(submissions: Record<string, unknown>, prompt: TriviaPrompt): AnswerOption[] {
  const options: AnswerOption[] = [{ id: "real", text: prompt.realAnswer, authorPlayerId: null, isReal: true }];
  const seen = new Set([prompt.realAnswer.trim()]);
  for (const [playerId, value] of Object.entries(submissions)) {
    bluffsOf(value).forEach((text, i) => {
      const clean = text.trim();
      if (seen.has(clean)) return; // identical text would reveal itself
      seen.add(clean);
      options.push({ id: `fake_${playerId}_${i}`, text: clean, authorPlayerId: playerId, isReal: false });
    });
  }
  // Pad with built-in AI bluffs so there's always something to choose from.
  for (const [i, text] of (prompt.decoys ?? []).entries()) {
    if (options.length >= MIN_OPTIONS + 1) break;
    if (seen.has(text)) continue;
    seen.add(text);
    options.push({ id: `ai_${i}`, text, authorPlayerId: null, isReal: false });
  }
  return shuffle(options);
}

function toVoting(state: AIBullshitGameState, room: Room<AIBullshitGameState>, submissions = state.submissions) {
  return {
    ...state,
    submissions,
    options: buildOptions(submissions, state.prompt),
    votes: {},
    phase: "voting" as const,
    timeLeft: Math.max(20, room.settings?.timer ? Math.round(room.settings.timer / 2) : 25),
  };
}

function bluffTime(room: Room<AIBullshitGameState>): number {
  return Math.max(45, room.settings?.timer ?? 60);
}

export const AIBullshitEngine: GameEngine<AIBullshitGameState> = {
  createGame(room) {
    const prompt = getRandomPrompt(room.contentHistory?.[AIBULLSHIT_GAME_ID] ?? []);
    return {
      phase: "submitting",
      currentRound: 1,
      totalRounds: room.settings?.rounds ?? 3,
      timeLeft: bluffTime(room),
      doneIds: {},
      usedPromptIds: [prompt.id],
      prompt,
      submissions: {},
      options: [],
      votes: {},
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

    if (state.phase === "submitting") {
      const act = action as SubmitBluffAction | FinishBluffAction;
      const doneIds = { ...(state.doneIds ?? {}) };
      let submissions = state.submissions;
      if (act?.type === "submitBluff" && typeof act.text === "string" && act.text.trim()) {
        const mine = bluffsOf(state.submissions[playerId]);
        if (mine.length >= MAX_BLUFFS_PER_PLAYER || doneIds[playerId]) return state;
        submissions = { ...state.submissions, [playerId]: [...mine, act.text.trim().slice(0, 30)] };
        if (mine.length + 1 >= MAX_BLUFFS_PER_PLAYER) doneIds[playerId] = true;
      } else if (act?.type === "finishBluffs") {
        if (bluffsOf(state.submissions[playerId]).length === 0) return state;
        doneIds[playerId] = true;
      } else {
        return state;
      }
      // Only move on early when every connected player has said they're done.
      const onlineIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      if (onlineIds.length > 0 && onlineIds.every((id) => doneIds[id])) {
        return toVoting({ ...state, doneIds }, room, submissions);
      }
      return { ...state, submissions, doneIds };
    }

    if (state.phase === "voting") {
      const act = action as VoteAnswerAction;
      if (act?.type !== "voteAnswer" || typeof act.optionId !== "string") return state;

      // You cannot vote for your own fake answer
      const chosen = state.options.find((o) => o.id === act.optionId);
      if (!chosen || chosen.authorPlayerId === playerId) return state;

      const votes = { ...state.votes, [playerId]: act.optionId };
      const onlineIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      const allVoted = onlineIds.every((id) => Boolean(votes[id]));

      if (allVoted) {
        return tallyAndReveal({ ...state, votes });
      }

      return { ...state, votes };
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "submitting") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) return toVoting(state, room);
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "voting") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return tallyAndReveal(state);
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
          const used = Array.from(new Set([...(state.usedPromptIds ?? []), state.prompt.id]));
          const nextPrompt = getRandomPrompt([...(room.contentHistory?.[AIBULLSHIT_GAME_ID] ?? []), ...used]);
          return {
            ...state,
            phase: "submitting",
            currentRound: state.currentRound + 1,
            timeLeft: bluffTime(room),
            prompt: nextPrompt,
            usedPromptIds: [...used, nextPrompt.id],
            doneIds: {},
            submissions: {},
            options: [],
            votes: {},
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
        id: "bullshit_king",
        name: "瞎扯大宗師",
        icon: "🤖",
        description: "憑藉無懈可擊的鬼扯騙過眾人並奪冠",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function tallyAndReveal(state: AIBullshitGameState): AIBullshitGameState {
  const scores = { ...state.currentScores };

  // Scoring rules:
  // - Guessing real answer: +10 pts
  // - Fooled someone with your fake answer: +5 pts per dupe
  for (const [voterId, optionId] of Object.entries(state.votes)) {
    const option = state.options.find((o) => o.id === optionId);
    if (!option) continue;

    if (option.isReal) {
      scores[voterId] = (scores[voterId] ?? 0) + 10;
    } else if (option.authorPlayerId && option.authorPlayerId !== voterId) {
      scores[option.authorPlayerId] = (scores[option.authorPlayerId] ?? 0) + 5;
    }
  }

  return {
    ...state,
    phase: "reveal",
    timeLeft: 8,
    currentScores: scores,
  };
}
