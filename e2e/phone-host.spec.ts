import { expect, test, type Page } from "@playwright/test";
import { playableGameIds } from "../src/engine";
import { databaseRoundTrip, startPlayingRoom, testRoom } from "../src/test/fixtures";
import type { Room } from "../src/types";

/**
 * Phone-host mode: a complete party with no TV, projector or computer.
 *
 * The host phone is the stage. When the host chooses "我也要一起玩" they are a
 * normal participant too, so the same phone has to switch between the shared
 * stage and their own controller without stopping the clock.
 */

/** A room whose host seat is a playing participant, the way phone mode creates it. */
function phoneHostRoom(gameId: string, phones = 3): Room {
  const room = testRoom(gameId, phones);
  room.hostMode = "phone";
  room.players.tv = { ...room.players.tv, role: "player", isReady: true };
  return room;
}

async function seed(page: Page, room: Room, playerId: string) {
  await page.addInitScript(
    ({ room, playerId }) => {
      if (!localStorage.getItem(`partyverse_room_${room.id}`))
        localStorage.setItem(`partyverse_room_${room.id}`, JSON.stringify(room));
      sessionStorage.setItem("partyverse_local_uid", playerId);
      sessionStorage.setItem(
        "partyverse_session",
        JSON.stringify({
          roomCode: room.id,
          userId: playerId,
          nickname: room.players[playerId].nickname,
          mode: "local",
        }),
      );
    },
    { room, playerId },
  );
}

async function readRoom(page: Page, code: string): Promise<Room> {
  return page.evaluate((code) => JSON.parse(localStorage.getItem(`partyverse_room_${code}`)!), code);
}

/**
 * Click a tab and wait for the switch to take effect.
 *
 * The host page is server-rendered before React hydrates; an impatient click
 * lands on the static markup and does nothing, so retry the whole gesture.
 */
