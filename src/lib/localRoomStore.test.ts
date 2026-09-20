import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  getLocalUserId,
  getLocalRoom,
  saveLocalRoom,
  deleteLocalRoom,
  subscribeLocalRoom,
} from "./localRoomStore";
import type { Room } from "@/types";

describe("localRoomStore", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    (global as unknown as { window: unknown }).window = {
      localStorage: mockStorage,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });

  afterAll(() => {
    delete (global as unknown as { window?: unknown }).window;
  });

  it("generates and persists a local user id", () => {
    const uid1 = getLocalUserId();
    expect(uid1).toBeTruthy();
    expect(uid1.startsWith("demo-")).toBe(true);
    const uid2 = getLocalUserId();
    expect(uid2).toBe(uid1);
  });

  it("saves, reads and deletes a local room", () => {
    const mockRoom: Room = {
      id: "TEST1",
      gameId: "bombcountdown",
      hostPlayerId: "user-1",
      status: "LOBBY",
      createdAt: Date.now(),
      settings: {
        timer: 15,
        difficulty: "easy",
        rounds: 3,
        soundEnabled: true,
        ageMode: "family",
      },
      players: {
        "user-1": {
          id: "user-1",
          nickname: "Host",
          avatar: "👑",
          isHost: true,
          isConnected: true,
          score: 0,
        },
      },
      gameState: {},
    };

    saveLocalRoom(mockRoom);
    const fetched = getLocalRoom("TEST1");
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe("TEST1");
    expect(fetched?.players["user-1"].nickname).toBe("Host");

    deleteLocalRoom("TEST1");
    expect(getLocalRoom("TEST1")).toBeNull();
  });

  it("notifies subscribers when room updates or is deleted", () => {
    const mockRoom: Room = {
      id: "SUB01",
      gameId: "bombcountdown",
      hostPlayerId: "user-1",
      status: "LOBBY",
      createdAt: Date.now(),
      settings: {
        timer: 15,
        difficulty: "easy",
        rounds: 3,
        soundEnabled: true,
        ageMode: "family",
      },
      players: {},
      gameState: {},
    };

    const updates: Array<Room | null> = [];
    const unsub = subscribeLocalRoom("SUB01", (room) => {
      updates.push(room);
    });

    expect(updates.length).toBe(1);
    expect(updates[0]).toBeNull();

    saveLocalRoom(mockRoom);
    expect(updates.length).toBe(2);
    expect(updates[1]?.id).toBe("SUB01");

    deleteLocalRoom("SUB01");
    expect(updates.length).toBe(3);
    expect(updates[2]).toBeNull();

    unsub();
  });
});
