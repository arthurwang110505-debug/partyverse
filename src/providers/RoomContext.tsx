"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  update,
  type DatabaseReference,
  type Database,
} from "firebase/database";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import type { GameSummary, Player, Room, RoomSettings } from "@/types";
import { GAMES } from "@/constants/games";
import { NICKNAME_KEY, ROOM_TTL_MS, SESSION_KEY } from "@/constants/room";
import { db } from "@/lib/firebase";
import { generateRoomCode, pickAvatar, sanitizeNickname } from "@/lib/utils";
import { getGameEngine } from "@/engine";

/** How often the host advances the game clock. */
const TICK_MS = 1000;

const NOT_CONFIGURED = "Firebase 尚未設定：請複製 .env.example 為 .env.local 並填入金鑰";

interface RoomContextValue {
  room: Room | null;
  player: Player | null;
  user: User | null;
  /** True until Firebase auth has resolved and any stored session has been checked. */
  loading: boolean;
  isHost: boolean;
  createRoom: (gameId: string, nickname: string, settings?: RoomSettings) => Promise<string>;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  endRoom: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  claimHost: () => Promise<void>;
  startGame: () => Promise<void>;
  endRound: () => Promise<void>;
  endGame: () => Promise<void>;
  switchGame: (newGameId: string) => Promise<void>;
  updateSettings: (patch: Partial<RoomSettings>) => Promise<void>;
  submitAction: (action: unknown) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/** What a host-only write needs, produced after the host check has passed. */
interface HostContext {
  database: Database;
  roomRef: DatabaseReference;
  current: Room;
  uid: string;
}

interface StoredSession {
  userId: string;
  roomCode: string;
  nickname: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed?.userId || !parsed?.roomCode) return null;
    return { userId: parsed.userId, roomCode: parsed.roomCode, nickname: parsed.nickname ?? "" };
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Private mode / quota — the room still works, it just won't survive a reload.
  }
}

function rememberNickname(nickname: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    /* ignore */
  }
}

const FALLBACK_SETTINGS: RoomSettings = {
  timer: 15,
  difficulty: "easy",
  rounds: 3,
  soundEnabled: true,
  ageMode: "family",
};

/** Normalise whatever the database hands back so a half-written room can't crash the UI. */
function parseRoom(data: Record<string, unknown> | null, roomCode: string): Room | null {
  if (!data) return null;
  return {
    id: (data.id as string) || roomCode,
    gameId: (data.gameId as string) || "",
    hostPlayerId: (data.hostPlayerId as string) || "",
    status: (data.status as Room["status"]) || "LOBBY",
    createdAt: (data.createdAt as number) || Date.now(),
    expiresAt: data.expiresAt as number | undefined,
    settings: (data.settings as RoomSettings) ?? FALLBACK_SETTINGS,
    players: (data.players as Record<string, Player>) ?? {},
    gameState: (data.gameState as Record<string, unknown>) ?? {},
    lastTickAt: data.lastTickAt as number | undefined,
    startedAt: data.startedAt as number | undefined,
  };
}

