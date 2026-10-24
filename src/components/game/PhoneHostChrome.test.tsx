// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";

/**
 * Inside the phone-host wrapper the stage and controller shells must not each
 * paint their own identity bar (two room codes on one phone) or their own fixed
 * bottom dock (which would sit underneath the stage/controller switch).
 */
const room: Room = {
  ...testRoom("brainteaser", 2),
  hostMode: "phone",
  players: {
    ...testRoom("brainteaser", 2).players,
    tv: { ...testRoom("brainteaser", 2).players.tv, role: "player", isReady: true },
  },
  gameState: { phase: "question", timeLeft: 10, currentScores: { tv: 3 } },
} as Room;

// `PlayShell` mounts `LeaveGuard`, which asks the App Router for a history hook.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }) }));

vi.mock("@/providers/RoomContext", () => ({
  useRoom: () => ({
    room,
    player: room.players[room.hostPlayerId],
    isHost: true,
    connectionStatus: "local",
    isLocalMode: true,
    submitAction: async () => {},
  }),
}));

const { PhoneHostChrome } = await import("@/components/game/PhoneHostChrome");
const { HostShell } = await import("@/components/game/HostShell");
const { PlayShell } = await import("@/components/game/PlayShell");

afterEach(cleanup);

describe("shells embedded in the phone-host chrome", () => {
  it("keeps one identity bar instead of three", () => {
    render(
      <PhoneHostChrome tab="stage" onTabChange={() => {}}>
        <HostShell>
          <p>舞台內容</p>
        </HostShell>
      </PhoneHostChrome>,
    );
    expect(screen.getByText("舞台內容")).toBeTruthy();
    // The wrapper's bar, and the shell's own "房間 TESTA" pill is gone.
    expect(screen.getAllByText(/手機主持 · 房間/)).toHaveLength(1);
    expect(screen.queryByText("房間 TESTA", { exact: true })).toBeNull();
  });

  it("drops the controller's own top bar and fixed score dock", () => {
    render(
      <PhoneHostChrome tab="controller" onTabChange={() => {}}>
        <PlayShell>
          <p>手把內容</p>
        </PlayShell>
      </PhoneHostChrome>,
    );
    expect(screen.getByText("手把內容")).toBeTruthy();
    expect(screen.queryByText("房間 TESTA", { exact: false })).toBeNull();
    expect(screen.queryByText(/得分：/)).toBeNull();
    // The wrapper still shows the host's live score, once.
    expect(screen.getByLabelText("我的得分 3")).toBeTruthy();
  });

  it("keeps both bars on the normal big-screen and phone-player shells", () => {
    render(
      <HostShell>
        <p>電視舞台</p>
      </HostShell>,
    );
    expect(screen.getByText("房間 TESTA", { exact: true })).toBeTruthy();
    cleanup();

    render(
      <PlayShell>
        <p>玩家手把</p>
      </PlayShell>,
    );
    expect(screen.getByText(/得分：/)).toBeTruthy();
  });
});
