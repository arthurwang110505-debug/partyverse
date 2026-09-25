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
  updateLocalRoom,
} from "@/lib/localRoomStore";
import { joinRoomOnFirebase } from "@/lib/firebaseJoin";
import {
  forgetRoomSession,
  recallEndedRoom,
  recallRoomSession,
  rememberEndedRoom,
  rememberRoomSession,
} from "@/lib/roomSession";
import { generateRoomCode, pickAvatar, sanitizeNickname } from "@/lib/utils";
import { getGameEngine } from "@/engine";
import { sfx } from "@/lib/sound";
import { parseRoom } from "@/lib/roomData";
import { normalizeSettings } from "@/constants/gameSettings";
import {
  advanceRoomGame,
  applyRoomAction,
  actionContextKey,
  claimRoomHost,
  endRoomGame,
  restartRoomGame,
  returnRoomToLobby,
  startRoomGame,
} from "@/lib/gameSession";
import { isParticipant } from "@/engine/participants";
import { setServerOffset } from "@/engine/clock";

/** How often the host advances the game clock. */
const TICK_MS = 1000;

/**
 * How long a stored session waits for Firebase to hand back the persisted
 * anonymous user before we give up and treat the tab as not signed in.
 */
const AUTH_RESTORE_GRACE_MS = 3000;

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "local";

