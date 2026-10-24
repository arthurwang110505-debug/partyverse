import type { Room, RoomSessionPlan } from "@/types";
import { HOST_STALE_MS } from "@/constants/room";
import { GAMES } from "@/constants/games";
import { normalizeSettings } from "@/constants/gameSettings";
import { getGameEngine } from "@/engine";
import { connectedParticipantIds, isParticipant, participantIds } from "@/engine/participants";
import { topScorers } from "@/engine/scoring";
import { normalizeGameState } from "@/engine/state";
import { hydrateGameState, splitSecrets } from "@/lib/privateState";
import { hostIsPlaying, isPhoneHostRoom } from "@/lib/hostMode";

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

/** Engines always see public ⊔ host secrets. */
function forEngine(room: Room): Room {
  const publicState = normalizeGameState(room.gameId, room.gameState);
  return {
    ...room,
    gameState: hydrateGameState(publicState, room.privateHost ?? null),
  };
}

/** Strip secrets before the room blob is stored / broadcast. */
function publish(room: Room): Room {
  const full = room.gameState as Record<string, unknown>;
  const { publicState, hostSecrets, playerSecrets } = splitSecrets(room.gameId, full);
  const hasSecrets = Object.keys(hostSecrets).length > 0 || Object.keys(playerSecrets).length > 0;
  // Firebase rejects `undefined` values, so never emit the key unless there is a value.
  const { privateHost: _ph, private: _pv, ...base } = room;
  const next: Room = { ...base, gameState: publicState };
  if (hasSecrets) {
    next.privateHost = hostSecrets;
    next.private = playerSecrets;
  } else {
    if (room.privateHost !== undefined) next.privateHost = room.privateHost;
    if (room.private !== undefined) next.private = room.private;
  }
  return next;
}

