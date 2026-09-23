import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { joinRoomOnFirebase } from "@/lib/firebaseJoin";

/** Model the SDK's cache lifetime, not just its returned snapshots.
 * get() removes its temporary registration; only active listeners pin a cache.
 * See @firebase/database's repoGetValue / syncTreeRemoveEventRegistration.
 */
const state = vi.hoisted(() => ({
  server: new Map<string, any>(),
  cache: new Map<string, any>(),
  listeners: new Map<string, number>(),
  calls: [] as string[],
  readError: null as Error | null,
  writeError: null as Error | null,
  stallRead: false,
  stallWrite: false,
  beforeWrite: null as (() => void) | null,
  delayedUpdate: null as ((current: unknown) => unknown) | null,
}));

vi.mock("firebase/database", () => {
  const clone = (value: unknown) => (value == null ? null : JSON.parse(JSON.stringify(value)));
  const snapshotOf = (value: unknown) => ({ exists: () => value != null, val: () => clone(value) });
  return {
    ref: (_db: unknown, path: string) => ({ path }),
    get: async (r: { path: string }) => {
      state.calls.push("get");
      const value = clone(state.server.get(r.path));
      if (state.listeners.get(r.path)) state.cache.set(r.path, value);
      return snapshotOf(value);
    },
    onValue: (r: { path: string }, callback: (s: unknown) => void, onError: (e: Error) => void) => {
      state.calls.push("listen");
      state.listeners.set(r.path, (state.listeners.get(r.path) ?? 0) + 1);
      let stopped = false;
      queueMicrotask(() => {
        if (stopped || state.stallRead) return;
        if (state.readError) {
          onError(state.readError);
          return;
        }
        const value = clone(state.server.get(r.path));
        state.cache.set(r.path, value);
        callback(snapshotOf(value));
      });
      return () => {
        stopped = true;
        state.calls.push("unsubscribe");
        const count = (state.listeners.get(r.path) ?? 1) - 1;
        state.listeners.set(r.path, count);
        if (!count) state.cache.delete(r.path);
      };
    },
    runTransaction: async (
      r: { path: string },
      update: (current: unknown) => unknown,
      options?: { applyLocally?: boolean },
    ) => {
      state.calls.push("transaction");
      if (options) expect(options.applyLocally).toBe(false);
      if (state.writeError) throw state.writeError;
      if (state.stallWrite) {
        state.delayedUpdate = update;
        return new Promise(() => {});
      }
      state.beforeWrite?.();
      let assumed = clone(state.cache.get(r.path));
      let next = update(assumed);
      if (next === undefined) return { committed: false, snapshot: snapshotOf(assumed) };
      // A conflict retries against the server, not the original read snapshot.
      if (JSON.stringify(assumed) !== JSON.stringify(state.server.get(r.path) ?? null)) {
        assumed = clone(state.server.get(r.path));
        next = update(assumed);
      }
      if (next === undefined) return { committed: false, snapshot: snapshotOf(assumed) };
      state.server.set(r.path, clone(next));
      state.cache.set(r.path, clone(next));
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
function seedServerRoom(code = "ABCDE", players: Record<string, object> = { "host-uid": HOST }) {
  state.server.set(`rooms/${code}`, {
    id: code,
    gameId: "whoisundercoveragent",
    hostPlayerId: "host-uid",
    status: "LOBBY",
    createdAt: 100000,
    players,
    gameState: {},
  });
}
const join = (code = "ABCDE", uid = "joiner-uid") => joinRoomOnFirebase({} as never, code, uid, "小明");
const players = () => state.server.get("rooms/ABCDE").players;

beforeEach(() => {
  state.server.clear();
  state.cache.clear();
  state.listeners.clear();
  state.calls.length = 0;
  state.readError = null;
  state.writeError = null;
  state.stallRead = false;
  state.stallWrite = false;
  state.beforeWrite = null;
  state.delayedUpdate = null;
});
afterEach(() => {
  expect([...state.listeners.values()].every((count) => count === 0)).toBe(true);
  vi.useRealTimers();
});

describe("Firebase joins from independent devices", () => {
  it("joins from a cold cache, keeping the listener alive until the write settles", async () => {
    seedServerRoom();
    expect(await join()).toEqual({ outcome: "joined" });
    expect(players()["joiner-uid"]).toMatchObject({
      nickname: "小明",
      isHost: false,
      role: "player",
      isConnected: true,
    });
    expect(players()["host-uid"]).toEqual(HOST);
    expect(state.calls).toEqual(["listen", "transaction", "unsubscribe"]);
    expect(state.cache.size).toBe(0);
  });

  it("documents why the old get-then-transaction fix fails with actual cache lifetimes", async () => {
    seedServerRoom();
    const { get, ref, runTransaction } = await import("firebase/database");
    const roomRef = ref({} as never, "rooms/ABCDE");
    expect((await get(roomRef)).exists()).toBe(true);
    const result = await runTransaction(roomRef, (current) => (current === null ? undefined : current));
    expect(result.committed).toBe(false);
    expect(state.server.has("rooms/ABCDE")).toBe(true);
  });

  it("normalizes pasted room codes", async () => {
    seedServerRoom();
    expect(await join(" abcde \n")).toEqual({ outcome: "joined" });
  });

  it("does not write a nonexistent room", async () => {
    expect(await join("ZZZZZ")).toEqual({ outcome: "not-found" });
    expect(state.calls).toEqual(["listen", "unsubscribe"]);
    expect(state.server.size).toBe(0);
  });

  it("reports a full room without throwing from the transaction callback", async () => {
    seedServerRoom(
      "ABCDE",
      Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`p${i}`, { ...HOST, id: `p${i}`, isHost: false }])),
    );
    expect(await join()).toEqual({ outcome: "full" });
    expect(players()["joiner-uid"]).toBeUndefined();
  });

  it("does not count a display toward capacity", async () => {
    seedServerRoom("ABCDE", {
      "host-uid": { ...HOST, role: "display" },
      ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`p${i}`, { ...HOST, id: `p${i}`, isHost: false }])),
    });
    expect(await join()).toEqual({ outcome: "joined" });
    expect(await join("ABCDE", "extra")).toEqual({ outcome: "full" });
  });

  it("rejoining preserves the player's avatar, score and readiness", async () => {
    seedServerRoom("ABCDE", {
      "host-uid": HOST,
      "joiner-uid": { ...HOST, id: "joiner-uid", isHost: false, avatar: "🐼", score: 7 },
    });
    expect(await join()).toEqual({ outcome: "joined" });
    expect(players()["joiner-uid"]).toMatchObject({
      nickname: "小明",
      avatar: "🐼",
      score: 7,
      isReady: true,
      isHost: false,
    });
  });

  it("preserves a concurrent join when the transaction retries", async () => {
    seedServerRoom();
    state.beforeWrite = () => {
      players().racer = { ...HOST, id: "racer", isHost: false };
    };
    expect(await join()).toEqual({ outcome: "joined" });
    expect(players().racer).toBeDefined();
    expect(players()["joiner-uid"]).toBeDefined();
  });

  it("does not resurrect a room deleted between its first snapshot and the write", async () => {
    seedServerRoom();
    state.beforeWrite = () => state.server.delete("rooms/ABCDE");
    expect(await join()).toEqual({ outcome: "not-found" });
    expect(state.server.has("rooms/ABCDE")).toBe(false);
  });

  it("rechecks capacity on a conflict retry", async () => {
    seedServerRoom();
    state.beforeWrite = () => {
      for (let i = 0; i < 11; i++) players()[`p${i}`] = { ...HOST, id: `p${i}`, isHost: false };
    };
    expect(await join()).toEqual({ outcome: "full" });
    expect(players()["joiner-uid"]).toBeUndefined();
  });

  it.each(["read", "write"])("reports %s permission errors, not a missing room", async (stage) => {
    seedServerRoom();
    const error = Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" });
    if (stage === "read") state.readError = error;
    else state.writeError = error;
    const result = await join();
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.error.message).toContain("安全規則");
  });

  it("reports network failures separately", async () => {
    state.readError = Object.assign(new Error("offline"), { code: "database/unavailable" });
    const result = await join();
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.error.message).toContain("伺服器");
  });

  it.each(["read", "write"])("cleans up a stalled %s and reports timeout", async (stage) => {
    vi.useFakeTimers();
    seedServerRoom();
    if (stage === "read") state.stallRead = true;
    else state.stallWrite = true;
    const pending = join();
    await vi.advanceTimersByTimeAsync(7100);
    const result = await pending;
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.error.message).toContain("逾時");
    if (state.delayedUpdate) expect(state.delayedUpdate(state.server.get("rooms/ABCDE"))).toBeUndefined();
  });
});
