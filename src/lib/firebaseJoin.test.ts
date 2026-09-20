import { beforeEach, describe, expect, it, vi } from "vitest";
import { joinRoomOnFirebase } from "@/lib/firebaseJoin";

/**
 * A fake Firebase RTDB that reproduces the transaction semantics the real SDK
 * documents (and that caused the "找不到這個房間" bug):
 *
 * 1. The transaction update function FIRST runs against the local cache —
 *    `null` if this client never read the node before.
 * 2. Returning `undefined` aborts the transaction LOCALLY: it resolves with
 *    `{ committed: false }` and the server is NEVER contacted.
 * 3. Returning a value sends an optimistic write tagged with the value the
 *    client assumed; if the server value differs, the update function re-runs
 *    with the real server value and the write is retried.
 * 4. `get()` reads the server AND populates the local cache.
 */
const state = vi.hoisted(() => {
  const server = new Map<string, unknown>();
  const cache = new Map<string, unknown>();
  const calls: string[] = [];
  return { server, cache, calls };
});

vi.mock("firebase/database", () => {
  const snapshotOf = (value: unknown) => ({
    exists: () => value != null,
    val: () => value,
  });
  const json = (v: unknown) => JSON.stringify(v);

  return {
    ref: (_db: unknown, path: string) => ({ path }),

    get: async (r: { path: string }) => {
      state.calls.push("get");
      const value = state.server.get(r.path) ?? null;
      state.cache.set(r.path, value);
      return snapshotOf(value);
    },

    runTransaction: async (
      r: { path: string },
      updateFunction: (current: unknown) => unknown,
    ) => {
      state.calls.push("transaction");
      const path = r.path;

      // First run: against the local cache only (null when never read).
      let assumed = state.cache.has(path) ? state.cache.get(path) : null;
      let next = updateFunction(assumed);
      if (next === undefined) {
        // Aborted locally — the server is never consulted.
        return { committed: false, snapshot: snapshotOf(null) };
      }

      // Server round trip with conflict re-runs.
      let serverValue = state.server.get(path) ?? null;
      for (let attempt = 0; attempt < 5 && json(serverValue) !== json(assumed); attempt++) {
        assumed = serverValue;
        next = updateFunction(assumed);
        if (next === undefined) return { committed: false, snapshot: snapshotOf(null) };
        serverValue = state.server.get(path) ?? null;
      }
      if (json(serverValue) !== json(assumed) && next === undefined) {
        return { committed: false, snapshot: snapshotOf(null) };
      }

      state.server.set(path, next);
      state.cache.set(path, next);
      return { committed: true, snapshot: snapshotOf(next) };
    },
  };
});

const HOST = {
  id: "host-uid",
  nickname: "房主",
  avatar: "🦊",
  isHost: true,
  isConnected: true,
  isReady: true,
  score: 0,
};

function seedServerRoom(code: string, players: Record<string, object> = { "host-uid": HOST }) {
  state.server.set(`rooms/${code}`, {
    id: code,
    gameId: "whoisundercoveragent",
    hostPlayerId: "host-uid",
    status: "LOBBY",
    createdAt: Date.now(),
    players,
    gameState: {},
  });
}

beforeEach(() => {
  state.server.clear();
  state.cache.clear();
  state.calls.length = 0;
});

