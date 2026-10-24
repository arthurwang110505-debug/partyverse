// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";

/**
 * The phone host keeps the stage and their own controller in one tab.
 *
 * These tests stub the two halves (they are the real, already covered views)
 * and check the wiring that only phone-host mode has: which half opens first,
 * how the briefing phase flips it, and that a presenting host never gets a
 * controller.
 */
const state = vi.hoisted(() => ({ room: null as Room | null }));

vi.mock("@/providers/RoomContext", () => ({
  useRoom: () => ({
    room: state.room,
    player: state.room?.players[state.room.hostPlayerId] ?? null,
    isHost: true,
    connectionStatus: "local",
    isLocalMode: true,
  }),
}));
vi.mock("./HostGameView", () => ({ default: () => <div data-testid="stage-view" /> }));
vi.mock("../play/PlayGameView", () => ({ default: () => <div data-testid="controller-view" /> }));

const { default: PhoneHostGameView } = await import("./PhoneHostGameView");

function phoneRoom(overrides: Partial<Room> = {}, phase = "voting"): Room {
  const room = testRoom("brainteaser", 2);
  return {
    ...room,
    hostMode: "phone",
    players: {
      ...room.players,
      tv: { ...room.players.tv, role: "player", isReady: true },
    },
    gameState: { phase, timeLeft: 10 },
    ...overrides,
  } as Room;
}

/**
 * The mocked `useRoom` has no subscription, so a "new snapshot" only reaches
 * the component when the harness re-renders — exactly what the provider does
 * when the room changes on the wire.
 */
const rerender = { current: () => {} };

function Harness() {
  const [, force] = useState(0);
  rerender.current = () => force((value) => value + 1);
  return <PhoneHostGameView />;
}

function mountRoom(room: Room) {
  state.room = room;
  render(<Harness />);
}

function pushRoom(room: Room) {
  act(() => {
    state.room = room;
    rerender.current();
  });
}

beforeEach(() => {
  state.room = null;
});
afterEach(cleanup);

describe("PhoneHostGameView", () => {
  it("opens a finished briefing on the host's own controller, then returns to the stage", () => {
    mountRoom(phoneRoom({}, "rules"));
    expect(screen.getByTestId("controller-view")).toBeTruthy();
    expect(screen.queryByTestId("stage-view")).toBeNull();

    // The briefing ends: the stage is what the table wants to see.
    pushRoom(phoneRoom({}, "question"));
    expect(screen.getByTestId("stage-view")).toBeTruthy();
    expect(screen.queryByTestId("controller-view")).toBeNull();
  });

  it("switches halves on demand and keeps the other one unmounted", () => {
    mountRoom(phoneRoom());
    expect(screen.getByTestId("stage-view")).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "我的手把" }));
    });
    expect(screen.getByTestId("controller-view")).toBeTruthy();
    expect(screen.getByRole("button", { name: "我的手把" })).toHaveProperty("ariaPressed", "true");
    expect(screen.queryByTestId("stage-view")).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "主持畫面" }));
    });
    expect(screen.getByTestId("stage-view")).toBeTruthy();
    expect(screen.getByRole("button", { name: "主持畫面" })).toHaveProperty("ariaPressed", "true");
  });

  it("gives a presenting host no controller at all", () => {
    const room = phoneRoom();
    mountRoom({ ...room, players: { ...room.players, tv: { ...room.players.tv, role: "display" } } } as Room);
    expect(screen.getByTestId("stage-view")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "我的手把" })).toBeNull();
    expect(screen.queryByRole("button", { name: "主持畫面" })).toBeNull();
  });
});
