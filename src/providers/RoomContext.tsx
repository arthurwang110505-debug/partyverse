"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { db, auth } from "@/lib/firebase";
import { ref, onValue, off, set, get, update, remove, onDisconnect } from "firebase/database";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import type { Room, Player } from "@/types";
import { GAMES } from "@/constants/games";
import { generateRoomCode } from "@/lib/utils";

interface RoomContextType {
  room: Room | null;
  player: Player | null;
  user: User | null;
  loading: boolean;
  joinRoom: (roomCode: string, nickname: string) => Promise<void>;
  createRoom: (gameId: string, nickname: string, settings: Room["settings"]) => Promise<string>;
  kickPlayer: (playerId: string) => Promise<void>;
  startGame: () => Promise<void>;
  endGame: () => Promise<void>;
  switchGame: (newGameId: string) => Promise<void>;
}

const RoomContext = createContext<RoomContextType | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session
  useEffect(() => {
    const stored = sessionStorage.getItem("partyverse_session");
    if (stored) {
      try {
        const { userId, roomCode, nickname } = JSON.parse(stored);
        if (db && userId) {
          get(ref(db, `rooms/${roomCode}/players/${userId}`)).then((snap) => {
            if (snap.exists()) {
              get(ref(db, `rooms/${roomCode}`)).then((roomSnap) => {
                if (roomSnap.exists()) {
                  const data = roomSnap.val();
                  setRoom({
                    id: data.id,
                    gameId: data.gameId,
                    hostPlayerId: data.hostPlayerId,
                    status: data.status,
                    createdAt: data.createdAt,
                    settings: data.settings,
                    players: data.players || {},
                    gameState: data.gameState || {},
                  });
                  setPlayer(data.players[userId] || null);
                }
              });
            }
          });
        }
      } catch (e) {
        console.error("Session restore error:", e);
      }
    }
    setLoading(false);
  }, []);

  const createRoom = useCallback(async (gameId: string, nickname: string, settings: NonNullable<Room["settings"]>): Promise<string> => {
    if (!db || !auth) throw new Error("Firebase not configured");

    let user: User;
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    } catch (e) {
      console.error("SignInAnonymously error:", e);
      throw new Error(`Auth failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const userId = user.uid;

    // Generate unique room code
    let roomCode: string;
    let exists = true;
    while (exists) {
      roomCode = generateRoomCode();
      const snap = await get(ref(db, `rooms/${roomCode}`));
      exists = snap.exists();
    }

    const gameDef = GAMES.find((g) => g.id === gameId);
    const hostPlayer: Player = {
      id: userId,
      nickname: nickname.trim(),
      avatar: gameDef?.icon || "🎮",
      isHost: true,
      isConnected: true,
      score: 0,
    };

    await set(ref(db, `rooms/${roomCode}`), {
      id: roomCode,
      gameId,
      hostPlayerId: userId,
      status: "LOBBY",
      createdAt: Date.now(),
      settings,
      players: { [userId]: hostPlayer },
      gameState: {},
    });

    // Set presence
    const playerRef = ref(db, `rooms/${roomCode}/players/${userId}`);
    onDisconnect(playerRef).update({ isConnected: false });

    // Store session
    sessionStorage.setItem("partyverse_session", JSON.stringify({ userId, roomCode, nickname: hostPlayer.nickname }));

    // Listen to room
    onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      const data = snap.val();
      if (!data) return;
      setRoom({
        id: data.id,
        gameId: data.gameId,
        hostPlayerId: data.hostPlayerId,
        status: data.status,
        createdAt: data.createdAt,
        settings: data.settings,
        players: data.players || {},
        gameState: data.gameState || {},
      });
      if (data.players?.[userId]) {
        setPlayer(data.players[userId]);
      }
    });

    return roomCode;
  }, [db, auth]);

  const joinRoom = useCallback(async (roomCode: string, nickname: string) => {
    if (!db || !auth) throw new Error("Firebase not configured");

    let user: User;
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    } catch (e) {
      console.error("SignInAnonymously error:", e);
      throw new Error(`Auth failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const userId = user.uid;

    // Check room exists
    const roomSnap = await get(ref(db, `rooms/${roomCode}`));
    if (!roomSnap.exists()) throw new Error("Room not found");

    const data = roomSnap.val();
    const playerCount = Object.keys(data.players || {}).length;
    const maxPlayers = data.settings?.maxPlayers || 20;
    if (playerCount >= maxPlayers) throw new Error("Room is full");

    const gameDef = GAMES.find((g) => g.id === data.gameId);
    const newPlayer: Player = {
      id: userId,
      nickname: nickname.trim() || `Player ${playerCount + 1}`,
      avatar: gameDef?.icon || "🎮",
      isHost: false,
      isConnected: true,
      score: 0,
    };

    // Add player
    await set(ref(db, `rooms/${roomCode}/players/${userId}`), newPlayer);

    // Set presence
    const playerRef = ref(db, `rooms/${roomCode}/players/${userId}/isConnected`);
    onDisconnect(playerRef).set(false);

    // Store session
    sessionStorage.setItem("partyverse_session", JSON.stringify({ userId, roomCode, nickname: newPlayer.nickname }));

    // Listen to room
    onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      const d = snap.val();
      if (!d) return;
      setRoom({
        id: d.id,
        gameId: d.gameId,
        hostPlayerId: d.hostPlayerId,
        status: d.status,
        createdAt: d.createdAt,
        settings: d.settings,
        players: d.players || {},
        gameState: d.gameState || {},
      });
      if (d.players?.[userId]) {
        setPlayer(d.players[userId]);
      }
    });

    setUser(user);
  }, [db, auth]);

  const kickPlayer = useCallback(async (playerId: string) => {
    if (!db || !room || !auth?.currentUser) return;
    if (room.hostPlayerId !== auth.currentUser.uid) throw new Error("Not authorized");
    await remove(ref(db, `rooms/${room.id}/players/${playerId}`));
  }, [db, room, auth]);

  const startGame = useCallback(async () => {
    if (!db || !room || !auth?.currentUser) return;
    if (room.hostPlayerId !== auth.currentUser.uid) throw new Error("Not authorized");
    await update(ref(db, `rooms/${room.id}`), { status: "PLAYING" });
  }, [db, room, auth]);

  const endGame = useCallback(async () => {
    if (!db || !room || !auth?.currentUser) return;
    if (room.hostPlayerId !== auth.currentUser.uid) throw new Error("Not authorized");
    await update(ref(db, `rooms/${room.id}`), { status: "RESULTS" });
  }, [db, room, auth]);

  const switchGame = useCallback(async (newGameId: string) => {
    if (!db || !room || !auth?.currentUser) return;
    if (room.hostPlayerId !== auth.currentUser.uid) throw new Error("Not authorized");
    await update(ref(db, `rooms/${room.id}`), {
      gameId: newGameId,
      status: "LOBBY",
      gameState: {},
    });
  }, [db, room, auth]);

  return (
    <RoomContext.Provider value={{ room, player, user, loading, joinRoom, createRoom, kickPlayer, startGame, endGame, switchGame }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}

export function usePlayer() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("usePlayer must be used within RoomProvider");
  return ctx.player;
}

export function useCurrentRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useCurrentRoom must be used within RoomProvider");
  return ctx.room;
}