async function switchPhoneHostTab(page: Page, tab: "stage" | "controller") {
  const label = tab === "stage" ? "主持畫面" : "我的手把";
  await expect(async () => {
    await page.getByRole("button", { name: label }).click();
    await expect(page.locator(`[data-phone-host-tab="${tab}"]`)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
}

/** The page itself must never scroll sideways on a phone. */
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${innerWidth}px viewport`).toBeLessThanOrEqual(innerWidth + 1);
}

test.describe("phone-host stage", () => {
  for (const gameId of playableGameIds()) {
    test(`${gameId}: stage and controller both fit a phone`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const room = databaseRoundTrip(startPlayingRoom(phoneHostRoom(gameId), Date.now()));
      await seed(page, room, "tv");

      await page.goto(`/room/${room.id}/host`);
      // The wrapper identifies itself and offers both halves.
      await expect(page.getByText("手機主持 · 房間")).toBeVisible();
      await expect(page.getByRole("button", { name: "主持畫面" })).toBeVisible();
      await expect(page.getByRole("button", { name: "我的手把" })).toBeVisible();
      await expect(page.getByText("找不到這個遊戲，請回大廳重新選擇。")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      await switchPhoneHostTab(page, "controller");
      await expect(page.getByRole("button", { name: "我的手把" })).toHaveAttribute("aria-pressed", "true");
      await expectNoHorizontalOverflow(page);

      // 320px is still a supported phone (iPhone SE / small Android).
      await page.setViewportSize({ width: 320, height: 640 });
      await expectNoHorizontalOverflow(page);
      await switchPhoneHostTab(page, "stage");
      await expectNoHorizontalOverflow(page);

      expect(errors).toEqual([]);
    });
  }

  test("a legacy room without hostMode keeps the big-screen host", async ({ page }) => {
    const room = databaseRoundTrip(startPlayingRoom(testRoom("everybodyknows"), Date.now()));
    expect(room.hostMode).toBeUndefined();
    await seed(page, room, "tv");
    await page.goto(`/room/${room.id}/host`);
    await expect(page.getByText(`房間 ${room.id}`)).toBeVisible();
    await expect(page.getByText("手機主持 · 房間")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "我的手把" })).toHaveCount(0);
  });
});

test("two people can run a whole match from one phone, with no TV", async ({ page, context }) => {
  // ---- Host phone: create in phone mode and play too ----
  await page.goto("/create/brainteaser");
  await page.getByRole("radio", { name: /手機主持/ }).click();
  await page.getByLabel("房主暱稱（顯示在主持畫面）").fill("主持手機");
  await expect(page.getByRole("checkbox", { name: /我也要一起玩/ })).toBeChecked();
  await page.getByRole("button", { name: "建立房間", exact: true }).click();
  await page.waitForURL(/\/room\/[^/]+\/host$/);
  const code = page.url().split("/").at(-2)!;

  const stored = await readRoom(page, code);
  expect(stored.hostMode).toBe("phone");
  expect(stored.players[Object.keys(stored.players)[0]].role).toBe("player");

  await expect(page.getByRole("heading", { name: "手機主持" })).toBeVisible();
  await expect(page.getByRole("button", { name: /分享邀請/ })).toBeVisible();
  await expect(page.getByText("📺 電視不占玩家名額")).toHaveCount(0);

  // Host is a participant, so they confirm readiness like everybody else.
  await page.getByRole("button", { name: "我也準備好了" }).click();
  await expect(page.getByRole("button", { name: "取消我的就緒" })).toBeVisible();

  // ---- The only other player joins from their own phone ----
  const friend = await context.newPage();
  await friend.goto(`/join/${code}`);
  await friend.getByLabel("你的暱稱").fill("朋友一號");
  await friend.getByRole("button", { name: "加入派對" }).click();
  await friend.waitForURL(new RegExp(`/room/${code}/play$`));
  await friend.getByRole("button", { name: /點擊確認準備就緒/ }).click();
  await expect(friend.getByText("請看主持畫面", { exact: false })).toBeVisible();

  // Two participants is enough for Brain Teaser: no TV, no extra phones.
  await page.getByRole("button", { name: "全員就緒！立刻開始" }).click();
  await expect.poll(async () => (await readRoom(page, code)).status).toBe("PLAYING");
  expect((await readRoom(page, code)).participantIds).toHaveLength(2);

  // ---- Briefing: the host lands on their own controller ----
  await expect(page.getByRole("button", { name: "我看懂了，準備好了", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "我看懂了，準備好了", exact: true }).click();
  await friend.getByRole("button", { name: "我看懂了，準備好了", exact: true }).click();
  await expect.poll(async () => (await readRoom(page, code)).gameState.phase).not.toBe("rules");

  // ---- Stage and controller are one tap apart, and the clock keeps running ----
  const scoreBefore = (await readRoom(page, code)).gameState.timeLeft;
  await switchPhoneHostTab(page, "stage");
  await expect(page.getByText("手機主持 · 房間")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await switchPhoneHostTab(page, "controller");
  await expect
    .poll(async () => {
      const state = (await readRoom(page, code)).gameState as { timeLeft?: number };
      return typeof scoreBefore === "number" ? (state.timeLeft ?? 0) < scoreBefore : true;
    })
    .toBe(true);

  // ---- Wrap up from the host phone and land on shared results ----
  await page.getByRole("button", { name: "結束並結算", exact: true }).click();
  await page.getByRole("button", { name: "確認結算" }).click();
  await page.waitForURL(new RegExp(`/room/${code}/results$`));
  await expect(page.getByText("主持手機")).toBeVisible();
  await expect(page.getByText("朋友一號")).toBeVisible();
});

test("a presenting phone host stays out of the roster", async ({ page, context }) => {
  await page.goto("/create/brainteaser");
  await page.getByRole("radio", { name: /手機主持/ }).click();
  await page.getByRole("checkbox", { name: /我也要一起玩/ }).uncheck();
  await page.getByLabel("房主暱稱（顯示在主持畫面）").fill("主持手機");
  await page.getByRole("button", { name: "建立房間", exact: true }).click();
  await page.waitForURL(/\/room\/[^/]+\/host$/);
  const code = page.url().split("/").at(-2)!;

  await expect(page.getByText("這支手機只負責主持與顯示，不占玩家名額。")).toBeVisible();

  const friend = await context.newPage();
  await friend.goto(`/join/${code}`);
  await friend.getByLabel("你的暱稱").fill("朋友一號");
  await friend.getByRole("button", { name: "加入派對" }).click();
  await friend.waitForURL(new RegExp(`/room/${code}/play$`));

  // Brain Teaser needs 2 players; the display phone does not count toward it.
  await expect(page.getByText(/還差 1 人才能開始/)).toBeVisible();
  expect(Object.keys((await readRoom(page, code)).players)).toHaveLength(2);
});
