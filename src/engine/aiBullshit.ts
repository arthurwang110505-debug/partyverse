import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const AIBULLSHIT_GAME_ID = "aibullshit";

export interface TriviaPrompt {
  id: string;
  question: string;
  realAnswer: string;
}

export const TRIVIA_PROMPTS: TriviaPrompt[] = [
  { id: "t1", question: "中古歐洲人曾經相信把什麼放在枕頭下能治療頭痛？", realAnswer: "未洗過的綿羊毛" },
  { id: "t2", question: "在古代羅馬，人們曾經拿什麼來漱口美白牙齒？", realAnswer: "葡萄牙進口的尿液" },
  { id: "t3", question: "在 18 世紀的英國，菠蘿（鳳梨）的主要用途是什麼？", realAnswer: "租來當作身分地位的配件展示" },
  { id: "t4", question: "長頸鹿清理自己耳朵的方法是什麼？", realAnswer: "用自己 45 公分長的反芻舌頭舔" },
  { id: "t5", question: "古埃及人在心愛的貓咪過世時，全家會做什麼哀悼舉動？", realAnswer: "剃掉全家人的眉毛" },
  { id: "t6", question: "企鵝求婚時，會送給心儀對象什麼定情禮物？", realAnswer: "一顆精挑細選的光滑鵝卵石" },
  { id: "t7", question: "北韓在 2012 年官方媒體宣稱考古學家發現了什麼神話生物的巢穴？", realAnswer: "獨角獸" },
  { id: "t8", question: "早期製造保齡球的主要天然原料是什麼？", realAnswer: "癒創木（重鐵木）" },
  { id: "t9", question: "在瑞士，法律規定只單獨飼養一隻什麼動物屬於虐待違法行為？", realAnswer: "天竺鼠" },
  { id: "t10", question: "澳洲在 1932 年曾出動正規皇家砲兵部隊圍剿攻打什麼動物？", realAnswer: "鴯鶓（澳洲鴕鳥）" },
  { id: "t11", question: "在 1830 年代的美國，番茄醬最初是被當作什麼藥品販賣？", realAnswer: "治療消化不良與腹瀉藥" },
  { id: "t12", question: "劍橋大學發明世界上第一台網路即時攝影機，是為了監視什麼？", realAnswer: "茶水間的咖啡壺是否空了" },
  { id: "t13", question: "章魚在極度無聊或壓力過大時會做出的奇異行為是什麼？", realAnswer: "自己吃掉自己的一隻觸手" },
  { id: "t14", question: "早期英國水手用來預測暴風雨的風暴瓶裡，裝了哪種活體生物？", realAnswer: "醫用水蛭" },
  { id: "t15", question: "在 17 世紀荷蘭鬱金香狂熱時，最珍貴的一顆球莖價值相當於什麼？", realAnswer: "阿姆斯特丹的一座豪宅運河房" },
  { id: "t16", question: "太空人登上月球時，阿波羅 14 號太空人在月球表面進行了什麼運動？", realAnswer: "揮桿打高爾夫球" },
  { id: "t17", question: "蜂蜜為何幾乎永不腐敗？考古學家曾在哪裡挖出仍可食用的蜂蜜？", realAnswer: "3000 年前的古埃及墓穴" },
  { id: "t18", question: "香蕉從植物學角度來說，其實屬於哪一類食物？", realAnswer: "漿果（草莓反而不是）" },
  { id: "t19", question: "澳洲曾為阻止哪种動物入侵而修建了超過 3000 公里的圍牆？", realAnswer: "袋鼠" },
  { id: "t20", question: "拿破崙身高其實約 170cm，但同時代的人為何覺得他很矮？", realAnswer: "法國與英國的長度單位不同" },
  { id: "t21", question: "熱帶氣旋「颶風」與「颱風」到底是什麼關係？", realAnswer: "同一種風暴，僅因海域不同而叫法不同" },
  { id: "t22", question: "鯨魚其實是用哪部分器官來「聽」聲音的？", realAnswer: "下顎骨骼傳導" },
  { id: "t23", question: "古代中國人發明指南針，最早是用來做什麼的？", realAnswer: "看風水與占卜" },
  { id: "t24", question: "目前已知最古老的「遊戲機」考古發現，是用什麼材料做的？", realAnswer: "羅馬石膏棋盤（約西元 300 年）" },
];

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
  /** playerId -> fake answer submitted */
  submissions: Record<string, string>;
  options: AnswerOption[];
  /** voterPlayerId -> chosen option id */
  votes: Record<string, string>;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface SubmitBluffAction {
  type: "submitBluff";
  text: string;
}

export interface VoteAnswerAction {
  type: "voteAnswer";
  optionId: string;
}

export type AIBullshitAction = SubmitBluffAction | VoteAnswerAction;

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

function buildOptions(submissions: Record<string, string>, prompt: TriviaPrompt): AnswerOption[] {
  const options: AnswerOption[] = [
    {
      id: "real",
      text: prompt.realAnswer,
      authorPlayerId: null,
      isReal: true,
    },
  ];

  for (const [playerId, text] of Object.entries(submissions)) {
    if (typeof text === "string" && text.trim()) {
      options.push({
        id: `fake_${playerId}`,
        text: text.trim(),
        authorPlayerId: playerId,
        isReal: false,
      });
    }
  }

  return shuffle(options);
}

export const AIBullshitEngine: GameEngine<AIBullshitGameState> = {
  createGame(room) {
    const prompt = getRandomPrompt();
    return {
      phase: "submitting",
      currentRound: 1,
      totalRounds: room.settings?.rounds ?? 3,
      timeLeft: Math.max(20, room.settings?.timer ?? 25),
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
      const act = action as SubmitBluffAction;
      if (act?.type !== "submitBluff" || typeof act.text !== "string") return state;

      const submissions = { ...state.submissions, [playerId]: act.text.trim().slice(0, 30) };
      const onlineIds = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
      const allSubmitted = onlineIds.every((id) => Boolean(submissions[id]));

      if (allSubmitted) {
        const options = buildOptions(submissions, state.prompt);
        return {
          ...state,
          submissions,
          options,
          votes: {},
          phase: "voting",
          timeLeft: Math.max(15, room.settings?.timer ?? 20),
        };
      }

      return { ...state, submissions };
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
      if (nextTime <= 0) {
        const options = buildOptions(state.submissions, state.prompt);
        return {
          ...state,
          options,
          votes: {},
          phase: "voting",
          timeLeft: Math.max(15, room.settings?.timer ?? 20),
        };
      }
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
          const nextPrompt = getRandomPrompt([state.prompt.id]);
          return {
            ...state,
            phase: "submitting",
            currentRound: state.currentRound + 1,
            timeLeft: Math.max(20, room.settings?.timer ?? 25),
            prompt: nextPrompt,
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