describe("joinRoomOnFirebase", () => {
  it("joins an existing room from a cold cache (the regression: fresh joiner device)", async () => {
    seedServerRoom("ABCDE");

    const result = await joinRoomOnFirebase({} as never, "ABCDE", "joiner-uid", "小明");

    expect(result).toEqual({ outcome: "joined" });

    const room = state.server.get("rooms/ABCDE") as { players: Record<string, { nickname: string; isHost: boolean; isConnected: boolean }> };
    expect(room.players["joiner-uid"].nickname).toBe("小明");
    expect(room.players["joiner-uid"].isHost).toBe(false);
    expect(room.players["joiner-uid"].isConnected).toBe(true);
    // Host is untouched.
    expect(room.players["host-uid"].nickname).toBe("房主");
  });

  it("reads the room from the server BEFORE running the transaction", async () => {
    seedServerRoom("ABCDE");

    await joinRoomOnFirebase({} as never, "ABCDE", "joiner-uid", "小明");

    expect(state.calls).toEqual(["get", "transaction"]);
  });

  it("reports not-found for a code that does not exist on the server", async () => {
    const result = await joinRoomOnFirebase({} as never, "ZZZZZ", "joiner-uid", "小明");

    expect(result).toEqual({ outcome: "not-found" });
    // Existence was confirmed against the server, so no speculative write was attempted.
    expect(state.calls).toEqual(["get"]);
    expect(state.server.has("rooms/ZZZZZ")).toBe(false);
  });

  it("reports full when the room is at capacity", async () => {
    const players: Record<string, object> = { "host-uid": HOST };
    for (let i = 0; i < 11; i++) players[`p${i}`] = { ...HOST, id: `p${i}`, isHost: false };
    seedServerRoom("ABCDE", players);

    const result = await joinRoomOnFirebase({} as never, "ABCDE", "joiner-uid", "小明");

    expect(result).toEqual({ outcome: "full" });
    const room = state.server.get("rooms/ABCDE") as { players: Record<string, unknown> };
    expect(room.players["joiner-uid"]).toBeUndefined();
  });

  it("rejoining keeps the player's previous avatar and score", async () => {
    seedServerRoom("ABCDE", {
      "host-uid": HOST,
      "joiner-uid": { ...HOST, id: "joiner-uid", isHost: false, nickname: "舊名字", avatar: "🐼", score: 7 },
    });

    const result = await joinRoomOnFirebase({} as never, "ABCDE", "joiner-uid", "小明");

    expect(result).toEqual({ outcome: "joined" });
    const room = state.server.get("rooms/ABCDE") as { players: Record<string, { nickname: string; avatar: string; score: number }> };
    expect(room.players["joiner-uid"].nickname).toBe("小明");
    expect(room.players["joiner-uid"].avatar).toBe("🐼");
    expect(room.players["joiner-uid"].score).toBe(7);
  });

  it("survives a concurrent join between the read and the transaction (conflict re-run)", async () => {
    seedServerRoom("ABCDE");

    // Warm the cache, then simulate another player joining before our write lands.
    const resultPromise = joinRoomOnFirebase({} as never, "ABCDE", "joiner-uid", "小明");
    // The fake processes synchronously up to the first await; give it a tick,
    // then mutate the server so the transaction hits a conflict and re-runs.
    await Promise.resolve();
    await Promise.resolve();
    const room = state.server.get("rooms/ABCDE") as { players: Record<string, unknown> };
    room.players["racer-uid"] = { ...HOST, id: "racer-uid", isHost: false };

    const result = await resultPromise;
    expect(result).toEqual({ outcome: "joined" });

    const after = state.server.get("rooms/ABCDE") as { players: Record<string, unknown> };
    expect(after.players["joiner-uid"]).toBeDefined();
    expect(after.players["racer-uid"]).toBeDefined();
  });

  /**
   * Documents the original bug: a join transaction that aborts on
   * `current === null` fails on every cold-cache client without ever asking
   * the server — this is exactly what joinRoom used to do, and why joiners
   * always saw 「找不到這個房間」. The get()-first strategy above avoids it.
   */
  it("old abort-on-null pattern silently fails from a cold cache (regression documentation)", async () => {
    seedServerRoom("ABCDE");

    // Simulate the OLD joinRoom transaction shape: runTransaction WITHOUT a prior get().
    const { runTransaction, ref } = await import("firebase/database");
    const result = await runTransaction(ref({} as never, "rooms/ABCDE"), (current: unknown) => {
      if (current === null) return undefined; // "no such room"
      return { ...(current as object), players: {} };
    });

    expect(result.committed).toBe(false);
    // The room is still on the server, untouched — the transaction never asked.
    expect(state.server.has("rooms/ABCDE")).toBe(true);
  });
});
