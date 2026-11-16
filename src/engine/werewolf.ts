import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const WEREWOLF_GAME_ID = "werewolf";

export type WerewolfRole = "werewolf" | "seer" | "witch" | "hunter" | "villager";

export type WerewolfPhase =
  | "role_reveal"
  | "night_werewolf"
  | "night_seer"
  | "night_witch"
  | "hunter_shot"
  | "day_announce"
  | "day_discussion"
  | "day_voting"
  | "day_exile"
  | "result";

export interface WerewolfGameState {
  phase: WerewolfPhase;
  currentRound: number;
  timeLeft: number;
  roles: Record<string, WerewolfRole>;
  eliminatedPlayerIds: string[];
  wolfVotes: Record<string, string>;
  nightVictimId: string | null;
  seerChecks: Record<string, "werewolf" | "good">;
  seerCheckedThisNight: boolean;
  witchAntidoteLeft: boolean;
  witchPoisonLeft: boolean;
  witchSaveUsed: boolean;
  witchPoisonTargetId: string | null;
  lastNightDeaths: string[];
  votes: Record<string, string>;
  readyToVote: Record<string, boolean>;
  lastExiledId: string | null;
  lastHunterTargetId: string | null;
  hunterPendingId: string | null;
  hunterNextPhase: "day_announce" | "night_transition" | null;
  winnerTeam: "good" | "werewolves" | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export type WerewolfAction =
  | { type: "wolfVote"; targetPlayerId: string }
  | { type: "seerCheck"; targetPlayerId: string }
  | { type: "witchAction"; choice: "save" | "poison" | "skip"; targetPlayerId?: string }
  | { type: "hunterShoot"; targetPlayerId: string | null }
  | { type: "readyVote" }
  | { type: "vote"; targetPlayerId: string };

export const ROLE_META: Record<
  WerewolfRole,
  { name: string; team: "werewolves" | "good"; icon: string; summary: string }
> = {
  werewolf: {
    name: "狼人",
    team: "werewolves",
    icon: "🐺",
    summary: "天黑時與狼隊友聯手獵殺一名玩家；白天偽裝好人誤導投票。",
  },
  seer: {
    name: "預言家",
    team: "good",
    icon: "🔮",
    summary: "每晚可查驗一位存活玩家的真實陣營（狼人或好人），引導好人投票。",
  },
  witch: {
    name: "女巫",
    team: "good",
    icon: "🧪",
    summary: "擁有 1 瓶解藥（可救回狼刀目標）與 1 瓶毒藥（可毒殺一人），整局各限用一次。",
  },
  hunter: {
    name: "獵人",
    team: "good",
    icon: "🏹",
    summary: "被狼人殺害或被白天投票放逐時，可開槍帶走場上一名玩家（被毒殺則無法開槍）。",
  },
  villager: {
    name: "平民",
    team: "good",
    icon: "🧑‍🌾",
    summary: "沒有特殊技能，但你的發言與每一票都是揪出狼人的關鍵！",
  },
};

export function roleDistribution(count: number): WerewolfRole[] {
  if (count <= 3) return (["werewolf", "seer", "villager"] as WerewolfRole[]).slice(0, Math.max(1, count));
  if (count === 4) return ["werewolf", "seer", "witch", "villager"];
  if (count === 5) return ["werewolf", "seer", "witch", "villager", "villager"];
  if (count === 6) return ["werewolf", "werewolf", "seer", "witch", "villager", "villager"];
  if (count === 7) return ["werewolf", "werewolf", "seer", "witch", "hunter", "villager", "villager"];
  if (count === 8) return ["werewolf", "werewolf", "seer", "witch", "hunter", "villager", "villager", "villager"];
  const wolves = Math.min(3, Math.floor(count / 3));
  const roles: WerewolfRole[] = [
    ...Array<WerewolfRole>(wolves).fill("werewolf"),
    "seer",
    "witch",
    "hunter",
  ];
  while (roles.length < count) roles.push("villager");
  return roles;
}

function assignRoles(players: Room["players"], rand: () => number = Math.random): Record<string, WerewolfRole> {
  const ids = Object.keys(players).sort();
  const deck = roleDistribution(ids.length);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const roles: Record<string, WerewolfRole> = {};
  ids.forEach((id, index) => {
    roles[id] = deck[index] ?? "villager";
  });
  return roles;
}

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) scores[id] = 0;
  return scores;
}

