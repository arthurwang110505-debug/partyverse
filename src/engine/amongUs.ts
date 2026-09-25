import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const AMONG_GAME_ID = "amongus";

export type AmongPhase = "roles" | "tasks" | "discussion" | "voting" | "ejected" | "result";

/** Phone mini-games. The phone validates them locally and reports completion. */
export const TASK_TYPES = [
  { id: "wires", name: "接電線", icon: "🔌" },
  { id: "code", name: "輸入密碼", icon: "🔢" },
  { id: "fuel", name: "加油", icon: "⛽" },
  { id: "shields", name: "啟動護盾", icon: "🛡️" },
] as const;

export const TASKS_PER_PLAYER = 4;
export const ROLES_SECONDS = 7;
export const DISCUSS_SECONDS = 30;
export const VOTE_SECONDS = 25;
export const EJECT_SECONDS = 7;
export const FIRST_KILL_COOLDOWN = 15;
export const KILL_COOLDOWN = 25;
/** A body can be reported this many seconds after the kill. */
export const REPORT_DELAY = 8;

export interface AmongGameState {
  phase: AmongPhase;
  timeLeft: number;
  /** Counts meetings: round N is the Nth task period. */
  currentRound: number;
  impostorIds: string[];
  deadIds: string[];
  /** Killed since the last meeting, not yet reported. */
  bodies: string[];
  /** Bodies discovered in the current meeting (public once the meeting starts). */
  meetingBodies: string[];
  meetingCallerId: string | null;
  meetingReason: "report" | "emergency" | "timeout" | null;
  reportDelay: number;
  /** playerId -> task type index per slot */
  tasks: Record<string, number[]>;
  /** playerId -> bitmask of completed slots */
  taskMask: Record<string, number>;
  tasksTotal: number;
  tasksCompleted: number;
  killCooldowns: Record<string, number>;
  emergencyUsed: Record<string, boolean>;
  /** voterId -> targetId or "skip" */
  votes: Record<string, string>;
  ejectedId: string | null;
  ejectedWasImpostor: boolean;
  winnerTeam: "crew" | "impostor" | null;
  winReason: string | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
  winnerIds: string[];
}

export type AmongAction =
  | { type: "completeTask"; slot: number }
  | { type: "kill"; targetId: string }
  | { type: "report" }
  | { type: "emergency" }
  | { type: "vote"; targetId: string };

function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function impostorCount(players: number): number {
  return players >= 7 ? 2 : 1;
}

function taskTime(room: Room<AmongGameState>): number {
  return Math.max(45, room.settings?.timer ?? 75);
}

function ids(room: Room<AmongGameState>): string[] {
  return Object.keys(room.players);
}

export function isAlive(state: AmongGameState, id: string): boolean {
  return !state.deadIds.includes(id);
}

function livingCrew(state: AmongGameState, room: Room<AmongGameState>): string[] {
  return ids(room).filter((id) => isAlive(state, id) && !state.impostorIds.includes(id));
}

function livingImpostors(state: AmongGameState): string[] {
  return state.impostorIds.filter((id) => isAlive(state, id));
}

export function slotDone(state: AmongGameState, id: string, slot: number): boolean {
  return ((state.taskMask[id] ?? 0) & (1 << slot)) !== 0;
}

function finish(state: AmongGameState, room: Room<AmongGameState>, team: "crew" | "impostor", reason: string): AmongGameState {
  const scores = { ...state.currentScores };
  const winners = ids(room).filter((id) => (team === "impostor") === state.impostorIds.includes(id));
  for (const id of winners) scores[id] = (scores[id] ?? 0) + (team === "impostor" ? 50 : 20);
  return {
    ...state,
    phase: "result",
    timeLeft: 0,
    winnerTeam: team,
    winReason: reason,
    currentScores: scores,
    winnerIds: winners,
    winnerId: winners[0] ?? null,
  };
}

