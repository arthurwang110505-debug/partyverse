import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const CHRISTMAS_GAME_ID = "christmasgift";

export type GiftKind = "gold" | "gift" | "cookie" | "bell" | "coal";

export interface GiftBox {
  id: string;
  title: string;
  icon: string;
  color: string;
  kind: GiftKind;
  points: number;
}

export type RoundTwistId = "normal" | "double_gold" | "santa_bonus" | "coal_shield";

export interface RoundTwist {
  id: RoundTwistId;
  title: string;
  description: string;
  icon: string;
}

export interface ChristmasGiftState {
  phase: "picking" | "reveal" | "result";
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  twist: RoundTwist;
  boxes: GiftBox[];
  picks: Record<string, string>;
  roundDeltas: Record<string, number>;
  soloWins: Record<string, number>;
  coalHits: Record<string, number>;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface PickBoxAction {
  type: "pickBox";
  boxId: string;
}

const BOX_WRAPPERS = [
  { id: "box_red", title: "紅絲帶禮盒", icon: "🎁", color: "#ef4444" },
  { id: "box_green", title: "松綠閃耀盒", icon: "🎄", color: "#10b981" },
  { id: "box_gold", title: "金星派對盒", icon: "🌟", color: "#facc15" },
  { id: "box_snow", title: "雪花冰晶盒", icon: "❄️", color: "#38bdf8" },
  { id: "box_sock", title: "神秘聖誕襪", icon: "🧦", color: "#f97316" },
];

const TWISTS: RoundTwist[] = [
  {
    id: "normal",
    icon: "🎅",
    title: "經典拆禮",
    description: "獨自挑中禮物全額獨吞；多人撞盒平分分數，煤炭則全員扣分！",
  },
  {
    id: "double_gold",
    icon: "✨",
    title: "聖誕奇蹟 ×2",
    description: "本回合的最大黃金禮物分數直接翻倍！小心大家全都衝這盒！",
  },
  {
    id: "santa_bonus",
    icon: "🧧",
    title: "聖誕老人紅包",
    description: "只要你是該正分禮盒的唯一挑選者，額外獲得 +10 分獨佔紅包！",
  },
  {
    id: "coal_shield",
    icon: "🛡️",
    title: "平安夜庇佑",
    description: "本回合煤炭扣分減半；若全場無人踩中煤炭，全員 +5 分！",
  },
];

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(round: number, rand: () => number = Math.random): { twist: RoundTwist; boxes: GiftBox[] } {
  const twist = round === 1 ? TWISTS[0] : TWISTS[Math.floor(rand() * TWISTS.length)] ?? TWISTS[0];
  const rewards: Array<{ kind: GiftKind; points: number }> = shuffle(
    [
      { kind: "gold", points: twist.id === "double_gold" ? 60 : 30 },
      { kind: "gift", points: 20 },
      { kind: "cookie", points: 15 },
      { kind: "bell", points: 10 },
      { kind: "coal", points: twist.id === "coal_shield" ? -5 : -15 },
    ],
    rand,
  );
  const wrappers = shuffle(BOX_WRAPPERS, rand);
  const boxes: GiftBox[] = wrappers.map((w, idx) => ({
    ...w,
    kind: rewards[idx].kind,
    points: rewards[idx].points,
  }));
  return { twist, boxes };
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

function pickDuration(room: Room<ChristmasGiftState>): number {
  return Math.max(8, Math.min(30, room.settings?.timer ?? 12));
}

function resolveRound(state: ChristmasGiftState, room: Room<ChristmasGiftState>): ChristmasGiftState {
  const scores = { ...state.currentScores };
  const soloWins = { ...state.soloWins };
  const coalHits = { ...state.coalHits };
  const roundDeltas: Record<string, number> = {};
  for (const id of Object.keys(room.players)) roundDeltas[id] = 0;

  const boxPickers: Record<string, string[]> = {};
  for (const box of state.boxes) boxPickers[box.id] = [];
  for (const [playerId, boxId] of Object.entries(state.picks)) {
    if (boxPickers[boxId]) boxPickers[boxId].push(playerId);
  }

  let anyoneHitCoal = false;

  for (const box of state.boxes) {
    const pickers = boxPickers[box.id] ?? [];
    if (pickers.length === 0) continue;

    if (box.kind === "coal") {
      anyoneHitCoal = true;
      for (const id of pickers) {
        roundDeltas[id] = (roundDeltas[id] ?? 0) + box.points;
        coalHits[id] = (coalHits[id] ?? 0) + 1;
      }
    } else {
      const share = Math.max(1, Math.round(box.points / pickers.length));
      const soloBonus = pickers.length === 1 && state.twist.id === "santa_bonus" ? 10 : 0;
      for (const id of pickers) {
        roundDeltas[id] = (roundDeltas[id] ?? 0) + share + soloBonus;
        if (pickers.length === 1) {
          soloWins[id] = (soloWins[id] ?? 0) + 1;
        }
      }
    }
  }

  if (state.twist.id === "coal_shield" && !anyoneHitCoal) {
    for (const id of Object.keys(room.players)) {
      roundDeltas[id] = (roundDeltas[id] ?? 0) + 5;
    }
  }

  for (const id of Object.keys(room.players)) {
    scores[id] = Math.max(0, (scores[id] ?? 0) + (roundDeltas[id] ?? 0));
  }

  return {
    ...state,
    phase: "reveal",
    timeLeft: 7,
    roundDeltas,
    soloWins,
    coalHits,
    currentScores: scores,
  };
}

export const ChristmasGiftEngine: GameEngine<ChristmasGiftState> = {
  createGame(room) {
    const totalRounds = Math.max(1, Math.min(8, room.settings?.rounds ?? 4));
    const { twist, boxes } = buildRound(1);
    return {
      phase: "picking",
      currentRound: 1,
      totalRounds,
      timeLeft: pickDuration(room),
      twist,
      boxes,
      picks: {},
      roundDeltas: {},
      soloWins: initialScores(room.players),
      coalHits: initialScores(room.players),
      currentScores: initialScores(room.players),
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "picking") return state;
    const act = action as PickBoxAction;
    if (act?.type !== "pickBox" || typeof act.boxId !== "string") return state;
    if (!state.boxes.some((b) => b.id === act.boxId)) return state;

    const picks = { ...state.picks, [playerId]: act.boxId };
    const nextState: ChristmasGiftState = { ...state, picks };
    const connected = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
    if (connected.length > 0 && connected.every((id) => Boolean(picks[id]))) {
      return resolveRound(nextState, room);
    }
    return nextState;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state || state.phase === "result") return state;

    const nextTime = state.timeLeft - 1;
    if (nextTime > 0) return { ...state, timeLeft: nextTime };

    if (state.phase === "picking") {
      return resolveRound(state, room);
    }

    if (state.phase === "reveal") {
      if (state.currentRound >= state.totalRounds) {
        const entries = Object.entries(state.currentScores).sort((a, b) => b[1] - a[1]);
        return {
          ...state,
          phase: "result",
          timeLeft: 0,
          winnerId: entries[0]?.[0] ?? null,
        };
      }
      const nextRound = state.currentRound + 1;
      const { twist, boxes } = buildRound(nextRound);
      return {
        ...state,
        phase: "picking",
        currentRound: nextRound,
        timeLeft: pickDuration(room),
        twist,
        boxes,
        picks: {},
        roundDeltas: {},
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
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerId = state?.winnerId ?? entries[0]?.[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "santa_mvp",
        name: "聖誕星之子",
        icon: "🌟",
        description: "累積最多聖誕禮物分數，榮登派對焦點",
        playerId: winnerId,
      });
    }
    const topSolo = Object.entries(state?.soloWins ?? {}).sort((a, b) => b[1] - a[1])[0];
    if (topSolo && topSolo[1] > 0) {
      achievements.push({
        id: "solo_unboxer",
        name: "獨吞王",
        icon: "🎁",
        description: `成功獨佔禮物 ${topSolo[1]} 次，精準避開撞盒`,
        playerId: topSolo[0],
      });
    }
    const topCoal = Object.entries(state?.coalHits ?? {}).sort((a, b) => b[1] - a[1])[0];
    if (topCoal && topCoal[1] > 0) {
      achievements.push({
        id: "coal_magnet",
        name: "煤炭收集家",
        icon: "🧦",
        description: `踩中煤炭 ${topCoal[1]} 次，聖誕老人記住你了`,
        playerId: topCoal[0],
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
