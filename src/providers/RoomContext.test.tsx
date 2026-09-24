// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Regression cover for the reported "the second room flashes to /join" bug, on
 * the transport that caused it: Firebase, where the room snapshot is a network
 * round trip behind the membership check.
 *
 * The React tree is exercised for real (`RoomProvider` + `RoomGate`), with the
 * Firebase SDK replaced by an in-memory database whose room snapshots are only
 * released when the test says so. `/create` and `/room` mount different
 * providers, so "navigating" between them is unmounting one `RoomProvider` and
 * mounting another — which is exactly what these tests do.
 */

const fake = vi.hoisted(() => {
  const rooms = new Map<string, unknown>();
  const systemQueue: Array<() => void> = [];
  const roomQueue: Array<() => void> = [];

  const read = (path: string): unknown => {
    let prefix = path;
    let rest = "";
    while (!rooms.has(prefix)) {
      const cut = prefix.lastIndexOf("/");
      if (cut < 0) return undefined;
      rest = rest ? `${prefix.slice(cut + 1)}/${rest}` : prefix.slice(cut + 1);
      prefix = prefix.slice(0, cut);
    }
    let value = rooms.get(prefix);
    for (const key of rest ? rest.split("/") : []) {
      if (value === null || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  };

  return {
    auth: { currentUser: null as { uid: string } | null },
    snapshot: (value: unknown) => ({
      val: () => value ?? null,
      exists: () => value !== undefined && value !== null,
    }),
    read,
    write: (path: string, value: unknown) => rooms.set(path, value),
    reset: () => {
      rooms.clear();
      systemQueue.length = 0;
      roomQueue.length = 0;
      fake.auth.currentUser = null;
    },
    deferSystem: (deliver: () => void) => systemQueue.push(deliver),
    deferRoom: (deliver: () => void) => roomQueue.push(deliver),
    /** Auth state and `.info/*` reads: fast, "next tick" work. */
    flushSystem: () => systemQueue.splice(0).forEach((deliver) => deliver()),
    /** Room snapshots: the slow round trip that used to be mistaken for absence. */
    flushRooms: () => roomQueue.splice(0).forEach((deliver) => deliver()),
    pendingRooms: () => roomQueue.length,
  };
});

const nav = vi.hoisted(() => ({ replace: [] as string[], push: [] as string[] }));

vi.mock("@/lib/firebase", () => ({
  db: { name: "fake-db" },
  auth: {
    get currentUser() {
      return fake.auth.currentUser;
    },
  },
}));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path: string) => ({ path }),
  get: (target: { path: string }) => Promise.resolve(fake.snapshot(fake.read(target.path))),
  onValue: (target: { path: string }, next: (snap: unknown) => void) => {
    let active = true;
    const deliver = () => {
      if (active) next(fake.snapshot(fake.read(target.path)));
    };
    if (target.path.startsWith(".info")) fake.deferSystem(deliver);
    else fake.deferRoom(deliver);
    return () => {
      active = false;
    };
  },
  runTransaction: (target: { path: string }, updater: (current: unknown) => unknown) => {
    const next = updater(fake.read(target.path) ?? null);
    if (next === undefined) return Promise.resolve({ committed: false, snapshot: fake.snapshot(undefined) });
    fake.write(target.path, next);
    return Promise.resolve({ committed: true, snapshot: fake.snapshot(next) });
  },
  update: (target: { path: string }, values: Record<string, unknown>) => {
    const current = (fake.read(target.path) ?? {}) as Record<string, unknown>;
    fake.write(target.path, { ...current, ...values });
    return Promise.resolve();
  },
  remove: () => Promise.resolve(),
  goOnline: () => undefined,
  onDisconnect: () => ({ update: () => Promise.resolve(), cancel: () => Promise.resolve() }),
  serverTimestamp: () => 0,
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => {
    let active = true;
    fake.deferSystem(() => {
      if (active) next(fake.auth.currentUser);
    });
    return () => {
      active = false;
    };
  },
  signInAnonymously: () => Promise.resolve({ user: fake.auth.currentUser }),
}));

// `useRouter()` returns a stable object in the App Router; an unstable one here
// would re-run effects that depend on it on every render.
const router = { replace: (href: string) => nav.replace.push(href), push: (href: string) => nav.push.push(href) };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const { RoomProvider, useRoom } = await import("./RoomContext");
const { forgetRoomSession } = await import("@/lib/roomSession");
const { RoomGate } = await import("@/app/room/[roomCode]/RoomGate");
const { ToastProvider } = await import("./ToastProvider");

