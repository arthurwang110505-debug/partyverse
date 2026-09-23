import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { freshSeed, mulberry32, seededShuffle } from "./rng";
import { topScorers } from "./scoring";

export const POKER_GAME_ID = "pokerlite";

export type PokerPhase = "dealing" | "betting" | "showdown" | "result";
export type PokerStreet = "preflop" | "flop" | "turn" | "river";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const SUITS = ["♥", "♦", "♣", "♠"] as const;
const RANK_VALUE: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

export function cardValue(card: string): number {
  const rank = card.length === 3 ? card.slice(0, 2) : card[0];
  return RANK_VALUE[rank] ?? 0;
}
export function cardSuit(card: string): string {
  return card[card.length - 1];
}
function buildDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}

/* ------------------------------ hand ranking ----------------------------- */

const COMBOS: number[][] = (() => {
  const combos: number[][] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 7; e++) combos.push([a, b, c, d, e]);
  return combos;
})();

/** [category, k1..k4] — lower category is stronger; kickers: higher is stronger. */
export type HandRank = [number, number, number, number, number, number];

/** Negative result => `a` beats `b`. */
export function compareRank(a: HandRank, b: HandRank): number {
  const cat = (a[0] ?? 0) - (b[0] ?? 0);
  if (cat !== 0) return cat;
  for (let i = 1; i < 6; i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function rank5(cards: string[]): HandRank {
  const vals = cards.map(cardValue).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(vals)];
  // A wheel is exactly A-5-4-3-2: ace-high alone is not enough.
  const isWheel =
    uniq.length === 5 && uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2;
  const isStraight = uniq.length === 5 && (uniq[0] - uniq[4] === 4 || isWheel);
  const straightHigh = isStraight ? (isWheel ? 5 : uniq[0]) : 0;
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pattern = groups.map((g) => g[1]).join("");
  if (isFlush && isStraight) return [0, straightHigh, 0, 0, 0, 0];
  if (pattern === "41") return [1, groups[0][0], groups[1][0], 0, 0, 0];
  if (pattern === "32") return [2, groups[0][0], groups[1][0], 0, 0, 0];
  if (isFlush) return [3, vals[0], vals[1], vals[2], vals[3], vals[4]];
  if (isStraight) return [4, straightHigh, 0, 0, 0, 0];
  if (pattern === "311") return [5, groups[0][0], groups[1][0], groups[2][0], 0, 0];
  if (pattern === "221") return [6, groups[0][0], groups[1][0], groups[2][0], 0, 0];
  if (pattern === "2111") return [7, groups[0][0], groups[1][0], groups[2][0], groups[3][0], 0];
  return [8, vals[0], vals[1], vals[2], vals[3], vals[4]];
}

export function bestOf7(cards: string[]): HandRank {
  let best: HandRank | null = null;
  for (const combo of COMBOS) {
    const five = combo.map((i) => cards[i]);
    const r = rank5(five);
    if (!best || compareRank(r, best) < 0) best = r;
  }
  return best!;
}

const HAND_NAMES = ["同花順", "四條", "葫蘆", "同花", "順子", "三條", "兩對", "一對", "高牌"];
export function handName(r: HandRank): string {
  return HAND_NAMES[r[0]] ?? "高牌";
}

/* --------------------------------- state --------------------------------- */

export interface PokerGameState {
  phase: PokerPhase;
  street: PokerStreet;
  timeLeft: number;
  handNumber: number;
  totalHands: number;
  /** Frozen seat order (participants only). */
  seats: string[];
  deck: string[];
  holeCards: Record<string, string[]>;
  board: string[];
  chips: Record<string, number>;
  /** Chips committed over the whole hand — the side-pot basis. */
  committed: Record<string, number>;
  /** Chips committed on the current street. */
  streetCommitted: Record<string, number>;
  toCall: Record<string, number>;
  currentBet: number;
  lastFullRaise?: number;
  actedAtBet?: Record<string, number>;
  actionSeq?: number;
  pot: number;
  activePlayers: string[];
  foldedIds: string[];
  allInIds: string[];
  toAct: string | null;
  lastRaiserId: string | null;
  streetActed: Record<string, boolean>;
  dealerSeat: string;
  showdownHands: Record<string, string>;
  handWinnerIds: string[];
  potSplit: Record<string, number>;
  currentScores: Record<string, number>;
  winnerId: string | null;
  winnerIds: string[];
}

export type PokerAction = { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number };

export const START_CHIPS = 100;
export const REBUY_CHIPS = 50;
export const BIG_BLIND = 2;
const SMALL_BLIND = 1;
const DEALING_SECONDS = 4;
const SHOWDOWN_SECONDS = 4;

function betSeconds(room: Room<PokerGameState>): number {
  return room.settings?.timer ?? 15;
}

export const PokerLiteEngine: GameEngine<PokerGameState> = {
  createGame(room) {
    const seats = Object.keys(room.players);
    const chips: Record<string, number> = {};
    for (const id of seats) chips[id] = START_CHIPS;
    const base: PokerGameState = {
      phase: "dealing",
      street: "preflop",
      timeLeft: DEALING_SECONDS,
      handNumber: 1,
      totalHands: Math.max(1, Math.min(10, room.settings?.rounds ?? 5)),
      seats,
      deck: [],
      holeCards: {},
      board: [],
      chips,
      committed: {},
      streetCommitted: {},
      toCall: {},
      currentBet: 0,
      pot: 0,
      activePlayers: [...seats],
      foldedIds: [],
      allInIds: [],
      toAct: null,
      lastRaiserId: null,
      streetActed: {},
      dealerSeat: seats[0] ?? "",
      showdownHands: {},
      handWinnerIds: [],
      potSplit: {},
      currentScores: { ...chips },
      winnerId: null,
      winnerIds: [],
    };
    return dealHand(base, room);
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "betting" || state.toAct !== playerId) return state;
    const act = action as PokerAction;
    if (!act?.type) return state;

    if (act.type === "fold") return applyFold(state, room, playerId);
    if (act.type === "check") {
      if ((state.toCall[playerId] ?? 0) > 0) return state;
      return advanceStreet(markActed(state, playerId), room, playerId);
    }
    if (act.type === "call") {
      if ((state.toCall[playerId] ?? 0) <= 0) return state;
      return applyCall(state, room, playerId);
    }
    if (act.type === "raise") return applyRaise(state, room, playerId, act.to);
    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "dealing") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      if (!state.toAct) return streetEnd(state, room);
      return { ...state, phase: "betting", timeLeft: betSeconds(room) };
    }

    if (state.phase === "betting") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      if (!state.toAct) return streetEnd(state, room);
      // Never spend a player's chips without input: fold to a bet, check otherwise.
      if ((state.toCall[state.toAct] ?? 0) > 0 && (state.chips[state.toAct] ?? 0) > 0) {
        return applyFold(state, room, state.toAct);
      }
      return advanceStreet(markActed(state, state.toAct), room, state.toAct);
    }

    if (state.phase === "showdown") {
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return nextHand(state, room);
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
        id: "pot_king",
        name: "底鍋之王",
        icon: "🃏",
        description: "籌碼堆到全場最高",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId, winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

/* ------------------------------- the engine ------------------------------ */

function dealHand(state: PokerGameState, _room: Room<PokerGameState>): PokerGameState {
  const seats = state.seats;
  const deck = seededShuffle(buildDeck(), mulberry32(freshSeed()));
  const active = seats.filter((id) => (state.chips[id] ?? 0) > 0);
  const holeCards: Record<string, string[]> = {};
  for (const id of active) holeCards[id] = [deck.pop()!, deck.pop()!];

  const n = active.length;
  const dealerSeat = n > 0 ? active[(state.handNumber - 1) % n] : "";
  const blinds: Record<string, number> = {};
  if (n === 2) {
    const other = active.find((id) => id !== dealerSeat)!;
    blinds[dealerSeat] = SMALL_BLIND;
    blinds[other] = BIG_BLIND; // heads-up: dealer is small blind and acts first preflop
  } else if (n >= 3) {
    const i = active.indexOf(dealerSeat);
    blinds[active[(i + 1) % n]] = SMALL_BLIND;
    blinds[active[(i + 2) % n]] = BIG_BLIND;
  }

  const chips = { ...state.chips };
  const committed: Record<string, number> = {};
  const streetCommitted: Record<string, number> = {};
  const toCall: Record<string, number> = {};
  const streetActed: Record<string, boolean> = {};
  let pot = 0;
  for (const id of seats) {
    committed[id] = 0;
    streetCommitted[id] = 0;
    toCall[id] = 0;
    streetActed[id] = false;
  }
  for (const [id, amount] of Object.entries(blinds)) {
    const pay = Math.min(amount, chips[id] ?? 0);
    chips[id] = (chips[id] ?? 0) - pay;
    committed[id] = pay;
    streetCommitted[id] = pay;
    pot += pay;
  }
  const allInIds = active.filter((id) => chips[id] === 0);
  for (const id of active) toCall[id] = Math.min(chips[id], Math.max(0, BIG_BLIND - streetCommitted[id]));

  // First to act: heads-up the dealer (SB); otherwise the first seat after BB.
  let toAct: string | null = null;
  if (n >= 3) {
    const i = active.indexOf(dealerSeat);
    toAct = active[(i + 3) % n];
  } else if (n === 2) {
    toAct = dealerSeat;
  }
  if (toAct && allInIds.includes(toAct)) {
    const idx = active.indexOf(toAct);
    toAct = null;
    for (let k = 1; k <= n; k++) {
      const id = active[(idx + k) % n];
      if (!allInIds.includes(id)) {
        toAct = id;
        break;
      }
    }
  }

  return {
    ...state,
    phase: "dealing",
    timeLeft: DEALING_SECONDS,
    street: "preflop",
    deck,
    holeCards,
    board: [],
    chips,
    committed,
    streetCommitted,
    toCall,
    currentBet: BIG_BLIND,
    lastFullRaise: BIG_BLIND,
    actedAtBet: {},
    actionSeq: 0,
    pot,
    activePlayers: active,
    foldedIds: [],
    allInIds,
    toAct,
    lastRaiserId: null,
    streetActed,
    dealerSeat,
    showdownHands: {},
    handWinnerIds: [],
    potSplit: {},
  };
}

function payChips(state: PokerGameState, id: string, pay: number): PokerGameState {
  pay = Math.max(0, Math.min(pay, state.chips[id] ?? 0));
  const chips = { ...state.chips, [id]: (state.chips[id] ?? 0) - pay };
  return {
    ...state,
    chips,
    committed: { ...state.committed, [id]: (state.committed[id] ?? 0) + pay },
    streetCommitted: { ...state.streetCommitted, [id]: (state.streetCommitted[id] ?? 0) + pay },
    pot: state.pot + pay,
    allInIds: chips[id] === 0 && !state.allInIds.includes(id) ? [...state.allInIds, id] : state.allInIds,
  };
}

function applyCall(state: PokerGameState, room: Room<PokerGameState>, id: string): PokerGameState {
  const pay = Math.min(state.toCall[id] ?? 0, state.chips[id] ?? 0);
  if (pay <= 0) return state;
  const next = payChips(state, id, pay);
  return advanceStreet(markActed({ ...next, toCall: { ...next.toCall, [id]: 0 } }, id), room, id);
}

/** A short all-in only reopens raising once the accumulated increase is a full raise. */
export function canRaise(state: PokerGameState, id: string): boolean {
  const last = state.actedAtBet?.[id];
  return last === undefined || state.currentBet - last >= (state.lastFullRaise ?? BIG_BLIND);
}

function markActed(state: PokerGameState, id: string): PokerGameState {
  return {
    ...state,
    streetActed: { ...state.streetActed, [id]: true },
    actedAtBet: { ...state.actedAtBet, [id]: state.currentBet },
  };
}

function applyRaise(state: PokerGameState, room: Room<PokerGameState>, id: string, to: number): PokerGameState {
  if (typeof to !== "number" || !Number.isFinite(to) || !canRaise(state, id)) return state;
  const committedNow = state.streetCommitted[id] ?? 0;
  const maxTo = (state.chips[id] ?? 0) + committedNow;
  const newTo = Math.min(Math.round(to), maxTo);
  if (newTo <= state.currentBet) return newTo === maxTo ? applyCall(state, room, id) : state;
  const increase = newTo - state.currentBet;
  const minimum = state.lastFullRaise ?? BIG_BLIND;
  if (increase < minimum && newTo !== maxTo) return state;
  let next = payChips(state, id, newTo - committedNow);
  const toCall: Record<string, number> = {};
  for (const other of next.activePlayers) {
    toCall[other] = Math.max(0, Math.min(newTo - (next.streetCommitted[other] ?? 0), next.chips[other] ?? 0));
  }
  next = markActed(
    {
      ...next,
      currentBet: newTo,
      lastRaiserId: id,
      toCall,
      lastFullRaise: increase >= minimum ? increase : minimum,
    },
    id,
  );
  return advanceStreet(next, room, id);
}

function applyFold(state: PokerGameState, room: Room<PokerGameState>, id: string): PokerGameState {
  const active = state.activePlayers.filter((x) => x !== id);
  if (active.length <= 1) {
    const winner = active[0] ?? null;
    const chips = { ...state.chips };
    if (winner) chips[winner] = (chips[winner] ?? 0) + state.pot;
    return {
      ...state,
      phase: "showdown",
      actionSeq: (state.actionSeq ?? 0) + 1,
      timeLeft: SHOWDOWN_SECONDS,
      chips,
      activePlayers: active,
      foldedIds: [...state.foldedIds, id],
      toAct: null,
      pot: 0,
      handWinnerIds: winner ? [winner] : [],
      potSplit: winner ? { [winner]: state.pot } : {},
      currentScores: { ...chips },
    };
  }
  const next = { ...state, activePlayers: active, foldedIds: [...state.foldedIds, id], toAct: null };
  return advanceStreet(next, room, id);
}

function advanceStreet(state: PokerGameState, room: Room<PokerGameState>, fromId: string): PokerGameState {
  state = { ...state, actionSeq: (state.actionSeq ?? 0) + 1 };
  const next = nextToAct(state, fromId);
  if (next) return { ...state, toAct: next, timeLeft: betSeconds(room) };
  return streetEnd(state, room);
}

function nextToAct(state: PokerGameState, fromId: string): string | null {
  const idx = state.seats.indexOf(fromId);
  for (let i = 1; i <= state.seats.length; i++) {
    const id = state.seats[(idx + i) % state.seats.length];
    if (!state.activePlayers.includes(id)) continue;
    if (state.allInIds.includes(id)) continue;
    if (state.streetActed[id] && (state.toCall[id] ?? 0) === 0) continue;
    return id;
  }
  return null;
}

function streetEnd(state: PokerGameState, room: Room<PokerGameState>): PokerGameState {
  const canAct = state.activePlayers.filter((id) => !state.allInIds.includes(id));
  if (canAct.length <= 1) {
    // Everyone is all-in: run the board out, then straight to showdown.
    const board = [...state.board];
    const deck = [...state.deck];
    while (board.length < 5 && deck.length > 0) board.push(deck.pop()!);
    return showdown({ ...state, board, deck, toAct: null }, room);
  }
  let street: PokerStreet;
  let board: string[];
  let deck: string[];
  if (state.street === "preflop") {
    street = "flop";
    board = [...state.board, ...state.deck.slice(-3).reverse()];
    deck = state.deck.slice(0, -3);
  } else if (state.street === "flop") {
    street = "turn";
    board = [...state.board, state.deck[state.deck.length - 1]];
    deck = state.deck.slice(0, -1);
  } else if (state.street === "turn") {
    street = "river";
    board = [...state.board, state.deck[state.deck.length - 1]];
    deck = state.deck.slice(0, -1);
  } else {
    return showdown(state, room);
  }
  const toCall: Record<string, number> = {};
  const streetCommitted: Record<string, number> = {};
  const streetActed: Record<string, boolean> = {};
  for (const id of state.seats) {
    toCall[id] = 0;
    streetCommitted[id] = 0;
    streetActed[id] = false;
  }
  return {
    ...state,
    street,
    board,
    deck,
    toCall,
    streetCommitted,
    streetActed,
    currentBet: 0,
    lastFullRaise: BIG_BLIND,
    actedAtBet: {},
    toAct: nextToAct({ ...state, streetActed, toCall }, state.dealerSeat),
    lastRaiserId: null,
    timeLeft: betSeconds(room),
  };
}

/** Settles the current hand: ranks, side pots, chip payouts. Exported for tests. */
export function showdown(state: PokerGameState, _room: Room<PokerGameState>): PokerGameState {
  if (state.handWinnerIds.length > 0) {
    // Hand already settled by folds; just wait out the reveal.
    return { ...state, phase: "showdown", timeLeft: SHOWDOWN_SECONDS };
  }
  const active = state.activePlayers;
  const ranks: Record<string, HandRank> = {};
  for (const id of active) ranks[id] = bestOf7([...state.board, ...(state.holeCards[id] ?? [])]);
  const showdownHands: Record<string, string> = {};
  for (const id of active) showdownHands[id] = handName(ranks[id]);

  // Proper side pots: each all-in level is awarded to the best eligible hand.
  const contributors = state.seats.filter((id) => (state.committed[id] ?? 0) > 0);
  const levels = [...new Set(contributors.map((id) => state.committed[id] ?? 0))]
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const potSplit: Record<string, number> = {};
  const winners: string[] = [];
  let prev = 0;
  for (const level of levels) {
    // Odd chips go clockwise from the dealer, not permanently to seat one.
    const dealerIndex = state.seats.indexOf(state.dealerSeat);
    const clockwise = [...state.seats.slice(dealerIndex + 1), ...state.seats.slice(0, dealerIndex + 1)];
    const eligible = clockwise.filter((id) => active.includes(id) && (state.committed[id] ?? 0) >= level);
    const paid = contributors.filter((id) => (state.committed[id] ?? 0) >= level);
    const amount = (level - prev) * paid.length;
    // Uncalled excess is returned, not awarded to a shorter stack.
    if (paid.length === 1 || eligible.length === 0) {
      for (const id of paid) potSplit[id] = (potSplit[id] ?? 0) + level - prev;
      prev = level;
      continue;
    }
    let best: HandRank | null = null;
    let bestIds: string[] = [];
    for (const id of eligible) {
      const r = ranks[id];
      if (!best || compareRank(r, best) < 0) {
        best = r;
        bestIds = [id];
      } else if (compareRank(r, best) === 0) {
        bestIds.push(id);
      }
    }
    const share = Math.floor(amount / bestIds.length);
    for (let i = 0; i < bestIds.length; i++) {
      potSplit[bestIds[i]] = (potSplit[bestIds[i]] ?? 0) + share + (i < amount % bestIds.length ? 1 : 0);
    }
    for (const id of bestIds) if (!winners.includes(id)) winners.push(id);
    prev = level;
  }

  const chips = { ...state.chips };
  for (const [id, amt] of Object.entries(potSplit)) chips[id] = (chips[id] ?? 0) + amt;
  return {
    ...state,
    phase: "showdown",
    timeLeft: SHOWDOWN_SECONDS,
    pot: 0,
    chips,
    showdownHands,
    potSplit,
    handWinnerIds: winners,
    currentScores: { ...chips },
  };
}

function nextHand(state: PokerGameState, room: Room<PokerGameState>): PokerGameState {
  if (state.handNumber >= state.totalHands) {
    const winnerIds = topScorers(state.currentScores);
    return { ...state, phase: "result", timeLeft: 0, winnerId: winnerIds[0] ?? null, winnerIds };
  }
  // Party rule: busted players rebuy a small stack instead of sitting out.
  const chips = { ...state.chips };
  for (const id of state.seats) if ((chips[id] ?? 0) <= 0) chips[id] = REBUY_CHIPS;
  return dealHand({ ...state, handNumber: state.handNumber + 1, chips, currentScores: { ...chips } }, room);
}