function nightDuration(room: Room<WerewolfGameState>, base: number): number {
  const diff = room.settings?.difficulty ?? "easy";
  if (diff === "hard") return Math.max(10, base - 5);
  if (diff === "medium") return Math.max(12, base - 2);
  return base;
}

function livingPlayerIds(room: Room<WerewolfGameState>, eliminated: string[]): string[] {
  return Object.keys(room.players).filter((id) => !eliminated.includes(id));
}

function connectedLivingIds(room: Room<WerewolfGameState>, eliminated: string[]): string[] {
  return livingPlayerIds(room, eliminated).filter((id) => room.players[id]?.isConnected !== false);
}

function finalizeWin(
  state: WerewolfGameState,
  room: Room<WerewolfGameState>,
  winnerTeam: "good" | "werewolves",
  eliminated: string[],
): WerewolfGameState {
  const scores = { ...state.currentScores };
  for (const id of Object.keys(room.players)) {
    const role = state.roles[id];
    const isWolf = role === "werewolf";
    const onWinningTeam = winnerTeam === "werewolves" ? isWolf : !isWolf;
    if (onWinningTeam) {
      const aliveBonus = eliminated.includes(id) ? 0 : 10;
      scores[id] = (scores[id] ?? 0) + 30 + aliveBonus;
    }
  }
  const winningIds = Object.keys(room.players)
    .filter((id) => (winnerTeam === "werewolves" ? state.roles[id] === "werewolf" : state.roles[id] !== "werewolf"))
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  return {
    ...state,
    eliminatedPlayerIds: eliminated,
    phase: "result",
    winnerTeam,
    winnerId: winningIds[0] ?? null,
    currentScores: scores,
    timeLeft: 0,
    hunterPendingId: null,
    hunterNextPhase: null,
  };
}

function checkWinOrContinue(
  state: WerewolfGameState,
  room: Room<WerewolfGameState>,
  eliminated: string[],
): WerewolfGameState | null {
  const living = livingPlayerIds(room, eliminated);
  const livingWolves = living.filter((id) => state.roles[id] === "werewolf");
  const livingGood = living.filter((id) => state.roles[id] !== "werewolf");

  if (livingWolves.length === 0) {
    return finalizeWin(state, room, "good", eliminated);
  }
  if (livingWolves.length >= livingGood.length) {
    return finalizeWin(state, room, "werewolves", eliminated);
  }

  const connectedLiving = connectedLivingIds(room, eliminated);
  if (connectedLiving.length <= 1) {
    const wolfConnected = connectedLiving.some((id) => state.roles[id] === "werewolf");
    return finalizeWin(state, room, wolfConnected ? "werewolves" : "good", eliminated);
  }
  return null;
}

function enterNightWerewolf(
  state: WerewolfGameState,
  room: Room<WerewolfGameState>,
  round: number,
): WerewolfGameState {
  const reset: WerewolfGameState = {
    ...state,
    currentRound: round,
    wolfVotes: {},
    nightVictimId: null,
    seerCheckedThisNight: false,
    witchSaveUsed: false,
    witchPoisonTargetId: null,
    lastNightDeaths: [],
    lastExiledId: null,
    lastHunterTargetId: null,
    votes: {},
    readyToVote: {},
  };
  const activeWolves = connectedLivingIds(room, reset.eliminatedPlayerIds).filter(
    (id) => reset.roles[id] === "werewolf",
  );
  if (activeWolves.length > 0) {
    return {
      ...reset,
      phase: "night_werewolf",
      timeLeft: nightDuration(room, 20),
    };
  }
  return afterWerewolfNight(reset, room);
}