function maxPlayersFor(gameId: string): number {
  return GAMES.find((g) => g.id === gameId)?.maxPlayers ?? 20;
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  /**
   * One live listener per room. `onValue` returns an unsubscribe *function* —
   * the old code passed it to `off(ref, "value", unsub)`, which detaches
   * nothing, so every navigation stacked another listener on the same path.
   */
  const subscribe = useCallback(
    (roomCode: string, userId: string) => {
      if (!db) return;
      stopListening();
      unsubscribeRef.current = onValue(
        ref(db, `rooms/${roomCode}`),
        (snap) => {
          const next = parseRoom(snap.val() as Record<string, unknown> | null, roomCode);
          if (!next) {
            // Room deleted — host ended it, or it was swept.
            setRoom(null);
            setPlayer(null);
            writeSession(null);
            stopListening();
            return;
          }
          setRoom(next);
          setPlayer(next.players[userId] ?? null);
        },
        (error) => console.error("[partyverse] Room listener failed:", error),
      );
    },
    [stopListening],
  );

  useEffect(() => stopListening, [stopListening]);

  // Auth + session restore. Re-attaches the live listener, so a mid-game reload
  // lands back in the room instead of on a frozen one-shot snapshot.
  useEffect(() => {
    // Capture the module binding in a const: TypeScript only narrows `db` for
    // the local, not across the async boundary below.
    const database = db;
    if (!database) {
      setLoading(false);
      return;
    }
    const stored = readSession();
    let cancelled = false;

    const unsubscribeAuth = onAuthStateChanged(getAuth(), async (authUser) => {
      if (cancelled) return;
      setUser(authUser);

      if (!authUser || !stored || stored.userId !== authUser.uid) {
        setLoading(false);
        return;
      }
      try {
        const snap = await get(ref(database, `rooms/${stored.roomCode}/players/${stored.userId}`));
        if (cancelled) return;
        if (snap.exists()) subscribe(stored.roomCode, stored.userId);
        else writeSession(null);
      } catch (error) {
        console.error("[partyverse] Session restore failed:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, [subscribe]);

  /**
   * Presence: re-assert `isConnected` whenever the socket comes back, so a
   * player who drops and reconnects stops showing as offline in the lobby.
   */
  useEffect(() => {
    const roomId = room?.id;
    const uid = user?.uid;
    if (!db || !roomId || !uid) return;
    const playerRef = ref(db, `rooms/${roomId}/players/${uid}`);
    return onValue(ref(db, ".info/connected"), (snap) => {
      if (snap.val() === true) void update(playerRef, { isConnected: true }).catch(() => undefined);
    });
  }, [room?.id, user?.uid]);

  const ensureAuth = useCallback(async (): Promise<User> => {
    if (!db) throw new Error(NOT_CONFIGURED);
    const auth = getAuth();
    // Reuse the existing anonymous identity rather than minting a new one per join.
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  }, []);

  const createRoom = useCallback(
    async (gameId: string, rawNickname: string, settings?: RoomSettings): Promise<string> => {
      if (!db) throw new Error(NOT_CONFIGURED);
      const game = GAMES.find((g) => g.id === gameId);
      if (!game) throw new Error("找不到這個遊戲");
      if (!getGameEngine(gameId)) throw new Error(`${game.name} 尚未開放，敬請期待`);

      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "房主";
      const baseSettings: RoomSettings = { ...FALLBACK_SETTINGS, ...settings };

      // Allocate the code and create the room in one transaction, so two hosts
      // racing for the same code cannot both win it.
      let roomCode: string | null = null;
      for (let attempt = 0; attempt < 12 && roomCode === null; attempt++) {
        const candidate = generateRoomCode();
        const hostPlayer: Player = {
          id: authUser.uid,
          nickname,
          avatar: pickAvatar(nickname, []),
          isHost: true,
          isConnected: true,
          score: 0,
        };
        const now = Date.now();
        const result = await runTransaction(ref(db, `rooms/${candidate}`), (current) => {
          if (current !== null) return undefined; // code already taken — abort
          return {
            id: candidate,
            gameId,
            hostPlayerId: authUser.uid,
            status: "LOBBY",
            createdAt: now,
            expiresAt: now + ROOM_TTL_MS,
            settings: baseSettings,
            players: { [authUser.uid]: hostPlayer },
            gameState: {},
          };
        });
        if (result.committed) roomCode = candidate;
      }
      if (!roomCode) throw new Error("無法建立房間，請再試一次");

      markDisconnectedOnLeave(roomCode, authUser.uid);
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode, nickname });
      setUser(authUser);
      subscribe(roomCode, authUser.uid);
      return roomCode;
    },
    [ensureAuth, subscribe],
  );

  const joinRoom = useCallback(
    async (rawRoomCode: string, rawNickname: string) => {
      if (!db) throw new Error(NOT_CONFIGURED);
      const roomCode = rawRoomCode.toUpperCase();
      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "玩家";

      const result = await runTransaction(ref(db, `rooms/${roomCode}`), (current) => {
        if (current === null) return undefined; // no such room — abort
        const players = (current.players ?? {}) as Record<string, Player>;
        const existing = players[authUser.uid];
        if (!existing && Object.keys(players).length >= maxPlayersFor(String(current.gameId))) {
          throw new Error("房間已額滿");
        }
        const avatar = existing?.avatar ?? pickAvatar(nickname, Object.values(players).map((p) => p.avatar));
        return {
          ...current,
          players: {
            ...players,
            [authUser.uid]: {
              id: authUser.uid,
              nickname,
              avatar,
              isHost: Boolean(existing?.isHost),
              isConnected: true,
              score: existing?.score ?? 0,
            } satisfies Player,
          },
        };
      });

      if (!result.committed || result.snapshot.val() === null) throw new Error("找不到這個房間，請確認代碼");

      markDisconnectedOnLeave(roomCode, authUser.uid);
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode, nickname });
      setUser(authUser);
      subscribe(roomCode, authUser.uid);
    },
    [ensureAuth, subscribe],
  );

  const leaveRoom = useCallback(async () => {
    const uid = user?.uid;
    stopListening();
    if (db && room && uid) await remove(ref(db, `rooms/${room.id}/players/${uid}`)).catch(() => undefined);
    writeSession(null);
    setRoom(null);
    setPlayer(null);
  }, [room, stopListening, user?.uid]);

  const endRoom = useCallback(async () => {
    // Actually deletes the node. The old "End" button only navigated home and
    // left the room in the database forever.
    if (db && room) await remove(ref(db, `rooms/${room.id}`)).catch(() => undefined);
    stopListening();
    writeSession(null);
    setRoom(null);
    setPlayer(null);
  }, [room, stopListening]);

  /** Asserts the caller is the host and hands back everything the write needs. */
  const requireHost = useCallback((): HostContext => {
    if (!db) throw new Error(NOT_CONFIGURED);
    if (!room) throw new Error("尚未加入房間");
    if (!user || room.hostPlayerId !== user.uid) throw new Error("只有房主可以執行這個操作");
    return { database: db, roomRef: ref(db, `rooms/${room.id}`), current: room, uid: user.uid };
  }, [room, user]);

  const kickPlayer = useCallback(
    async (playerId: string) => {
      const { database, current } = requireHost();
      if (playerId === current.hostPlayerId) throw new Error("不能移除房主");
      await remove(ref(database, `rooms/${current.id}/players/${playerId}`));
    },
    [requireHost],
  );

  const claimHost = useCallback(async () => {
    if (!db || !room || !user) throw new Error("尚未加入房間");
    const uid = user.uid;
    await runTransaction(ref(db, `rooms/${room.id}`), (current) => {
      if (!current) return undefined;
      const players = (current.players ?? {}) as Record<string, Player>;
      // Only claimable when the host is genuinely gone.
      if (players[String(current.hostPlayerId)]?.isConnected) return undefined;
      return {
        ...current,
        hostPlayerId: uid,
        players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, { ...p, isHost: id === uid }])),
      };
    });
  }, [room, user]);

  /**
   * Start the game: seed `gameState` from the engine in the same write that
   * flips the status. This write was missing entirely — without it every client
   * read `gameState: {}` and sat on "Loading…" forever.
   */
  const startGame = useCallback(async () => {
    const { roomRef, current } = requireHost();
    const engine = getGameEngine(current.gameId);
    if (!engine) throw new Error("這個遊戲還沒有可玩的內容");

    const online = Object.values(current.players).filter((p) => p.isConnected !== false).length;
    const min = GAMES.find((g) => g.id === current.gameId)?.minPlayers ?? 2;
    if (online < min) throw new Error(`至少需要 ${min} 位玩家才能開始`);

    await runTransaction(roomRef, (current) => {
      if (!current || current.status !== "LOBBY") return undefined;
      return {
        ...current,
        status: "PLAYING",
        startedAt: Date.now(),
        lastTickAt: Date.now(),
        gameState: engine.createGame(current as unknown as Room),
      };
    });
  }, [requireHost]);

  const endRound = useCallback(async () => {
    const { roomRef } = requireHost();
    const engine = getGameEngine(room?.gameId ?? "");
    if (!engine) throw new Error("這個遊戲還沒有可玩的內容");
    await runTransaction(roomRef, (current) => {
      if (!current || current.status !== "PLAYING") return undefined;
      return { ...current, lastTickAt: Date.now(), gameState: engine.endRound(current as unknown as Room) };
    });
  }, [requireHost, room?.gameId]);

  const endGame = useCallback(async () => {
    const { roomRef } = requireHost();
    const engine = getGameEngine(room?.gameId ?? "");
    await runTransaction(roomRef, (current) => {
      if (!current || current.status !== "PLAYING") return undefined;
      const gameState = (current.gameState ?? {}) as Record<string, unknown>;
      const summary: GameSummary | null = engine ? engine.endGame(current as unknown as Room) : null;
      return {
        ...current,
        status: "RESULTS",
        gameState: summary
          ? { ...gameState, currentScores: summary.scores, achievements: summary.achievements, winnerId: summary.winnerId }
          : gameState,
      };
    });
  }, [requireHost, room?.gameId]);

  const switchGame = useCallback(
    async (newGameId: string) => {
      const { roomRef } = requireHost();
      if (!getGameEngine(newGameId)) {
        const name = GAMES.find((g) => g.id === newGameId)?.name ?? newGameId;
        throw new Error(`${name} 尚未開放，敬請期待`);
      }
      await update(roomRef, { gameId: newGameId, status: "LOBBY", gameState: {}, startedAt: null, lastTickAt: null });
    },
    [requireHost],
  );

  const updateSettings = useCallback(
    async (patch: Partial<RoomSettings>) => {
      const { database, current } = requireHost();
      await update(ref(database, `rooms/${current.id}/settings`), patch);
    },
    [requireHost],
  );

  /** Route a player action through the engine, transactionally. */
  const submitAction = useCallback(
    async (action: unknown) => {
      if (!db || !room || !user) throw new Error("尚未加入房間");
      const engine = getGameEngine(room.gameId);
      if (!engine) return;
      const uid = user.uid;
      await runTransaction(ref(db, `rooms/${room.id}`), (current) => {
        if (!current || current.status !== "PLAYING") return undefined;
        const before = current.gameState;
        const next = engine.handlePlayerAction(current as unknown as Room, uid, action);
        if (next === before) return undefined; // nothing changed — don't write
        return { ...current, gameState: next };
      });
    },
    [room, user],
  );

  /**
   * The host's browser owns the game clock. It ticks once a second and
   * *publishes* the result — the previous implementation ticked into local
   * component state only, so no other client ever saw the bomb move.
   */
  useEffect(() => {
    if (!db || !room || !user) return;
    if (room.status !== "PLAYING" || room.hostPlayerId !== user.uid) return;
    const engine = getGameEngine(room.gameId);
    if (!engine) return;

    const roomRef = ref(db, `rooms/${room.id}`);
    const id = setInterval(() => {
      void runTransaction(roomRef, (current) => {
        if (!current || current.status !== "PLAYING") return undefined;
        const next = engine.updateGameState(current as unknown as Room) as Record<string, unknown>;
        if (next.phase === "result") {
          const summary = engine.endGame({ ...(current as unknown as Room), gameState: next } as Room);
          return {
            ...current,
            status: "RESULTS",
            lastTickAt: Date.now(),
            gameState: {
              ...next,
              currentScores: summary.scores,
              achievements: summary.achievements,
              winnerId: summary.winnerId,
            },
          };
        }
        return { ...current, gameState: next, lastTickAt: Date.now() };
      }).catch((error) => console.error("[partyverse] tick failed:", error));
    }, TICK_MS);

    return () => clearInterval(id);
    // Re-created only when the identity of the game changes, not on every state tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.status, room?.hostPlayerId, room?.gameId, user?.uid]);

  const isHost = Boolean(user && room && room.hostPlayerId === user.uid);

  return (
    <RoomContext.Provider
      value={{
        room,
        player,
        user,
        loading,
        isHost,
        createRoom,
        joinRoom,
        leaveRoom,
        endRoom,
        kickPlayer,
        claimHost,
        startGame,
        endRound,
        endGame,
        switchGame,
        updateSettings,
        submitAction,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

/**
 * When this client's socket dies, flag the player offline. `onDisconnect` does
 * accept `serverTimestamp()` (transactions do not).
 */
function markDisconnectedOnLeave(roomCode: string, userId: string) {
  if (!db) return;
  void onDisconnect(ref(db, `rooms/${roomCode}/players/${userId}`))
    .update({ isConnected: false, leftAt: serverTimestamp() })
    .catch(() => undefined);
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}

export function usePlayer(): Player | null {
  return useRoom().player;
}

export function useCurrentRoom(): Room | null {
  return useRoom().room;
}