function finish(room: Room, now: number): Room {
  const live = forEngine(room);
  if (live.gameState.phase !== "result") return room;
  const engine = getGameEngine(live.gameId);
  if (!engine) return room;
  const summary = engine.endGame(live);
  const ids = participantIds(live);
  let winnerIds = summary.winnerIds ?? topScorers(summary.scores, ids);
  if (live.gameId === "mysteryroom") winnerIds = live.gameState.isUnlocked ? ids : [];
  if (live.gameState.winnerTeam === "civilians")
    winnerIds = ids.filter((id) => id !== live.gameState.undercoverPlayerId);
  if (live.gameState.winnerTeam === "undercover")
    winnerIds = ids.filter((id) => id === live.gameState.undercoverPlayerId);
  // On RESULTS, reveal host secrets publicly so the podium can name the spy / words.
  const revealed = {
    ...live.gameState,
    currentScores: summary.scores,
    achievements: summary.achievements,
    winnerId: winnerIds[0] ?? "",
    winnerIds,
  };
  // Keep private mirrors (when present) so a rematch path can clear them cleanly.
  return {
    ...room,
    status: "RESULTS",
    finishedAt: now,
    gameState: revealed,
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
  if (ids.length < (game?.minPlayers ?? 2)) {
    // Phone-host rooms have no separate screen: either the host counts (they
    // play) or the host phone is the display and only the other phones count.
    const need = game?.minPlayers ?? 2;
    const reason = !isPhoneHostRoom(room)
      ? "（電視不計入）"
      : hostIsPlaying(room)
        ? ""
        : "（主持手機不計入）";
    throw new Error(`至少需要 ${need} 位${isPhoneHostRoom(room) ? "玩家" : "手機玩家"}才能開始${reason}`);
  }
  if (ids.length > (game?.maxPlayers ?? 20)) throw new Error(`這款遊戲最多支援 ${game?.maxPlayers ?? 20} 位玩家`);
  const current: Room = { ...room, settings: normalizeSettings(room.gameId, room.settings), participantIds: ids };
  const { finishedAt: _finished, privateHost: _ph, private: _pv, ...base } = current;
  const fullState = stamp(null, engine.createGame(current), now);
  return publish({
    ...base,
    status: "PLAYING",
    startedAt: now,
    lastTickAt: now,
    gameState: fullState,
  });
}

/**
 * A stored deadline makes duplicate host tabs, a delayed tick, and host takeover
 * advance the same clock. Never skip an entire reveal after a backgrounded tab.
 */
export function advanceRoomGame(room: Room, now = Date.now(), heartbeat = false): Room {
  if (room.status !== "PLAYING") return room;
  const engine = getGameEngine(room.gameId);
  if (!engine) return room;
  const live = forEngine(room);
  const state = live.gameState as State;
  if (state.phase === "result") return finish(live, now);
  const key = timerKey(state);
  const deadline = typeof state.phaseEndsAt === "number" ? state.phaseEndsAt : now + seconds(state) * 1000;
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const next = engine.updateGameState({ ...live, gameState: { ...state, [key]: remaining + 1 } });
  const updated = publish({
    ...room,
    ...(heartbeat ? { lastTickAt: now } : {}),
    gameState: stamp({ ...state, phaseEndsAt: deadline }, next, now),
  });
  return finish(forEngine(updated), now);
}

export function applyRoomAction(
  room: Room,
  playerId: string,
  action: unknown,
  expected: ActionPhase,
  now = Date.now(),
): Room {
  const livePhase = forEngine(room).gameState.phase;
  if (
    room.status !== "PLAYING" ||
    room.gameId !== expected.gameId ||
    room.startedAt !== expected.startedAt ||
    (!connectedParticipantIds(room).includes(playerId) &&
      !(
        livePhase === "rules" &&
        room.hostPlayerId === playerId &&
        room.players[playerId]?.isConnected !== false &&
        room.players[playerId] &&
        (action as { type?: string } | null)?.type === "skipRules"
      ))
  )
    return room;
  const current = advanceRoomGame(room, now);
  const live = forEngine(current);
  if (
    current.status !== "PLAYING" ||
    live.gameState.phase !== expected.phase ||
    live.gameState.currentRound !== expected.round ||
    (expected.contextKey !== undefined && actionContextKey(live.gameState as State) !== expected.contextKey)
  )
    return current;
  const engine = getGameEngine(current.gameId)!;
  const next = engine.handlePlayerAction(live, playerId, action);
  const stamped = stamp(live.gameState as State, next as State, now, true);
  return finish(forEngine(publish({ ...current, gameState: stamped })), now);
}

/** Rematch and switching games are lobby transitions, not an in-game endRound. */
export function returnRoomToLobby(room: Room, gameId = room.gameId): Room {
  if (!getGameEngine(gameId)) throw new Error("找不到這個遊戲");
  const {
    startedAt: _started,
    finishedAt: _finished,
    lastTickAt: _tick,
    participantIds: _ids,
    nextGameVotes: _votes,
    privateHost: _ph,
    private: _pv,
    ...base
  } = room;
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

/**
 * Load a freshly drawn random-playlist session into the room.
 *
 * The first entry becomes the room's game, carrying its suggested settings —
 * suggestions only, so the lobby can still edit them before the host starts.
 */
export function startRoomSession(room: Room, plan: RoomSessionPlan, now = Date.now()): Room {
  const entry = plan.entries[0];
  if (!entry) throw new Error("這個時段沒有排到遊戲，請重新抽一次");
  if (!getGameEngine(entry.gameId)) throw new Error("找不到這個遊戲");
  const lobby = returnRoomToLobby(room, entry.gameId);
  return {
    ...lobby,
    settings: normalizeSettings(entry.gameId, entry.settings),
    sessionPlan: { ...plan, startedAt: plan.startedAt || now },
  };
}

/**
 * Finish the session's current game and promote the next entry.
 *
 * Returns `null` when the room has no session at all; when the last game is
 * done it keeps the room on RESULTS and stamps `completedAt` instead, so the
 * host screen can present the session summary.
 */
export function advanceRoomSession(room: Room, now = Date.now()): Room | null {
  const plan = room.sessionPlan;
  if (!plan || !plan.entries.length) return null;
  const [current, ...rest] = plan.entries;
  const played = plan.played.includes(current.gameId) ? plan.played : [...plan.played, current.gameId];
  if (!rest.length) {
    return { ...room, sessionPlan: { ...plan, entries: [], played, completedAt: now } };
  }
  const next = rest[0];
  if (!getGameEngine(next.gameId)) throw new Error("找不到下一款遊戲");
  const lobby = returnRoomToLobby(room, next.gameId);
  return {
    ...lobby,
    settings: normalizeSettings(next.gameId, next.settings),
    sessionPlan: { ...plan, entries: rest, played },
  };
}

/** A manual game switch leaves a running session behind. */
export function leaveRoomSession(room: Room, gameId: string): Room {
  const plan = room.sessionPlan;
  if (!plan || plan.entries[0]?.gameId === gameId) return room;
  const { sessionPlan: _dropped, ...rest } = room;
  return rest;
}

export function endRoomGame(room: Room, now = Date.now()): Room {
  if (room.status !== "PLAYING") return room;
  const live = forEngine(room);
  return finish(
    { ...live, gameState: { ...live.gameState, phase: "result" } },
    now,
  );
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