function resolveWolfTarget(state: WerewolfGameState, room: Room<WerewolfGameState>): string | null {
  const counts: Record<string, number> = {};
  for (const target of Object.values(state.wolfVotes)) {
    if (target && !state.eliminatedPlayerIds.includes(target) && room.players[target]) {
      counts[target] = (counts[target] ?? 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0]?.[0] ?? null;
}

function afterWerewolfNight(state: WerewolfGameState, room: Room<WerewolfGameState>): WerewolfGameState {
  const activeSeer = connectedLivingIds(room, state.eliminatedPlayerIds).find((id) => state.roles[id] === "seer");
  if (activeSeer) {
    return {
      ...state,
      phase: "night_seer",
      timeLeft: nightDuration(room, 15),
    };
  }
  return afterSeerNight(state, room);
}

function afterSeerNight(state: WerewolfGameState, room: Room<WerewolfGameState>): WerewolfGameState {
  const activeWitch = connectedLivingIds(room, state.eliminatedPlayerIds).find((id) => state.roles[id] === "witch");
  if (activeWitch && (state.witchAntidoteLeft || state.witchPoisonLeft)) {
    return {
      ...state,
      phase: "night_witch",
      timeLeft: nightDuration(room, 18),
    };
  }
  return resolveNight(state, room);
}

function resolveNight(state: WerewolfGameState, room: Room<WerewolfGameState>): WerewolfGameState {
  const deaths: string[] = [];
  if (state.nightVictimId && !state.witchSaveUsed && !state.eliminatedPlayerIds.includes(state.nightVictimId)) {
    deaths.push(state.nightVictimId);
  }
  if (
    state.witchPoisonTargetId &&
    !deaths.includes(state.witchPoisonTargetId) &&
    !state.eliminatedPlayerIds.includes(state.witchPoisonTargetId)
  ) {
    deaths.push(state.witchPoisonTargetId);
  }

  const eliminated = [...state.eliminatedPlayerIds, ...deaths];
  const updated: WerewolfGameState = {
    ...state,
    eliminatedPlayerIds: eliminated,
    lastNightDeaths: deaths,
  };

  // Hunter triggers if killed by werewolf (not by witch poison)
  const hunterId = deaths.find((id) => state.roles[id] === "hunter" && id !== state.witchPoisonTargetId);
  if (
    hunterId &&
    room.players[hunterId]?.isConnected !== false &&
    livingPlayerIds(room, eliminated).length > 0
  ) {
    return {
      ...updated,
      phase: "hunter_shot",
      timeLeft: 15,
      hunterPendingId: hunterId,
      hunterNextPhase: "day_announce",
    };
  }

  const ended = checkWinOrContinue(updated, room, eliminated);
  if (ended) return ended;

  return {
    ...updated,
    phase: "day_announce",
    timeLeft: 7,
  };
}

function resolveDayVotes(state: WerewolfGameState, room: Room<WerewolfGameState>): WerewolfGameState {
  const counts: Record<string, number> = {};
  for (const target of Object.values(state.votes)) {
    if (!target || target === "abstain") continue;
    if (!state.eliminatedPlayerIds.includes(target) && room.players[target]) {
      counts[target] = (counts[target] ?? 0) + 1;
    }
  }

  let maxCount = 0;
  let exiledId: string | null = null;
  let tied = false;
  for (const [id, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      exiledId = id;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }
  if (tied) exiledId = null;

  const eliminated = exiledId ? [...state.eliminatedPlayerIds, exiledId] : state.eliminatedPlayerIds;
  const updated: WerewolfGameState = {
    ...state,
    eliminatedPlayerIds: eliminated,
    lastExiledId: exiledId,
  };

  if (
    exiledId &&
    state.roles[exiledId] === "hunter" &&
    room.players[exiledId]?.isConnected !== false &&
    livingPlayerIds(room, eliminated).length > 0
  ) {
    return {
      ...updated,
      phase: "hunter_shot",
      timeLeft: 15,
      hunterPendingId: exiledId,
      hunterNextPhase: "night_transition",
    };
  }

  const ended = checkWinOrContinue(updated, room, eliminated);
  if (ended) return ended;

  return {
    ...updated,
    phase: "day_exile",
    timeLeft: 6,
  };
}

export const WerewolfEngine: GameEngine<WerewolfGameState> = {
  createGame(room) {
    return {
      phase: "role_reveal",
      currentRound: 1,
      timeLeft: 10,
      roles: assignRoles(room.players),
      eliminatedPlayerIds: [],
      wolfVotes: {},
      nightVictimId: null,
      seerChecks: {},
      seerCheckedThisNight: false,
      witchAntidoteLeft: true,
      witchPoisonLeft: true,
      witchSaveUsed: false,
      witchPoisonTargetId: null,
      lastNightDeaths: [],
      votes: {},
      readyToVote: {},
      lastExiledId: null,
      lastHunterTargetId: null,
      hunterPendingId: null,
      hunterNextPhase: null,
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
    if (!state || !action || typeof action !== "object") return state;
    const act = action as WerewolfAction;

    if (state.phase === "night_werewolf" && act.type === "wolfVote") {
      if (state.roles[playerId] !== "werewolf" || state.eliminatedPlayerIds.includes(playerId)) return state;
      if (
        typeof act.targetPlayerId !== "string" ||
        state.eliminatedPlayerIds.includes(act.targetPlayerId) ||
        !room.players[act.targetPlayerId]
      ) {
        return state;
      }
      const wolfVotes = { ...state.wolfVotes, [playerId]: act.targetPlayerId };
      const nextState: WerewolfGameState = { ...state, wolfVotes };
      const activeWolves = connectedLivingIds(room, state.eliminatedPlayerIds).filter(
        (id) => state.roles[id] === "werewolf",
      );
      if (activeWolves.length > 0 && activeWolves.every((id) => Boolean(wolfVotes[id]))) {
        const victim = resolveWolfTarget(nextState, room);
        return afterWerewolfNight({ ...nextState, nightVictimId: victim }, room);
      }
      return nextState;
    }

    if (state.phase === "night_seer" && act.type === "seerCheck") {
      if (state.roles[playerId] !== "seer" || state.eliminatedPlayerIds.includes(playerId) || state.seerCheckedThisNight) {
        return state;
      }
      if (
        typeof act.targetPlayerId !== "string" ||
        act.targetPlayerId === playerId ||
        state.eliminatedPlayerIds.includes(act.targetPlayerId) ||
        !room.players[act.targetPlayerId]
      ) {
        return state;
      }
      const alignment = state.roles[act.targetPlayerId] === "werewolf" ? "werewolf" : "good";
      const scores = { ...state.currentScores };
      if (alignment === "werewolf" && !(act.targetPlayerId in state.seerChecks)) {
        scores[playerId] = (scores[playerId] ?? 0) + 10;
      }
      const nextState: WerewolfGameState = {
        ...state,
        seerChecks: { ...state.seerChecks, [act.targetPlayerId]: alignment },
        seerCheckedThisNight: true,
        currentScores: scores,
      };
      return afterSeerNight(nextState, room);
    }

    if (state.phase === "night_witch" && act.type === "witchAction") {
      if (state.roles[playerId] !== "witch" || state.eliminatedPlayerIds.includes(playerId)) return state;
      if (act.choice === "skip") {
        return resolveNight(state, room);
      }
      if (act.choice === "save") {
        if (!state.witchAntidoteLeft || !state.nightVictimId || state.eliminatedPlayerIds.includes(state.nightVictimId)) {
          return state;
        }
        const scores = { ...state.currentScores };
        scores[playerId] = (scores[playerId] ?? 0) + 10;
        return resolveNight(
          {
            ...state,
            witchAntidoteLeft: false,
            witchSaveUsed: true,
            currentScores: scores,
          },
          room,
        );
      }
      if (act.choice === "poison") {
        const target = act.targetPlayerId;
        if (
          !state.witchPoisonLeft ||
          typeof target !== "string" ||
          target === playerId ||
          state.eliminatedPlayerIds.includes(target) ||
          !room.players[target]
        ) {
          return state;
        }
        const scores = { ...state.currentScores };
        if (state.roles[target] === "werewolf") {
          scores[playerId] = (scores[playerId] ?? 0) + 15;
        }
        return resolveNight(
          {
            ...state,
            witchPoisonLeft: false,
            witchPoisonTargetId: target,
            currentScores: scores,
          },
          room,
        );
      }
      return state;
    }

    if (state.phase === "hunter_shot" && act.type === "hunterShoot") {
      if (playerId !== state.hunterPendingId) return state;
      let eliminated = state.eliminatedPlayerIds;
      let scores = state.currentScores;
      let shotTarget: string | null = null;
      if (
        typeof act.targetPlayerId === "string" &&
        act.targetPlayerId !== playerId &&
        !eliminated.includes(act.targetPlayerId) &&
        room.players[act.targetPlayerId]
      ) {
        shotTarget = act.targetPlayerId;
        eliminated = [...eliminated, shotTarget];
        if (state.roles[shotTarget] === "werewolf") {
          scores = { ...scores, [playerId]: (scores[playerId] ?? 0) + 15 };
        }
      }
      const nextState: WerewolfGameState = {
        ...state,
        eliminatedPlayerIds: eliminated,
        lastHunterTargetId: shotTarget,
        hunterPendingId: null,
        currentScores: scores,
      };
      const ended = checkWinOrContinue(nextState, room, eliminated);
      if (ended) return ended;
      if (state.hunterNextPhase === "day_announce") {
        return { ...nextState, phase: "day_announce", timeLeft: 7, hunterNextPhase: null };
      }
      return enterNightWerewolf({ ...nextState, hunterNextPhase: null }, room, state.currentRound + 1);
    }

    if (state.phase === "day_discussion" && act.type === "readyVote") {
      if (state.eliminatedPlayerIds.includes(playerId)) return state;
      const readyToVote = { ...state.readyToVote, [playerId]: true };
      const living = connectedLivingIds(room, state.eliminatedPlayerIds);
      if (living.length > 0 && living.every((id) => readyToVote[id])) {
        return {
          ...state,
          readyToVote,
          phase: "day_voting",
          timeLeft: 20,
          votes: {},
        };
      }
      return { ...state, readyToVote };
    }

    if (state.phase === "day_voting" && act.type === "vote") {
      if (state.eliminatedPlayerIds.includes(playerId)) return state;
      if (typeof act.targetPlayerId !== "string") return state;
      if (
        act.targetPlayerId !== "abstain" &&
        (state.eliminatedPlayerIds.includes(act.targetPlayerId) || !room.players[act.targetPlayerId])
      ) {
        return state;
      }
      const votes = { ...state.votes, [playerId]: act.targetPlayerId };
      const nextState: WerewolfGameState = { ...state, votes };
      const living = connectedLivingIds(room, state.eliminatedPlayerIds);
      if (living.length > 0 && living.every((id) => Boolean(votes[id]))) {
        return resolveDayVotes(nextState, room);
      }
      return nextState;
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state || state.phase === "result") return state;

    const nextTime = state.timeLeft - 1;
    if (nextTime > 0) return { ...state, timeLeft: nextTime };

    if (state.phase === "role_reveal") {
      return enterNightWerewolf(state, room, 1);
    }
    if (state.phase === "night_werewolf") {
      const victim = resolveWolfTarget(state, room);
      return afterWerewolfNight({ ...state, nightVictimId: victim }, room);
    }
    if (state.phase === "night_seer") {
      return afterSeerNight(state, room);
    }
    if (state.phase === "night_witch") {
      return resolveNight(state, room);
    }
    if (state.phase === "hunter_shot") {
      const ended = checkWinOrContinue(state, room, state.eliminatedPlayerIds);
      if (ended) return ended;
      const cleared: WerewolfGameState = { ...state, hunterPendingId: null };
      if (state.hunterNextPhase === "day_announce") {
        return { ...cleared, phase: "day_announce", timeLeft: 7, hunterNextPhase: null };
      }
      return enterNightWerewolf({ ...cleared, hunterNextPhase: null }, room, state.currentRound + 1);
    }
    if (state.phase === "day_announce") {
      const ended = checkWinOrContinue(state, room, state.eliminatedPlayerIds);
      if (ended) return ended;
      return {
        ...state,
        phase: "day_discussion",
        timeLeft: Math.max(30, room.settings?.timer ?? 60),
        readyToVote: {},
      };
    }
    if (state.phase === "day_discussion") {
      return {
        ...state,
        phase: "day_voting",
        timeLeft: 20,
        votes: {},
      };
    }
    if (state.phase === "day_voting") {
      return resolveDayVotes(state, room);
    }
    if (state.phase === "day_exile") {
      return enterNightWerewolf(state, room, state.currentRound + 1);
    }

    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const ids = Object.keys(room.players);
    const winningIds =
      state?.winnerTeam === "werewolves"
        ? ids.filter((id) => state.roles[id] === "werewolf")
        : state?.winnerTeam === "good"
          ? ids.filter((id) => state.roles[id] !== "werewolf")
          : [];
    const sorted = (winningIds.length ? winningIds : ids).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    const winnerId = state?.winnerId ?? sorted[0] ?? "";

    const achievements: Achievement[] = [];
    if (state?.winnerTeam === "werewolves" && sorted[0]) {
      achievements.push({
        id: "alpha_wolf",
        name: "月夜狼王",
        icon: "🐺",
        description: "狼人陣營成功屠城奪勝",
        playerId: sorted[0],
      });
    } else if (state?.winnerTeam === "good" && sorted[0]) {
      achievements.push({
        id: "village_guardian",
        name: "晨曦守護者",
        icon: "🛡️",
        description: "好人陣營合力揪出所有狼人",
        playerId: sorted[0],
      });
    }
    const seerId = Object.entries(state?.roles ?? {}).find(([, r]) => r === "seer")?.[0];
    if (seerId && Object.values(state?.seerChecks ?? {}).includes("werewolf")) {
      achievements.push({
        id: "true_sight",
        name: "真理之眼",
        icon: "🔮",
        description: "預言家精準驗出隱藏狼人",
        playerId: seerId,
      });
    }

    return {
      scores,
      achievements,
      winnerId,
      ...(winningIds.length ? { winnerIds: sorted } : {}),
    };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