interface RoomContextValue {
  room: Room | null;
  player: Player | null;
  user: User | null;
  /** True until Firebase auth has resolved and any stored session has been checked. */
  loading: boolean;
  /**
   * Room the provider is currently opening (create, join or session restore) but
   * has not received a snapshot for yet. `/room/<code>` screens must wait — not
   * bounce to the join form — while this names the code in the URL.
   */
  pendingRoomCode: string | null;
  /**
   * Room this tab was in that no longer exists — ended here or by another
   * device. `/room/<code>` screens send these visitors home, not to `/join`.
   */
  lostRoomCode: string | null;
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
  rematch: () => Promise<void>;
  endGame: () => Promise<void>;
  switchGame: (newGameId: string) => Promise<void>;
  updateSettings: (patch: Partial<RoomSettings>) => Promise<void>;
  submitAction: (action: unknown) => Promise<void>;
  toggleReady: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/** Host identity captured for a transaction; ownership is rechecked inside it. */
interface HostContext {
  current: Room;
  uid: string;
}

interface StoredSession {
  userId: string;
  roomCode: string;
  nickname: string;
  mode?: "local" | "firebase";
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
      mode: parsed.mode,
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

function maxPlayersFor(gameId: string): number {
  return GAMES.find((g) => g.id === gameId)?.maxPlayers ?? 20;
}

/** A room the tab was already in when this provider mounted, if any. */
function readResumableSession(): ReturnType<typeof recallRoomSession> {
  return typeof window === "undefined" ? null : recallRoomSession();
}

export function RoomProvider({ children }: { children: ReactNode }) {
  // Seeded from the tab's last room: `/create` and `/room` mount different
  // providers, so without this the host screen would come up empty right after a
  // successful create and the room gate would bounce the host to /join/<code>.
  const [room, setRoom] = useState<Room | null>(() => readResumableSession()?.room ?? null);
  const [player, setPlayer] = useState<Player | null>(() => readResumableSession()?.player ?? null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => readResumableSession() === null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  // Rooms this tab was in that are now gone. `/room/<code>` screens use it to go
  // home rather than offering the join form for a code that no longer exists.
  // Seeded from the tab (not the provider) so it survives the create → host and
  // back-button remounts too.
  const [lostRoomCode, setLostRoomCode] = useState<string | null>(() =>
    typeof window === "undefined" ? null : recallEndedRoom(),
  );
  /** Records the room as gone for this tab as well as this provider instance. */
  const markRoomLost = useCallback((roomCode: string) => {
    rememberEndedRoom(roomCode);
    setLostRoomCode(roomCode);
  }, []);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(db ? "connecting" : "local");

  const [isLocalMode, setIsLocalMode] = useState(!db);
  const localModeRef = useRef(!db);
  const serverOffset = useRef(0);
  const enterLocalMode = useCallback(() => {
    localModeRef.current = true;
    setIsLocalMode(true);
    setConnectionStatus("local");
  }, []);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  /** Clears the handshake flag only if it still refers to the same room. */
  const settlePendingRoom = useCallback((roomCode: string) => {
    setPendingRoomCode((current) =>
      current && current.trim().toUpperCase() === roomCode.trim().toUpperCase() ? null : current,
    );
  }, []);

  /**
   * One live listener per room. Supports both Firebase RTDB and Local In-Memory bus.
   * `onSettled` fires once, when the first snapshot (or failure) arrives.
   */
  const subscribe = useCallback(
    (roomCode: string, userId: string, onSettled?: () => void) => {
      stopListening();
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        onSettled?.();
      };
      if (db && !localModeRef.current) {
        unsubscribeRef.current = onValue(
          ref(db, `rooms/${roomCode}`),
          (snap) => {
            const next = parseRoom(snap.val() as Record<string, unknown> | null, roomCode);
            if (!next) {
              forgetRoomSession();
              setRoom(null);
              setPlayer(null);
              markRoomLost(roomCode);
              writeSession(null);
              stopListening();
              settle();
              return;
            }
            const nextPlayer = next.players[userId] ?? null;
            rememberRoomSession(next, nextPlayer);
            setRoom(next);
            setPlayer(nextPlayer);
            setLostRoomCode(null);
            settle();
          },
          (error) => {
            console.error("[partyverse] Room listener failed:", error);
            settle();
          },
        );
      } else {
        unsubscribeRef.current = subscribeLocalRoom(roomCode, (next) => {
          const clean = next ? parseRoom(next as unknown as Record<string, unknown>, roomCode) : null;
          if (!clean) {
            forgetRoomSession();
            setRoom(null);
            setPlayer(null);
            markRoomLost(roomCode);
            writeSession(null);
            stopListening();
            settle();
            return;
          }
          const cleanPlayer = clean.players[userId] ?? null;
          rememberRoomSession(clean, cleanPlayer);
          setRoom(clean);
          setPlayer(cleanPlayer);
          setLostRoomCode(null);
          settle();
        });
      }
    },
    [markRoomLost, stopListening],
  );

  /**
   * Mark a room as "being opened" before its first snapshot can arrive, so the
   * room screens wait for it instead of deciding the visitor is an outsider.
   */
  const openRoom = useCallback(
    (roomCode: string, userId: string, onSettled?: () => void) => {
      setPendingRoomCode(roomCode);
      subscribe(roomCode, userId, () => {
        settlePendingRoom(roomCode);
        onSettled?.();
      });
    },
    [subscribe, settlePendingRoom],
  );

  useEffect(() => stopListening, [stopListening]);

  // Auth + session restore.
  useEffect(() => {
    const database = db;
    const stored = readSession();
    let cancelled = false;
    let authGrace: ReturnType<typeof setTimeout> | null = null;

    if (!database || stored?.mode === "local" || (stored && !stored.mode && getLocalRoom(stored.roomCode))) {
      enterLocalMode();
      // Local demo mode: assign mock user and check stored session
      const localUid = getLocalUserId(stored?.userId);
      const mockUser = { uid: localUid, isAnonymous: true } as unknown as User;
      setUser(mockUser);
      setConnectionStatus("local");
      if (stored) {
        const localRoom = getLocalRoom(stored.roomCode);
        if (localRoom && localRoom.players?.[stored.userId]) {
          openRoom(stored.roomCode, stored.userId);
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

      if (!authUser && stored) {
        // Firebase emits a null state until the persisted anonymous user has been
        // read back (IndexedDB on a TV can be slower than the first paint). The
        // next emission carries that user, so hold the door: judging the stored
        // session now is what drops a host on the join form.
        if (authGrace === null) authGrace = setTimeout(() => !cancelled && setLoading(false), AUTH_RESTORE_GRACE_MS);
        return;
      }
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
        if (snap.exists()) {
          // Wait for the room itself, not just the membership record: clearing
          // `loading` with the room still missing is what bounced hosts to
          // /join/<code> right after they created a room.
          await withTimeout(
            new Promise<void>((resolve) => openRoom(stored.roomCode, stored.userId, resolve)),
            6000,
            "Room snapshot timeout",
          );
        } else {
          writeSession(null);
        }
      } catch (error) {
        // The membership probe can fail for reasons that are not "you are not in
        // this room": rules that deny ancestor reads, or a TV whose connection
        // dropped between two round trips. Let the room snapshot decide, instead
        // of dropping a valid session and leaving the host on the join form.
        console.warn("[partyverse] Firebase session restore check:", error);
        if (cancelled) return;
        try {
          await withTimeout(
            new Promise<void>((resolve) => openRoom(stored.roomCode, stored.userId, resolve)),
            6000,
            "Room snapshot timeout",
          );
        } catch {
          // Still nothing: the session is not usable, and keeping it would make
          // every future mount repeat this handshake.
          if (!cancelled) writeSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          settlePendingRoom(stored.roomCode);
        }
      }
    });

    return () => {
      cancelled = true;
      if (authGrace !== null) clearTimeout(authGrace);
      unsubscribeAuth();
    };
  }, [subscribe, openRoom, settlePendingRoom, enterLocalMode]);

  /**
   * Presence & Reconnection management:
   * 1. Re-assert `isConnected` whenever socket reconnects.
   * 2. Re-attach `onDisconnect` upon every reconnection so future drops trigger clean status.
   * 3. Handle `visibilitychange` and `online` events to immediately wake up sleeping WebSockets on mobile.
   */
  useEffect(() => {
    const database = db;
    if (!database || isLocalMode) {
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
    const unsubscribeOffset = onValue(ref(database, ".info/serverTimeOffset"), (snap) => {
      serverOffset.current = Number(snap.val()) || 0;
      setServerOffset(serverOffset.current);
    });
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
      unsubscribeOffset();
    };
  }, [room?.id, user?.uid, isLocalMode]);

  const ensureAuth = useCallback(async (): Promise<User> => {
    if (!db || !authInstance || localModeRef.current) {
      const localUid = getLocalUserId();
      const mockUser = { uid: localUid, isAnonymous: true } as unknown as User;
      setUser(mockUser);
      return mockUser;
    }
    if (authInstance.currentUser) return authInstance.currentUser;

    try {
      const cred = await withTimeout(signInAnonymously(authInstance), 6000, "Firebase 匿名認證逾時");
      return cred.user;
    } catch {
      throw new Error("無法連上 Firebase 匿名登入，請檢查網路與專案設定後重試。");
    }
  }, []);

  /**
   * Show a room we already hold the full record for (create/join result) without
   * waiting for a database round trip. `rememberRoomSession` additionally keeps
   * it available to the provider that the next route segment will mount.
   */
  const adoptRoom = useCallback((next: Room, nextPlayer: Player | null) => {
    rememberRoomSession(next, nextPlayer);
    setRoom(next);
    setPlayer(nextPlayer);
    setLostRoomCode(null);
  }, []);

  const createRoom = useCallback(
    async (gameId: string, rawNickname: string, settings?: RoomSettings): Promise<string> => {
      const game = GAMES.find((g) => g.id === gameId);
      if (!game) throw new Error("找不到這個遊戲");
      if (!getGameEngine(gameId)) throw new Error(`${game.name} 尚未開放，敬請期待`);

      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "房主";
      const baseSettings = normalizeSettings(gameId, settings);

      // Attempt Firebase mode first if available
      if (db && !localModeRef.current) {
        try {
          let roomCode: string | null = null;
          for (let attempt = 0; attempt < 8 && roomCode === null; attempt++) {
            const candidate = generateRoomCode();
            const hostPlayer: Player = {
              id: authUser.uid,
              nickname,
              avatar: pickAvatar(nickname, []),
              isHost: true,
              role: "display",
              isConnected: true,
              isReady: true,
              score: 0,
            };
            const now = Date.now();
            const createdRoom: Room = {
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
            const result = await withTimeout(
              runTransaction(ref(db, `rooms/${candidate}`), (current) => {
                if (current !== null) return undefined; // code already taken
                return createdRoom as unknown as Record<string, unknown>;
              }),
              7000,
              "Firebase 房間建立連線逾時",
            );
            if (result.committed) {
              roomCode = candidate;
              // Publish the host screen's room before navigating: the create and
              // room segments mount different providers, so waiting for the
              // listener would leave the new host screen roomless for a beat.
              adoptRoom(createdRoom, hostPlayer);
            }
          }

          if (roomCode) {
            markDisconnectedOnLeave(roomCode, authUser.uid);
            rememberNickname(nickname);
            writeSession({
              userId: authUser.uid,
              roomCode,
              nickname,
              mode: localModeRef.current ? "local" : "firebase",
            });
            setUser(authUser);
            openRoom(roomCode, authUser.uid);
            return roomCode;
          }
        } catch (firebaseErr) {
          throw new Error(
            firebaseErr instanceof Error ? firebaseErr.message : "無法建立線上房間，請檢查 Firebase 設定與網路。",
          );
        }
        throw new Error("暫時無法建立房間，請再試一次");
      }

      // Local mode fallback
      const candidate = generateRoomCode();
      const hostPlayer: Player = {
        id: authUser.uid,
        nickname,
        avatar: pickAvatar(nickname, []),
        isHost: true,
        role: "display",
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
      if (!saveLocalRoom(newRoom))
        throw new Error("這個瀏覽器的儲存空間不足，房間無法建立。請關閉其他分頁或清除網站資料後再試一次。");
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode: candidate, nickname, mode: "local" });
      setUser(authUser);
      adoptRoom(newRoom, hostPlayer);
      openRoom(candidate, authUser.uid);
      return candidate;
    },
    [adoptRoom, ensureAuth, openRoom],
  );

  const joinRoom = useCallback(
    async (rawRoomCode: string, rawNickname: string) => {
      const roomCode = rawRoomCode.trim().toUpperCase();
      const authUser = await ensureAuth();
      const nickname = sanitizeNickname(rawNickname) || "玩家";

      // Attempt Firebase mode
      if (db && !localModeRef.current) {
        const result = await joinRoomOnFirebase(db, roomCode, authUser.uid, nickname);
        if (result.outcome === "joined") {
          markDisconnectedOnLeave(roomCode, authUser.uid);
          rememberNickname(nickname);
          writeSession({ userId: authUser.uid, roomCode, nickname, mode: localModeRef.current ? "local" : "firebase" });
          setUser(authUser);
          openRoom(roomCode, authUser.uid);
          return;
        }
        if (result.outcome === "full") throw new Error("房間已額滿");
        if (result.outcome === "error") throw result.error;
        throw new Error("找不到這個房間，請確認代碼是否輸入正確");
      }

      // Serialize joins with ticks/actions from other tabs.
      const joined = await updateLocalRoom(roomCode, (current) => {
        const players = current.players ?? {};
        const existing = players[authUser.uid];
        if (!existing && Object.values(players).filter(isParticipant).length >= maxPlayersFor(current.gameId))
          throw new Error("房間已額滿");
        return {
          ...current,
          players: {
            ...players,
            [authUser.uid]: {
              id: authUser.uid,
              nickname,
              avatar:
                existing?.avatar ??
                pickAvatar(
                  nickname,
                  Object.values(players).map((p) => p.avatar),
                ),
              isHost: Boolean(existing?.isHost),
              role: existing?.role ?? "player",
              isConnected: true,
              isReady: Boolean(existing?.isReady),
              score: existing?.score ?? 0,
            },
          },
        };
      });
      if (!joined) throw new Error("找不到這個房間。展示房間只限同一瀏覽器的一般分頁。");
      enterLocalMode();
      rememberNickname(nickname);
      writeSession({ userId: authUser.uid, roomCode, nickname, mode: localModeRef.current ? "local" : "firebase" });
      setUser(authUser);
      adoptRoom(joined, joined.players[authUser.uid] ?? null);
      openRoom(roomCode, authUser.uid);
    },
    [adoptRoom, ensureAuth, openRoom, enterLocalMode],
  );

  const leaveRoom = useCallback(async () => {
    const uid = user?.uid;
    const currentRoom = room;
    stopListening();
    forgetRoomSession();
    setRoom(null);
    setPlayer(null);
    setPendingRoomCode(null);
    writeSession(null);

    if (!currentRoom || !uid) return;

    if (db && !localModeRef.current) {
      try {
        await update(ref(db, `rooms/${currentRoom.id}/players/${uid}`), {
          isConnected: false,
          leftAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    } else {
      await updateLocalRoom(currentRoom.id, (current) =>
        !current.players[uid]
          ? current
          : {
              ...current,
              players: {
                ...current.players,
                [uid]: { ...current.players[uid], isConnected: false, leftAt: Date.now() },
              },
            },
      );
    }
  }, [room, user, stopListening]);

  const endRoom = useCallback(async () => {
    if (!room || !user || room.hostPlayerId !== user.uid) throw new Error("只有房主可以結束房間");
    if (db && !localModeRef.current) {
      const result = await runTransaction(ref(db, `rooms/${room.id}`), (current) =>
        current?.hostPlayerId === user.uid ? null : undefined,
      );
      if (!result.committed) throw new Error("房主已更換或房間已結束");
    } else {
      await updateLocalRoom(room.id, (current) => {
        if (current.hostPlayerId !== user.uid) throw new Error("房主已更換");
        deleteLocalRoom(room.id);
        return null;
      });
    }
    stopListening();
    forgetRoomSession();
    setRoom(null);
    setPlayer(null);
    setPendingRoomCode(null);
    // Recorded before the listener is torn down so the host screen knows to go
    // home rather than offer the join form for a code that just stopped existing.
    markRoomLost(room.id);
    writeSession(null);
  }, [markRoomLost, room, user, stopListening]);

  const requireHost = useCallback((): HostContext => {
    if (!room) throw new Error("尚未加入房間");
    if (!user) throw new Error("尚未登入");
    if (room.hostPlayerId !== user.uid) throw new Error("只有房主可以執行此操作");
    return { current: room, uid: user.uid };
  }, [room, user]);

  const mutateHostRoom = useCallback(
    async (apply: (current: Room) => Room) => {
      const { current, uid } = requireHost();
      const guarded = (latest: Room) => {
        if (latest.hostPlayerId !== uid) throw new Error("房主已更換，請重新整理房間");
        return apply(latest);
      };
      if (db && !localModeRef.current) {
        const result = await runTransaction(ref(db, `rooms/${current.id}`), (latest) =>
          latest ? guarded(latest as Room) : undefined,
        );
        if (!result.committed) throw new Error("房間已結束或操作未完成");
      } else if (!(await updateLocalRoom(current.id, guarded))) {
        throw new Error("找不到這個房間");
      }
    },
    [requireHost],
  );

  const kickPlayer = useCallback(
    (playerId: string) =>
      mutateHostRoom((current) => {
        if (current.status !== "LOBBY") throw new Error("遊戲中不能移除玩家");
        if (playerId === current.hostPlayerId) throw new Error("不能移除房主");
        const { [playerId]: _removed, ...players } = current.players;
        return { ...current, players };
      }),
    [mutateHostRoom],
  );

  const claimHost = useCallback(async () => {
    if (!room || !user || !room.players[user.uid]) throw new Error("尚未加入房間");
    const uid = user.uid;
    const claim = (current: Room) => claimRoomHost(current, uid, room.hostPlayerId, Date.now() + serverOffset.current);
    if (db && !localModeRef.current) {
      const result = await runTransaction(ref(db, `rooms/${room.id}`), (current) =>
        current ? (claim(current as Room) ?? undefined) : undefined,
      );
      if (!result.committed) throw new Error("房主仍在線，或已有其他玩家接管");
    } else if (!(await updateLocalRoom(room.id, claim))) {
      throw new Error("房主仍在線，或已有其他玩家接管");
    }
  }, [room, user]);

  const startGame = useCallback(
    () => mutateHostRoom((current) => startRoomGame(current, Date.now() + serverOffset.current)),
    [mutateHostRoom],
  );
  const endRound = useCallback(
    () =>
      mutateHostRoom((current) => {
        if (current.status !== "PLAYING") throw new Error("請在結算畫面選擇再玩一次");
        return restartRoomGame(current, Date.now() + serverOffset.current);
      }),
    [mutateHostRoom],
  );
  const rematch = useCallback(() => mutateHostRoom((current) => returnRoomToLobby(current)), [mutateHostRoom]);
  const endGame = useCallback(
    () => mutateHostRoom((current) => endRoomGame(current, Date.now() + serverOffset.current)),
    [mutateHostRoom],
  );
  const switchGame = useCallback(
    (gameId: string) => mutateHostRoom((current) => returnRoomToLobby(current, gameId)),
    [mutateHostRoom],
  );
  const updateSettings = useCallback(
    (patch: Partial<RoomSettings>) =>
      mutateHostRoom((current) => {
        if (current.status !== "LOBBY") throw new Error("遊戲進行中不能更改設定");
        return { ...current, settings: normalizeSettings(current.gameId, { ...current.settings, ...patch }) };
      }),
    [mutateHostRoom],
  );

  const submitAction = useCallback(
    async (action: unknown) => {
      if (!room || !user) throw new Error("尚未加入房間");
      const expected = {
        gameId: room.gameId,
        phase: room.gameState.phase,
        round: room.gameState.currentRound,
        startedAt: room.startedAt,
        contextKey: actionContextKey(room.gameState),
      };
      const apply = (current: Room) =>
        applyRoomAction(current, user.uid, action, expected, Date.now() + serverOffset.current);
      if (db && !localModeRef.current) {
        const result = await runTransaction(ref(db, `rooms/${room.id}`), (current) =>
          current ? apply(current as Room) : undefined,
        );
        if (!result.committed) throw new Error("操作沒有送出，房間可能已結束");
      } else if (!(await updateLocalRoom(room.id, apply))) {
        throw new Error("找不到這個房間");
      }
    },
    [room, user],
  );

  const toggleReady = useCallback(async () => {
    if (!room || !user || !player || room.status !== "LOBBY") return;
    try {
      if (db && !localModeRef.current) {
        await runTransaction(ref(db, `rooms/${room.id}/players/${user.uid}/isReady`), (ready) => !ready);
      } else {
        await updateLocalRoom(room.id, (current) => {
          const p = current.players[user.uid];
          if (!p || current.status !== "LOBBY") return current;
          return { ...current, players: { ...current.players, [user.uid]: { ...p, isReady: !p.isReady } } };
        });
      }
      if (!player.isReady) sfx.playReady();
    } catch (error) {
      console.error("[partyverse] readiness update failed", error);
      throw new Error("無法更新就緒狀態，請再試一次");
    }
  }, [room, user, player]);

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

      if (db && !localModeRef.current) {
        try {
          await update(ref(db, `rooms/${room.id}/reactions`), { [id]: reaction });
          setTimeout(() => {
            if (db) void remove(ref(db, `rooms/${room.id}/reactions/${id}`)).catch(() => undefined);
          }, 6000);
        } catch (err) {
          console.warn("[partyverse] sendReaction error:", err);
        }
      } else {
        await updateLocalRoom(room.id, (current) => ({
          ...current,
          reactions: { ...current.reactions, [id]: reaction },
        }));
        setTimeout(() => {
          void updateLocalRoom(room.id, (current) => {
            const { [id]: _removed, ...reactions } = current.reactions ?? {};
            return { ...current, reactions };
          });
        }, 6000);
      }
    },
    [room, user, player],
  );

  // The host advances stored deadlines. The transaction rechecks ownership so
  // an old host cannot keep ticking after another player takes over.
  const tickingRoomId = room?.id;
  const tickingStatus = room?.status;
  const tickingHostId = room?.hostPlayerId;
  const tickingUserId = user?.uid;
  useEffect(() => {
    if (!tickingRoomId || !tickingUserId || tickingStatus !== "PLAYING" || tickingHostId !== tickingUserId) return;
    const roomId = tickingRoomId;
    const uid = tickingUserId;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const apply = (current: Room) => {
          if (current.status !== "PLAYING" || current.hostPlayerId !== uid) return current;
          return advanceRoomGame(current, Date.now() + serverOffset.current, true);
        };
        if (db && !localModeRef.current) {
          await runTransaction(ref(db, `rooms/${roomId}`), (current) => (current ? apply(current as Room) : undefined));
        } else {
          await updateLocalRoom(roomId, apply);
        }
      } catch (error) {
        console.error("[partyverse] tick failed:", error);
      } finally {
        inFlight = false;
      }
    };
    const id = setInterval(() => void tick(), TICK_MS);
    const wake = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [tickingRoomId, tickingStatus, tickingHostId, tickingUserId]);

  // A provider that mounted with a resumed room may not have resolved Firebase
  // auth yet; the resumed player record carries the same identity.
  const identity = user?.uid ?? player?.id ?? null;
  const isHost = Boolean(room && identity && room.hostPlayerId === identity);

  return (
    <RoomContext.Provider
      value={{
        room,
        player,
        user,
        loading,
        pendingRoomCode,
        lostRoomCode,
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
        rematch,
        endGame,
        switchGame,
        updateSettings,
        submitAction,
        toggleReady,
        sendReaction,
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
