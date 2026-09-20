"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  get,
  goOnline,
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
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import type { Player, ReactionItem, Room, RoomSettings } from "@/types";
import { GAMES } from "@/constants/games";
import { NICKNAME_KEY, ROOM_TTL_MS, SESSION_KEY } from "@/constants/room";
import { db, auth as authInstance } from "@/lib/firebase";
import {
  deleteLocalRoom,
  getLocalRoom,
  getLocalUserId,
  saveLocalRoom,
  subscribeLocalRoom,
} from "@/lib/localRoomStore";
import { generateRoomCode, pickAvatar, sanitizeNickname } from "@/lib/utils";
import { getGameEngine } from "@/engine";
import { sfx } from "@/lib/sound";

/** How often the host advances the game clock. */
const TICK_MS = 1000;

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "local";

interface RoomContextValue {
  room: Room | null;
  player: Player | null;
  user: User | null;
  /** True until Firebase auth has resolved and any stored session has been checked. */
  loading: boolean;
  isHost: boolean;
  isLocalMode: boolean;
  connectionStatus: ConnectionStatus;
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
  toggleReady: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
  addMockPlayer: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/** What a host-only write needs in Firebase mode. */
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

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed?.userId || !parsed?.roomCode) return null;
    return {
      userId: String(parsed.userId),
      roomCode: String(parsed.roomCode),
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : String(parsed.nickname ?? ""),
    };
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
    localStorage.setItem(NICKNAME_KEY, JSON.stringify(nickname));
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
  const rawPlayers = (data.players ?? {}) as Record<string, unknown>;
  const cleanPlayers: Record<string, Player> = {};
  if (typeof rawPlayers === "object" && rawPlayers !== null) {
    for (const [id, p] of Object.entries(rawPlayers)) {
      if (p && typeof p === "object") {
        const playerObj = p as Partial<Player>;
        cleanPlayers[id] = {
          id: String(playerObj.id ?? id),
          nickname: String(playerObj.nickname ?? "玩家"),
          avatar: String(playerObj.avatar ?? "👾"),
          isHost: Boolean(playerObj.isHost),
          isConnected: playerObj.isConnected !== false,
          isReady: Boolean(playerObj.isReady),
          score: Number(playerObj.score) || 0,
          leftAt: playerObj.leftAt,
        };
      }
    }
  }

  const rawReactions = (data.reactions ?? {}) as Record<string, unknown>;
  const cleanReactions: Record<string, ReactionItem> = {};
  const now = Date.now();
  if (typeof rawReactions === "object" && rawReactions !== null) {
    for (const [id, r] of Object.entries(rawReactions)) {
      if (r && typeof r === "object") {
        const rec = r as Partial<ReactionItem>;
        // Keep reactions active for 6 seconds
        if (now - Number(rec.at || 0) < 6000) {
          cleanReactions[id] = {
            id: String(rec.id ?? id),
            emoji: String(rec.emoji ?? "🎉"),
            nickname: String(rec.nickname ?? "玩家"),
            at: Number(rec.at) || now,
          };
        }
      }
    }
  }

  return {
    id: (data.id as string) || roomCode,
    gameId: (data.gameId as string) || "",
    hostPlayerId: (data.hostPlayerId as string) || "",
    status: (data.status as Room["status"]) || "LOBBY",
    createdAt: (data.createdAt as number) || Date.now(),
    expiresAt: data.expiresAt as number | undefined,
    settings: (data.settings as RoomSettings) ?? FALLBACK_SETTINGS,
    players: cleanPlayers,
    reactions: cleanReactions,
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(db ? "connecting" : "local");

  const isLocalMode = !db || connectionStatus === "local";
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  /**
   * One live listener per room. Supports both Firebase RTDB and Local In-Memory bus.
   */
  const subscribe = useCallback(
    (roomCode: string, userId: string) => {
      stopListening();
      if (db && connectionStatus !== "local") {
        unsubscribeRef.current = onValue(
          ref(db, `rooms/${roomCode}`),
          (snap) => {
            const next = parseRoom(snap.val() as Record<string, unknown> | null, roomCode);
            if (!next) {
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
      } else {
        unsubscribeRef.current = subscribeLocalRoom(roomCode, (next) => {
          if (!next) {
            setRoom(null);
            setPlayer(null);
            writeSession(null);
            stopListening();
            return;
          }
          const clean = parseRoom(next as unknown as Record<string, unknown>, roomCode);
          setRoom(clean);
          setPlayer(clean?.players[userId] ?? null);
        });
      }
    },
    [stopListening, connectionStatus],
  );

  useEffect(() => stopListening, [stopListening]);

  // Auth + session restore.
  useEffect(() => {
    const database = db;
    const stored = readSession();
    let cancelled = false;

    if (!database) {
      // Local demo mode: assign mock user and check stored session
      const localUid = getLocalUserId();
      const mockUser = { uid: localUid, isAnonymous: true } as unknown as User;
      setUser(mockUser);
      setConnectionStatus("local");
      if (stored) {
        const localRoom = getLocalRoom(stored.roomCode);
        if (localRoom && localRoom.players?.[stored.userId]) {
          subscribe(stored.roomCode, stored.userId);
        } else {
          writeSession(null);
        }
      }
      setLoading(false);
      return;
    }

    if (!authInstance) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(authInstance, async (authUser) => {
      if (cancelled) return;
      setUser(authUser);

      if (!authUser || !stored || stored.userId !== authUser.uid) {
        setLoading(false);
        return;
      }
      try {
        const snap = await withTimeout(
          get(ref(database, `rooms/${stored.roomCode}/players/${stored.userId}`)),
          4000,
          "Session restore timeout",
        );
        if (cancelled) return;
        if (snap.exists()) subscribe(stored.roomCode, stored.userId);
        else writeSession(null);
      } catch (error) {
        console.warn("[partyverse] Firebase session restore check:", error);
        // Fallback check in local room store
        const localRoom = getLocalRoom(stored.roomCode);
        if (localRoom && localRoom.players?.[stored.userId]) {
          setConnectionStatus("local");
          subscribe(stored.roomCode, stored.userId);
        } else {
          writeSession(null);
        }
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
   * Presence & Reconnection management:
   * 1. Re-assert `isConnected` whenever socket reconnects.
   * 2. Re-attach `onDisconnect` upon every reconnection so future drops trigger clean status.
   * 3. Handle `visibilitychange` and `online` events to immediately wake up sleeping WebSockets on mobile.
   */
  useEffect(() => {
    const database = db;
    if (!database) {
      setConnectionStatus("local");
      return;
    }

    const handleWake = () => {
      if (!document.hidden) {
        try {
          goOnline(database);
        } catch {
          // ignore
        }
      }
    };

    const handleOnline = () => {
      try {
        goOnline(database);
      } catch {
        // ignore
      }
    };

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("online", handleOnline);

    const roomId = room?.id;
    const uid = user?.uid;
    const connectedRef = ref(database, ".info/connected");

    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      const isConnected = snap.val() === true;
      if (isConnected) {
        setConnectionStatus("connected");
        if (roomId && uid) {
          const playerRef = ref(database, `rooms/${roomId}/players/${uid}`);
          void update(playerRef, { isConnected: true }).catch(() => undefined);
          void onDisconnect(playerRef)
            .update({ isConnected: false, leftAt: serverTimestamp() })
            .catch(() => undefined);
        }
      } else {
        setConnectionStatus("reconnecting");
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("online", handleOnline);
      unsubscribeConnected();
    };
  }, [room?.id, user?.uid]);

  const ensureAuth = useCallback(async (): Promise<User> => {
    if (!db || !authInstance) {
      const localUid = getLocalUserId();
      const mockUser = { uid: localUid, isAnonymous: true } as unknown as User;
      setUser(mockUser);
      return mockUser;
    }
    if (authInstance.currentUser) return authInstance.currentUser;

    try {
      const cred = await withTimeout(
        signInAnonymously(authInstance),
        6000,
        "Firebase 匿名認證逾時",
      );
      return cred.user;
    } catch (err) {
      console.warn("[partyverse] Firebase Auth failed, falling back to local user:", err);
      const localUid = getLocalUserId();
      const mockUser = { uid: localUid, isAnonymous: true } as unknown as User;
      setUser(mockUser);
      return mockUser;
    }
  }, []);

  const createRoom = useCallback(
    async (gameId: string, rawNickname: string, settings?: RoomSettings): Promise<string> => {
      const game = GAMES.find((g) => g.id === gameId);
      if (!game) throw new Error("找不到這個遊戲");
      if (!getGameEngine(gameId)) throw new Error(`${game.name} 尚未開放，敬請期待`);

      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "房主";
      const baseSettings: RoomSettings = { ...FALLBACK_SETTINGS, ...settings };

      // Attempt Firebase mode first if available
      if (db && connectionStatus !== "local") {
        try {
          let roomCode: string | null = null;
          for (let attempt = 0; attempt < 8 && roomCode === null; attempt++) {
            const candidate = generateRoomCode();
            const hostPlayer: Player = {
              id: authUser.uid,
              nickname,
              avatar: pickAvatar(nickname, []),
              isHost: true,
              isConnected: true,
              isReady: true,
              score: 0,
            };
            const now = Date.now();
            const result = await withTimeout(
              runTransaction(ref(db, `rooms/${candidate}`), (current) => {
                if (current !== null) return undefined; // code already taken
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
              }),
              7000,
              "Firebase 房間建立連線逾時",
            );
            if (result.committed) roomCode = candidate;
          }

          if (roomCode) {
            markDisconnectedOnLeave(roomCode, authUser.uid);
            rememberNickname(nickname);
            writeSession({ userId: authUser.uid, roomCode, nickname });
            setUser(authUser);
            subscribe(roomCode, authUser.uid);
            return roomCode;
          }
        } catch (firebaseErr) {
          console.warn("[partyverse] Firebase createRoom failed, auto-falling back to local mode:", firebaseErr);
          setConnectionStatus("local");
        }
      }

      // Local mode fallback
      const candidate = generateRoomCode();
      const hostPlayer: Player = {
        id: authUser.uid,
        nickname,
        avatar: pickAvatar(nickname, []),
        isHost: true,
        isConnected: true,
        isReady: true,
        score: 0,
      };
      const now = Date.now();
      const newRoom: Room = {
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
      saveLocalRoom(newRoom);
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode: candidate, nickname });
      setUser(authUser);
      subscribe(candidate, authUser.uid);
      return candidate;
    },
    [ensureAuth, subscribe, connectionStatus],
  );

  const joinRoom = useCallback(
    async (rawRoomCode: string, rawNickname: string) => {
      const roomCode = rawRoomCode.toUpperCase();
      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "玩家";

      // Attempt Firebase mode
      if (db && connectionStatus !== "local") {
        try {
          const result = await withTimeout(
            runTransaction(ref(db, `rooms/${roomCode}`), (current) => {
              if (current === null) return undefined; // no such room
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
                    isReady: Boolean(existing?.isReady),
                    score: existing?.score ?? 0,
                  } satisfies Player,
                },
              };
            }),
            7000,
            "加入房間連線逾時",
          );

          if (result.committed && result.snapshot.val() !== null) {
            markDisconnectedOnLeave(roomCode, authUser.uid);
            rememberNickname(nickname);
            writeSession({ userId: authUser.uid, roomCode, nickname });
            setUser(authUser);
            subscribe(roomCode, authUser.uid);
            return;
          }
        } catch (firebaseErr) {
          console.warn("[partyverse] Firebase joinRoom error or not found, testing local store:", firebaseErr);
        }
      }

      // Local mode fallback
      const current = getLocalRoom(roomCode);
      if (!current) throw new Error("找不到這個房間，請確認代碼或網路連線");
      const players = current.players ?? {};
      const existing = players[authUser.uid];
      if (!existing && Object.keys(players).length >= maxPlayersFor(String(current.gameId))) {
        throw new Error("房間已額滿");
      }
      const avatar = existing?.avatar ?? pickAvatar(nickname, Object.values(players).map((p) => p.avatar));
      const updated: Room = {
        ...current,
        players: {
          ...players,
          [authUser.uid]: {
            id: authUser.uid,
            nickname,
            avatar,
            isHost: Boolean(existing?.isHost),
            isConnected: true,
            isReady: Boolean(existing?.isReady),
            score: existing?.score ?? 0,
          },
        },
      };
      setConnectionStatus("local");
      saveLocalRoom(updated);
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode, nickname });
      setUser(authUser);
      subscribe(roomCode, authUser.uid);
    },
    [ensureAuth, subscribe, connectionStatus],
  );

  const leaveRoom = useCallback(async () => {
    const uid = user?.uid;
    const currentRoom = room;
    stopListening();
    setRoom(null);
    setPlayer(null);
    writeSession(null);

    if (!currentRoom || !uid) return;

    if (db && connectionStatus !== "local") {
      try {
        await update(ref(db, `rooms/${currentRoom.id}/players/${uid}`), {
          isConnected: false,
          leftAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    } else {
      const local = getLocalRoom(currentRoom.id);
      if (local && local.players?.[uid]) {
        saveLocalRoom({
          ...local,
          players: {
            ...local.players,
            [uid]: { ...local.players[uid], isConnected: false, leftAt: Date.now() },
          },
        });
      }
    }
  }, [room, user, stopListening, connectionStatus]);

  const endRoom = useCallback(async () => {
    const currentRoom = room;
    if (!currentRoom) return;

    stopListening();
    setRoom(null);
    setPlayer(null);
    writeSession(null);

    if (db && connectionStatus !== "local") {
      try {
        await remove(ref(db, `rooms/${currentRoom.id}`));
      } catch {
        // ignore
      }
    } else {
      deleteLocalRoom(currentRoom.id);
    }
  }, [room, stopListening, connectionStatus]);

  const requireHost = useCallback((): HostContext => {
    if (!room) throw new Error("尚未加入房間");
    if (!user) throw new Error("尚未登入");
    if (room.hostPlayerId !== user.uid) throw new Error("只有房主可以執行此操作");
    if (!db || connectionStatus === "local") {
      return {
        database: null as unknown as Database,
        roomRef: null as unknown as DatabaseReference,
        current: room,
        uid: user.uid,
      };
    }
    return {
      database: db,
      roomRef: ref(db, `rooms/${room.id}`),
      current: room,
      uid: user.uid,
    };
  }, [room, user, connectionStatus]);

  const kickPlayer = useCallback(
    async (playerId: string) => {
      const { current } = requireHost();
      if (playerId === current.hostPlayerId) throw new Error("不能移除房主");

      if (db && connectionStatus !== "local") {
        await remove(ref(db, `rooms/${current.id}/players/${playerId}`));
      } else {
        const local = getLocalRoom(current.id);
        if (local && local.players?.[playerId]) {
          const { [playerId]: _, ...rest } = local.players;
          saveLocalRoom({ ...local, players: rest });
        }
      }
    },
    [requireHost, connectionStatus],
  );

  const claimHost = useCallback(async () => {
    if (!room || !user) throw new Error("尚未加入房間");
    const uid = user.uid;
    if (db && connectionStatus !== "local") {
      await runTransaction(ref(db, `rooms/${room.id}`), (current) => {
        if (!current) return undefined;
        const players = (current.players ?? {}) as Record<string, Player>;
        if (players[String(current.hostPlayerId)]?.isConnected) return undefined;
        return {
          ...current,
          hostPlayerId: uid,
          players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, { ...p, isHost: id === uid }])),
        };
      });
    } else {
      const local = getLocalRoom(room.id);
      if (!local) return;
      const players = local.players ?? {};
      const updated: Room = {
        ...local,
        hostPlayerId: uid,
        players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, { ...p, isHost: id === uid }])),
      };
      saveLocalRoom(updated);
    }
  }, [room, user, connectionStatus]);

  const startGame = useCallback(async () => {
    const { current } = requireHost();
    const engine = getGameEngine(current.gameId);
    if (!engine) throw new Error("這個遊戲還沒有可玩的內容");

    const online = Object.values(current.players).filter((p) => p.isConnected !== false).length;
    const min = GAMES.find((g) => g.id === current.gameId)?.minPlayers ?? 2;
    if (online < min) throw new Error(`至少需要 ${min} 位玩家才能開始`);

    if (db && connectionStatus !== "local") {
      const { roomRef } = requireHost();
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
    } else {
      const local = getLocalRoom(current.id);
      if (!local || local.status !== "LOBBY") return;
      const updated: Room = {
        ...local,
        status: "PLAYING",
        startedAt: Date.now(),
        lastTickAt: Date.now(),
        gameState: engine.createGame(local),
      };
      saveLocalRoom(updated);
    }
  }, [requireHost, connectionStatus]);

  const endRound = useCallback(async () => {
    const { current } = requireHost();
    const engine = getGameEngine(room?.gameId ?? "");
    if (!engine) throw new Error("這個遊戲還沒有可玩的內容");

    if (db && connectionStatus !== "local") {
      const { roomRef } = requireHost();
      await runTransaction(roomRef, (current) => {
        if (!current || current.status !== "PLAYING") return undefined;
        return { ...current, lastTickAt: Date.now(), gameState: engine.endRound(current as unknown as Room) };
      });
    } else {
      const local = getLocalRoom(current.id);
      if (!local || local.status !== "PLAYING") return;
      const updated: Room = {
        ...local,
        lastTickAt: Date.now(),
        gameState: engine.endRound(local),
      };
      saveLocalRoom(updated);
    }
  }, [requireHost, room?.gameId, connectionStatus]);

  const endGame = useCallback(async () => {
    const { current } = requireHost();
    const engine = getGameEngine(room?.gameId ?? "");
    if (!engine) throw new Error("這個遊戲還沒有可玩的內容");

    const summary = engine.endGame(current);

    if (db && connectionStatus !== "local") {
      const { roomRef } = requireHost();
      await runTransaction(roomRef, (current) => {
        if (!current) return undefined;
        return {
          ...current,
          status: "RESULTS",
          lastTickAt: Date.now(),
          gameState: {
            ...(current.gameState as Record<string, unknown>),
            currentScores: summary.scores,
            achievements: summary.achievements,
            winnerId: summary.winnerId,
          },
        };
      });
    } else {
      const local = getLocalRoom(current.id);
      if (!local) return;
      const updated: Room = {
        ...local,
        status: "RESULTS",
        lastTickAt: Date.now(),
        gameState: {
          ...local.gameState,
          currentScores: summary.scores,
          achievements: summary.achievements,
          winnerId: summary.winnerId,
        },
      };
      saveLocalRoom(updated);
    }
  }, [requireHost, room?.gameId, connectionStatus]);

  const switchGame = useCallback(
    async (newGameId: string) => {
      const { current } = requireHost();
      const game = GAMES.find((g) => g.id === newGameId);
      if (!game) throw new Error("找不到這個遊戲");

      if (db && connectionStatus !== "local") {
        const { roomRef } = requireHost();
        await update(roomRef, {
          gameId: newGameId,
          status: "LOBBY",
          gameState: {},
          startedAt: null,
          lastTickAt: null,
        });
      } else {
        const local = getLocalRoom(current.id);
        if (local) {
          saveLocalRoom({
            ...local,
            gameId: newGameId,
            status: "LOBBY",
            gameState: {},
            startedAt: undefined,
            lastTickAt: undefined,
          });
        }
      }
    },
    [requireHost, connectionStatus],
  );

  const updateSettings = useCallback(
    async (patch: Partial<RoomSettings>) => {
      const { current } = requireHost();
      if (db && connectionStatus !== "local") {
        await update(ref(db, `rooms/${current.id}/settings`), patch);
      } else {
        const local = getLocalRoom(current.id);
        if (local) {
          saveLocalRoom({ ...local, settings: { ...local.settings, ...patch } });
        }
      }
    },
    [requireHost, connectionStatus],
  );

  const submitAction = useCallback(
    async (action: unknown) => {
      if (!room || !user) throw new Error("尚未加入房間");
      const engine = getGameEngine(room.gameId);
      if (!engine) return;
      const uid = user.uid;

      if (db && connectionStatus !== "local") {
        await runTransaction(ref(db, `rooms/${room.id}/gameState`), (current) => {
          if (!current) return undefined;
          const mockRoom = { ...room, gameState: current } as Room;
          const next = engine.handlePlayerAction(mockRoom, uid, action);
          return next;
        });
      } else {
        const local = getLocalRoom(room.id);
        if (!local || local.status !== "PLAYING") return;
        const next = engine.handlePlayerAction(local, uid, action);
        saveLocalRoom({ ...local, gameState: next });
      }
    },
    [room, user, connectionStatus],
  );

  const toggleReady = useCallback(async () => {
    if (!room || !user || !player) return;
    const nextState = !player.isReady;
    if (nextState) sfx.playReady();

    if (db && connectionStatus !== "local") {
      try {
        await update(ref(db, `rooms/${room.id}/players/${user.uid}`), { isReady: nextState });
      } catch (err) {
        console.warn("[partyverse] toggleReady error:", err);
      }
    } else {
      const local = getLocalRoom(room.id);
      if (local && local.players?.[user.uid]) {
        saveLocalRoom({
          ...local,
          players: {
            ...local.players,
            [user.uid]: { ...local.players[user.uid], isReady: nextState },
          },
        });
      }
    }
  }, [room, user, player, connectionStatus]);

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!room || !user) return;
      sfx.playPop();
      const id = `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const reaction: ReactionItem = {
        id,
        emoji,
        nickname: player?.nickname ?? "玩家",
        at: Date.now(),
      };

      if (db && connectionStatus !== "local") {
        try {
          await update(ref(db, `rooms/${room.id}/reactions`), { [id]: reaction });
          setTimeout(() => {
            if (db) void remove(ref(db, `rooms/${room.id}/reactions/${id}`)).catch(() => undefined);
          }, 6000);
        } catch (err) {
          console.warn("[partyverse] sendReaction error:", err);
        }
      } else {
        const local = getLocalRoom(room.id);
        if (local) {
          const nextReactions = { ...(local.reactions ?? {}), [id]: reaction };
          saveLocalRoom({ ...local, reactions: nextReactions });
          setTimeout(() => {
            const fresh = getLocalRoom(room.id);
            if (fresh && fresh.reactions?.[id]) {
              const { [id]: _, ...rest } = fresh.reactions;
              saveLocalRoom({ ...fresh, reactions: rest });
            }
          }, 6000);
        }
      }
    },
    [room, user, player, connectionStatus],
  );

  const addMockPlayer = useCallback(async () => {
    if (!room) return;
    const BOT_AVATARS = ["🤖", "🐧", "🐻", "🦊", "🦥", "🐱", "🦄", "🐼"];
    const BOT_NAMES = ["阿呆機器人 🤖", "心機企鵝 🐧", "無敵小熊 🐻", "神抽狐狸 🦊", "躺平樹懶 🦥"];
    const count = Object.keys(room.players).length;
    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nickname = BOT_NAMES[count % BOT_NAMES.length] || `機器人 ${count + 1}`;
    const avatar = BOT_AVATARS[count % BOT_AVATARS.length];
    const newBot: Player = {
      id: botId,
      nickname,
      avatar,
      isHost: false,
      isConnected: true,
      isReady: true,
      score: 0,
    };
    sfx.playChime();

    if (db && connectionStatus !== "local") {
      try {
        await update(ref(db, `rooms/${room.id}/players/${botId}`), newBot);
      } catch (err) {
        console.warn("[partyverse] addMockPlayer error:", err);
      }
    } else {
      const local = getLocalRoom(room.id);
      if (local) {
        saveLocalRoom({
          ...local,
          players: { ...local.players, [botId]: newBot },
        });
      }
    }
  }, [room, connectionStatus]);

  // Authoritative host game clock
  useEffect(() => {
    if (!room || !user) return;
    if (room.status !== "PLAYING" || room.hostPlayerId !== user.uid) return;
    const engine = getGameEngine(room.gameId);
    if (!engine) return;

    const roomId = room.id;

    const id = setInterval(() => {
      if (db && connectionStatus !== "local") {
        void runTransaction(ref(db, `rooms/${roomId}`), (current) => {
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
      } else {
        const local = getLocalRoom(roomId);
        if (!local || local.status !== "PLAYING") return;
        const next = engine.updateGameState(local) as Record<string, unknown>;
        if (next.phase === "result") {
          const summary = engine.endGame({ ...local, gameState: next } as Room);
          const updated: Room = {
            ...local,
            status: "RESULTS",
            lastTickAt: Date.now(),
            gameState: {
              ...next,
              currentScores: summary.scores,
              achievements: summary.achievements,
              winnerId: summary.winnerId,
            },
          };
          saveLocalRoom(updated);
        } else {
          saveLocalRoom({ ...local, gameState: next, lastTickAt: Date.now() });
        }
      }
    }, TICK_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.status, room?.hostPlayerId, room?.gameId, user?.uid, connectionStatus]);

  const isHost = Boolean(user && room && room.hostPlayerId === user.uid);

  return (
    <RoomContext.Provider
      value={{
        room,
        player,
        user,
        loading,
        isHost,
        isLocalMode,
        connectionStatus,
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
        toggleReady,
        sendReaction,
        addMockPlayer,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

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