let api: ReturnType<typeof useRoom> | null = null;

function Probe() {
  api = useRoom();
  return null;
}

function Tree({ roomCode }: { roomCode: string }) {
  return (
    <RoomProvider>
      <ToastProvider>
        <Probe />
        <RoomGate roomCode={roomCode} hostOnly>
          <div data-testid="host-view">大螢幕</div>
        </RoomGate>
      </ToastProvider>
    </RoomProvider>
  );
}

/** The create form's side of the world: a provider with no room gate at all. */
function CreateTree() {
  return (
    <RoomProvider>
      <ToastProvider>
        <Probe />
      </ToastProvider>
    </RoomProvider>
  );
}

async function createRoom() {
  let code = "";
  await act(async () => {
    code = await api!.createRoom("bombcountdown", "客廳電視");
  });
  return code;
}

async function flush(which: "system" | "rooms") {
  for (let round = 0; round < 3; round++) {
    await act(async () => {
      if (which === "system") fake.flushSystem();
      else fake.flushRooms();
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  fake.reset();
  nav.replace.length = 0;
  nav.push.length = 0;
  sessionStorage.clear();
  localStorage.clear();
  forgetRoomSession();
  fake.auth.currentUser = { uid: "tv-uid" };
});

afterEach(() => {
  cleanup();
  api = null;
});

describe("creating a room after closing one", () => {
  it("keeps the host on the big screen across both creations", async () => {
    // 1. Host creates the first room from /create.
    render(<CreateTree />);
    const first = await createRoom();
    expect(first).toMatch(/^[A-Z0-9]{5}$/);

    // 2. `/room/<code>/host` is a different route segment: another provider.
    cleanup();
    render(<Tree roomCode={first} />);
    expect(screen.getByTestId("host-view")).toBeTruthy();
    await flush("system");
    await flush("rooms");
    expect(screen.getByTestId("host-view")).toBeTruthy();
    expect(nav.replace).toEqual([]);

    // 3. Close it. The room is gone, so the honest destination is home.
    await act(async () => {
      await api!.endRoom();
    });
    cleanup();
    render(<Tree roomCode={first} />);
    await flush("system");
    expect(nav.replace).not.toContain(`/join/${first}`);

    // 4. Same device, second room, from /create again.
    cleanup();
    render(<CreateTree />);
    const second = await createRoom();
    expect(second).not.toBe(first);
    // The room listener has NOT delivered yet — the historically fatal moment.
    expect(fake.pendingRooms()).toBeGreaterThan(0);

    // 5. Back to the host screen with a fresh provider and no snapshot in hand.
    cleanup();
    nav.replace.length = 0;
    render(<Tree roomCode={second} />);
    expect(screen.getByTestId("host-view")).toBeTruthy();
    expect(nav.replace).toEqual([]);

    // 6. Auth resolves and the membership check runs; the room snapshot is still
    //    in flight. The host screen must not be handed to the join form.
    await flush("system");
    expect(nav.replace).toEqual([]);
    expect(screen.getByTestId("host-view")).toBeTruthy();

    // 7. The snapshot lands; the host screen must still be the host screen.
    await flush("rooms");
    expect(nav.replace).toEqual([]);
    expect(screen.getByTestId("host-view")).toBeTruthy();
  });

  it("still sends a device with no session to the join form", async () => {
    render(<Tree roomCode="ABCDE" />);
    await flush("system");
    await flush("rooms");
    expect(nav.replace).toEqual(["/join/ABCDE"]);
    expect(screen.queryByTestId("host-view")).toBeNull();
  });

  it("sends a phone that is not the host to its controller", async () => {
    render(<CreateTree />);
    const code = await createRoom();
    // The phone joins: the room node itself gains its player record.
    const room = fake.read(`rooms/${code}`) as Record<string, unknown>;
    fake.write(`rooms/${code}`, {
      ...room,
      players: {
        ...(room.players as Record<string, unknown>),
        phone: {
          id: "phone",
          nickname: "好友1",
          avatar: "🦊",
          isHost: false,
          role: "player",
          isConnected: true,
          isReady: false,
          score: 0,
        },
      },
    });

    // The phone scanned the QR code: its own identity and its own session.
    cleanup();
    fake.auth.currentUser = { uid: "phone" };
    sessionStorage.setItem(
      "partyverse_session",
      JSON.stringify({ userId: "phone", roomCode: code, nickname: "好友1", mode: "firebase" }),
    );
    render(<Tree roomCode={code} />);
    await flush("system");
    await flush("rooms");
    expect(nav.replace).toEqual([`/room/${code}/play`]);
  });
});
