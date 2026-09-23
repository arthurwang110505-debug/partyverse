import type { Room } from "@/types";
import { HOST_STALE_MS } from "@/constants/room";
import { GAMES } from "@/constants/games";
import { normalizeSettings } from "@/constants/gameSettings";
import { getGameEngine } from "@/engine";
import { connectedParticipantIds, isParticipant, participantIds } from "@/engine/participants";
import { topScorers } from "@/engine/scoring";
import { normalizeGameState } from "@/engine/state";

type State = Record<string, unknown>;
export interface ActionPhase {
  gameId: string;
  phase: unknown;
  round: unknown;
  startedAt?: number;
  contextKey?: string;
}

function timerKey(state: State): "timeLeft" | "bombTimeLeft" {
  if (state.phase === "rules") return "timeLeft";
  return typeof state.bombTimeLeft === "number" ? "bombTimeLeft" : "timeLeft";
}
function seconds(state: State): number {
  const value = state[timerKey(state)];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}
function samePhase(a: State, b: State): boolean {
  return (
    a.phase === b.phase &&
    a.currentRound === b.currentRound &&
    a.handNumber === b.handNumber &&
    a.street === b.street &&
    a.toAct === b.toAct &&
    a.actionSeq === b.actionSeq
  );
}
function stamp(previous: State | null, next: State, now: number, action = false): State {
  let deadline = now + seconds(next) * 1000;
  if (previous && samePhase(previous, next) && typeof previous.phaseEndsAt === "number") {
    deadline = previous.phaseEndsAt;
    // An explicit game penalty/extension changes the deadline; a clock tick does not.
    if (action) deadline += (seconds(next) - seconds(previous)) * 1000;
  }
  return { ...next, phaseEndsAt: deadline };
}

function finish(room: Room, now: number): Room {
  if (room.gameState.phase !== "result") return room;
  const engine = getGameEngine(room.gameId);
  if (!engine) return room;
  const summary = engine.endGame(room);
  const ids = participantIds(room);
  let winnerIds = summary.winnerIds ?? topScorers(summary.scores, ids);
  if (room.gameId === "mysteryroom") winnerIds = room.gameState.isUnlocked ? ids : [];
  if (room.gameState.winnerTeam === "civilians")
    winnerIds = ids.filter((id) => id !== room.gameState.undercoverPlayerId);
  if (room.gameState.winnerTeam === "undercover")
    winnerIds = ids.filter((id) => id === room.gameState.undercoverPlayerId);
  return {
    ...room,
    status: "RESULTS",
    finishedAt: now,
    gameState: {
      ...room.gameState,
      currentScores: summary.scores,
      achievements: summary.achievements,
      winnerId: winnerIds[0] ?? "",
      winnerIds,
    },
  };
}

/** Start against the transaction's current roster, not a stale React snapshot. */
export function startRoomGame(room: Room, now = Date.now()): Room {
  if (room.status !== "LOBBY") return room;
  const engine = getGameEngine(room.gameId);
  if (!engine) throw new Error("這個遊戲還沒有可玩的內容");
  const ids = Object.values(room.players)
    .filter((p) => isParticipant(p) && p.isConnected !== false)
    .map((p) => p.id);
  const game = GAMES.find((entry) => entry.id === room.gameId);
  if (ids.length < (game?.minPlayers ?? 2))
    throw new Error(`至少需要 ${game?.minPlayers ?? 2} 位手機玩家才能開始（電視不計入）`);
  if (ids.length > (game?.maxPlayers ?? 20)) throw new Error(`這款遊戲最多支援 ${game?.maxPlayers ?? 20} 位玩家`);
  const current: Room = { ...room, settings: normalizeSettings(room.gameId, room.settings), participantIds: ids };
  const { finishedAt: _finished, ...base } = current;
  return {
    ...base,
    status: "PLAYING",
    startedAt: now,
    lastTickAt: now,
    gameState: stamp(null, engine.createGame(current), now),
  };
}

/**
 * A stored deadline makes duplicate host tabs, a delayed tick, and host takeover
 * advance the same clock. Never skip an entire reveal after a backgrounded tab.
 */