/** Returns a finished state if either side has won, else null. */
function checkWin(state: AmongGameState, room: Room<AmongGameState>): AmongGameState | null {
  if (livingImpostors(state).length === 0) return finish(state, room, "crew", "所有內鬼都被揪出來了！");
  if (state.tasksTotal > 0 && state.tasksCompleted >= state.tasksTotal) return finish(state, room, "crew", "船員完成了全部任務！");
  if (livingImpostors(state).length >= livingCrew(state, room).length) return finish(state, room, "impostor", "內鬼人數追上船員了！");
  return null;
}

function startMeeting(
  state: AmongGameState,
  callerId: string | null,
  reason: AmongGameState["meetingReason"],
): AmongGameState {
  return {
    ...state,
    phase: "discussion",
    timeLeft: DISCUSS_SECONDS,
    meetingBodies: state.bodies,
    bodies: [],
    meetingCallerId: callerId,
    meetingReason: reason,
    votes: {},
    ejectedId: null,
    ejectedWasImpostor: false,
  };
}

function backToTasks(state: AmongGameState, room: Room<AmongGameState>): AmongGameState {
  const cooldowns: Record<string, number> = {};
  for (const id of state.impostorIds) cooldowns[id] = FIRST_KILL_COOLDOWN;
  return {
    ...state,
    phase: "tasks",
    timeLeft: taskTime(room),
    currentRound: state.currentRound + 1,
    killCooldowns: cooldowns,
    meetingBodies: [],
    meetingCallerId: null,
    meetingReason: null,
    reportDelay: 0,
    votes: {},
  };
}

function tally(state: AmongGameState, _room: Room<AmongGameState>): AmongGameState {
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(state.votes)) {
    if (!isAlive(state, voter)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const skip = counts.skip ?? 0;
  const ranked = Object.entries(counts)
    .filter(([id]) => id !== "skip")
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1][1] === top?.[1];
  const ejectedId = top && !tie && top[1] > skip ? top[0] : null;

  const scores = { ...state.currentScores };
  // Voting out an impostor rewards everyone who pointed at them.
  if (ejectedId && state.impostorIds.includes(ejectedId)) {
    for (const [voter, target] of Object.entries(state.votes)) {
      if (target === ejectedId) scores[voter] = (scores[voter] ?? 0) + 5;
    }
  }
  return {
    ...state,
    phase: "ejected",
    timeLeft: EJECT_SECONDS,
    ejectedId,
    ejectedWasImpostor: Boolean(ejectedId && state.impostorIds.includes(ejectedId)),
    deadIds: ejectedId ? [...state.deadIds, ejectedId] : state.deadIds,
    currentScores: scores,
  };
}

export const AmongUsEngine: GameEngine<AmongGameState> = {
  createGame(room) {
    const all = ids(room);
    const impostorIds = shuffle(all).slice(0, impostorCount(all.length));
    const tasks: Record<string, number[]> = {};
    const scores: Record<string, number> = {};
    for (const id of all) {
      tasks[id] = shuffle([0, 1, 2, 3, 0, 1, 2, 3]).slice(0, TASKS_PER_PLAYER);
      scores[id] = 0;
    }
    const crew = all.length - impostorIds.length;
    return {
      phase: "roles",
      timeLeft: ROLES_SECONDS,
      currentRound: 0,
      impostorIds,
      deadIds: [],
      bodies: [],
      meetingBodies: [],
      meetingCallerId: null,
      meetingReason: null,
      reportDelay: 0,
      tasks,
      taskMask: {},
      tasksTotal: crew * TASKS_PER_PLAYER,
      tasksCompleted: 0,
      killCooldowns: {},
      emergencyUsed: {},
      votes: {},
      ejectedId: null,
      ejectedWasImpostor: false,
      winnerTeam: null,
      winReason: null,
      currentScores: scores,
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
    const act = action as AmongAction;
    const alive = isAlive(state, playerId);
    const impostor = state.impostorIds.includes(playerId);

    if (state.phase === "tasks") {
      if (act?.type === "completeTask") {
        // Ghost crewmates keep working; impostors only fake it.
        const slots = state.tasks[playerId] ?? [];
        if (impostor || !Number.isInteger(act.slot) || act.slot < 0 || act.slot >= slots.length) return state;
        if (slotDone(state, playerId, act.slot)) return state;
        const next = {
          ...state,
          taskMask: { ...state.taskMask, [playerId]: (state.taskMask[playerId] ?? 0) | (1 << act.slot) },
          tasksCompleted: state.tasksCompleted + 1,
          currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + 2 },
        };
        return checkWin(next, room) ?? next;
      }
      if (act?.type === "kill") {
        if (!impostor || !alive || (state.killCooldowns[playerId] ?? 0) > 0) return state;
        const target = act.targetId;
        if (typeof target !== "string" || !room.players[target] || !isAlive(state, target) || state.impostorIds.includes(target)) {
          return state;
        }
        const next = {
          ...state,
          deadIds: [...state.deadIds, target],
          bodies: [...state.bodies, target],
          reportDelay: REPORT_DELAY,
          killCooldowns: { ...state.killCooldowns, [playerId]: KILL_COOLDOWN },
          currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + 5 },
        };
        return checkWin(next, room) ?? next;
      }
      if (act?.type === "report") {
        if (!alive || state.bodies.length === 0 || state.reportDelay > 0) return state;
        return startMeeting(state, playerId, "report");
      }
      if (act?.type === "emergency") {
        if (!alive || state.emergencyUsed[playerId]) return state;
        return startMeeting({ ...state, emergencyUsed: { ...state.emergencyUsed, [playerId]: true } }, playerId, "emergency");
      }
      return state;
    }

    if (state.phase === "discussion" || state.phase === "voting") {
      if (act?.type !== "vote" || !alive || state.votes[playerId]) return state;
      const target = act.targetId;
      if (target !== "skip" && (typeof target !== "string" || !room.players[target] || !isAlive(state, target))) return state;
      const votes = { ...state.votes, [playerId]: target };
      const voters = ids(room).filter((id) => isAlive(state, id) && room.players[id]?.isConnected !== false);
      const next = { ...state, votes };
      return voters.every((id) => votes[id]) ? tally(next, room) : next;
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;
    const tickDown = state.timeLeft - 1;

    if (state.phase === "roles") {
      return tickDown > 0 ? { ...state, timeLeft: tickDown } : backToTasks(state, room);
    }
    if (state.phase === "tasks") {
      const killCooldowns: Record<string, number> = {};
      for (const [id, cd] of Object.entries(state.killCooldowns)) killCooldowns[id] = Math.max(0, cd - 1);
      const next = { ...state, killCooldowns, reportDelay: Math.max(0, state.reportDelay - 1) };
      if (tickDown > 0) return { ...next, timeLeft: tickDown };
      // Out of time: the ship's computer calls a meeting.
      return startMeeting(next, null, "timeout");
    }
    if (state.phase === "discussion") {
      return tickDown > 0 ? { ...state, timeLeft: tickDown } : { ...state, phase: "voting", timeLeft: VOTE_SECONDS };
    }
    if (state.phase === "voting") {
      return tickDown > 0 ? { ...state, timeLeft: tickDown } : tally(state, room);
    }
    if (state.phase === "ejected") {
      if (tickDown > 0) return { ...state, timeLeft: tickDown };
      return checkWin(state, room) ?? backToTasks(state, room);
    }
    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const winnerIds = state?.winnerIds?.length ? state.winnerIds : [];
    const achievements: Achievement[] = [];
    if (state?.winnerTeam === "impostor") {
      for (const id of state.impostorIds) {
        achievements.push({ id: "sus_master", name: "完美內鬼", icon: "🔪", description: "騙過了整艘太空船", playerId: id });
      }
    }
    return { scores, achievements, winnerId: winnerIds[0] ?? "", winnerIds };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