export function advanceRoomGame(room: Room, now = Date.now(), heartbeat = false): Room {
  if (room.status !== "PLAYING") return room;
  const engine = getGameEngine(room.gameId);
  if (!engine) return room;
  const state = normalizeGameState(room.gameId, room.gameState);
  if (state.phase === "result") return finish({ ...room, gameState: state }, now);
  const key = timerKey(state);
  const deadline = typeof state.phaseEndsAt === "number" ? state.phaseEndsAt : now + seconds(state) * 1000;
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const next = engine.updateGameState({ ...room, gameState: { ...state, [key]: remaining + 1 } });
  const updated = {
    ...room,
    ...(heartbeat ? { lastTickAt: now } : {}),
    gameState: stamp({ ...state, phaseEndsAt: deadline }, next, now),
  };
  return finish(updated, now);
}

export function applyRoomAction(
  room: Room,
  playerId: string,
  action: unknown,
  expected: ActionPhase,
  now = Date.now(),
): Room {
  if (
    room.status !== "PLAYING" ||
    room.gameId !== expected.gameId ||
    room.startedAt !== expected.startedAt ||
    (!connectedParticipantIds(room).includes(playerId) &&
      !(
        room.gameState.phase === "rules" &&
        room.hostPlayerId === playerId &&
        room.players[playerId]?.isConnected !== false &&
        room.players[playerId] &&
        (action as { type?: string } | null)?.type === "skipRules"
      ))
  )
    return room;
  const current = advanceRoomGame(room, now);
  if (
    current.status !== "PLAYING" ||
    current.gameState.phase !== expected.phase ||
    current.gameState.currentRound !== expected.round ||
    (expected.contextKey !== undefined && actionContextKey(current.gameState) !== expected.contextKey)
  )
    return current;
  const engine = getGameEngine(current.gameId)!;
  const next = engine.handlePlayerAction(current, playerId, action);
  return finish({ ...current, gameState: stamp(current.gameState, next, now, true) }, now);
}

/** Rematch and switching games are lobby transitions, not an in-game endRound. */
export function returnRoomToLobby(room: Room, gameId = room.gameId): Room {
  if (!getGameEngine(gameId)) throw new Error("找不到這個遊戲");
  const { startedAt: _started, finishedAt: _finished, lastTickAt: _tick, participantIds: _ids, ...base } = room;
  const history = Array.isArray(room.gameState.usedPromptIds) ? (room.gameState.usedPromptIds as string[]) : [];
  return {
    ...base,
    gameId,
    status: "LOBBY",
    gameState: {},
    settings: normalizeSettings(gameId, gameId === room.gameId ? room.settings : undefined),
    contentHistory: { ...room.contentHistory, ...(history.length ? { [room.gameId]: history.slice(-64) } : {}) },
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [id, { ...p, score: 0, isReady: p.isHost }]),
    ),
  };
}

export function restartRoomGame(room: Room, now = Date.now()): Room {
  return startRoomGame(returnRoomToLobby(room), now);
}

export function endRoomGame(room: Room, now = Date.now()): Room {
  if (room.status !== "PLAYING") return room;
  return finish({ ...room, gameState: { ...normalizeGameState(room.gameId, room.gameState), phase: "result" } }, now);
}

/** Compare-and-swap ownership; leave the current phase deadline untouched. */
export function claimRoomHost(room: Room, userId: string, expectedHostId: string, now: number): Room | null {
  const host = room.players?.[room.hostPlayerId];
  const stale = room.status === "PLAYING" && now - (room.lastTickAt ?? now) > HOST_STALE_MS;
  if (room.hostPlayerId !== expectedHostId || (host && host.isConnected !== false && !stale)) return null;
  if (!room.players?.[userId]?.isConnected) return null;
  return {
    ...room,
    hostPlayerId: userId,
    lastTickAt: now,
    players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, { ...p, isHost: id === userId }])),
  };
}

/** Bind taps to a poker decision or word challenge, even within the same phase. */
export function actionContextKey(state: State): string {
  return JSON.stringify([
    state.phase,
    state.currentRound,
    state.handNumber,
    state.street,
    state.toAct,
    state.actionSeq,
    state.wordSeq,
  ]);
}
