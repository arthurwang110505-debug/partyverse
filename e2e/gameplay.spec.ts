import { expect, test, type Page } from "@playwright/test";
import { playableGameIds } from "../src/engine";
import { databaseRoundTrip, testRoom } from "../src/test/fixtures";
import { advanceRoomGame, startRoomGame } from "../src/lib/gameSession";
import type { Room } from "../src/types";

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

for (const gameId of playableGameIds()) {
  for (const side of ["host", "play"]) {
    test(`${gameId}: ${side} renders after an empty-collection database round trip`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const room = databaseRoundTrip(startRoomGame(testRoom(gameId), Date.now()));
      await seed(page, room, side === "host" ? "tv" : "p1");
      await page.goto(`/room/${room.id}/${side}`);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByText("連接房間中…", { exact: true })).toHaveCount(0);
      await expect(page.getByText("找不到這個遊戲，請回大廳重新選擇。")).toHaveCount(0);
      await expect(page.getByText(/得分：/).or(page.getByText(`房間 ${room.id}`, { exact: true }))).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test("one TV and four independent demo tabs join, play, refresh, rematch and switch games", async ({
  page: tv,
  context,
}) => {
  await tv.goto("/create/everybodyknows");
  await tv.getByLabel("房主暱稱（顯示在電視上）").fill("客廳電視");
  await tv.getByLabel("回合數", { exact: true }).selectOption("1");
  await tv.getByRole("button", { name: "建立房間", exact: true }).click();
  await tv.waitForURL(/\/room\/[^/]+\/host$/);
  const code = tv.url().split("/").at(-2)!;
  const phones = await Promise.all(Array.from({ length: 4 }, () => context.newPage()));
  // Concurrent joins exercise the demo store's cross-tab Web Locks.
  await Promise.all(
    phones.map(async (phone, i) => {
      await phone.goto(`/join/${code}`);
      await phone.getByLabel("你的暱稱").fill(`好友${i + 1}`);
      await phone.getByRole("button", { name: "加入派對" }).click();
      await phone.waitForURL(new RegExp(`/room/${code}/play$`));
      await phone.getByRole("button", { name: /點擊確認準備就緒/ }).click();
      await expect(phone.getByRole("button", { name: /已就緒/ })).toBeVisible();
    }),
  );
  const room = await readRoom(tv, code);
  expect(Object.keys(room.players)).toHaveLength(5);
  const ids = await Promise.all(
    phones.map((phone) => phone.evaluate(() => sessionStorage.getItem("partyverse_local_uid"))),
  );
  expect(new Set(ids).size).toBe(4);
  await tv.getByRole("button", { name: "全員就緒！立刻開始" }).click();
  await expect.poll(async () => (await readRoom(tv, code)).status).toBe("PLAYING");
  expect((await readRoom(tv, code)).participantIds).toHaveLength(4);
  // All phones vote for the same actual player; the TV must not be required.
  await Promise.all(
    phones.map(async (phone) => {
      await phone.getByRole("button", { name: /好友1/ }).click();
    }),
  );
  await expect.poll(async () => (await readRoom(tv, code)).gameState.phase).toBe("reveal");
  await phones[0].reload();
  await expect(phones[0].getByRole("main")).toBeVisible();
  expect(await phones[0].evaluate(() => sessionStorage.getItem("partyverse_local_uid"))).toBe(ids[0]);
  await tv.waitForURL(new RegExp(`/room/${code}/results$`));
  await expect(tv.getByText("並列冠軍：", { exact: false })).toBeVisible();
  await tv.getByRole("button", { name: "再玩一次（回大廳）" }).click();
  await expect(tv).toHaveURL(new RegExp(`/room/${code}/host$`));
  await Promise.all(
    phones.map(async (phone) => {
      await expect(phone).toHaveURL(new RegExp(`/room/${code}/play$`));
      await expect(phone.getByRole("button", { name: /點擊確認準備就緒/ })).toBeVisible();
      await phone.getByRole("button", { name: /點擊確認準備就緒/ }).click();
    }),
  );
  await tv.getByRole("button", { name: "全員就緒！立刻開始" }).click();
  await expect.poll(async () => (await readRoom(tv, code)).status).toBe("PLAYING");
  await tv.getByRole("button", { name: "結束並結算", exact: true }).click();
  await tv.getByRole("button", { name: "確認結算" }).click();
  await tv.waitForURL(new RegExp(`/room/${code}/results$`));
  await tv.getByRole("button", { name: /換一款遊戲（免重新掃碼）/ }).click();
  await tv
    .getByRole("dialog")
    .getByRole("button", { name: /你畫我猜/ })
    .click();
  await expect.poll(async () => (await readRoom(tv, code)).gameId).toBe("drawandguess");
  await Promise.all(
    phones.map((phone) => expect(phone.getByRole("heading", { name: "你畫我猜", exact: true })).toBeVisible()),
  );
  expect(Object.keys((await readRoom(tv, code)).players)).toHaveLength(5);
});

test("drawing streams before pointer-up, guesses stay secret, and controls stop at reveal", async ({
  page: drawer,
  context,
}) => {
  let room = startRoomGame(testRoom("drawandguess"), Date.now() - 3100);
  room = advanceRoomGame(room, Date.now());
  const drawerId = room.gameState.drawerPlayerId as string;
  const guesserId = room.participantIds!.find((id) => id !== drawerId)!;
  await seed(drawer, room, drawerId);
  await drawer.goto(`/room/${room.id}/play`);
  const tv = await context.newPage();
  await seed(tv, room, "tv");
  await tv.goto(`/room/${room.id}/host`);
  const guesser = await context.newPage();
  await seed(guesser, room, guesserId);
  await guesser.goto(`/room/${room.id}/play`);
  const canvas = drawer.getByRole("img", { name: "繪畫畫布" });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await drawer.mouse.move(box.x + 30, box.y + 40);
  await drawer.mouse.down();
  await drawer.mouse.move(box.x + 120, box.y + 130, { steps: 8 });
  await expect(tv.getByRole("img", { name: "共享畫布" }).locator("path")).toHaveCount(1);
  await drawer.mouse.move(box.x + 180, box.y + 200, { steps: 8 });
  await drawer.mouse.up();
  await expect.poll(async () => (await readRoom(tv, room.id)).gameState.strokes as unknown[]).toHaveLength(1);
  const prompt = (room.gameState.prompt as { word: string }).word;
  await guesser.getByLabel("看看大螢幕，你猜這是什麼？").fill(prompt);
  await guesser.getByRole("button", { name: "送出答案", exact: true }).click();
  await expect(guesser.getByText(/答對了！\+/)).toBeVisible();
  await expect(tv.getByLabel("即時猜題動態")).toContainText("答對了！");
  await expect(tv.getByLabel("即時猜題動態")).not.toContainText(prompt);
  await drawer.getByRole("button", { name: "復原上一筆" }).click();
  await expect(tv.getByRole("img", { name: "共享畫布" }).locator("path")).toHaveCount(0);
  for (const id of room.participantIds!.filter((id) => id !== drawerId && id !== guesserId)) {
    const phone = await context.newPage();
    await seed(phone, room, id);
    await phone.goto(`/room/${room.id}/play`);
    await phone.getByLabel("看看大螢幕，你猜這是什麼？").fill(prompt);
    await phone.getByRole("button", { name: "送出答案", exact: true }).click();
  }
  await expect(drawer.getByRole("img", { name: "繪畫畫布" })).toHaveCount(0);
  await expect(drawer.getByRole("heading", { name: prompt, exact: true })).toBeVisible();
  await expect(guesser.getByRole("button", { name: "送出答案", exact: true })).toHaveCount(0);
});

test("late joiner sees a spectator controller instead of being assigned a turn", async ({ page }) => {
  const room = startRoomGame(testRoom("drawandguess"), Date.now());
  room.players.late = { ...room.players.p1, id: "late", nickname: "新朋友" };
  await seed(page, room, "late");
  await page.goto(`/room/${room.id}/play`);
  await expect(page.getByRole("heading", { name: "本場先當觀眾" })).toBeVisible();
});

test("a phone can take over a stale host and keep its controller", async ({ page }) => {
  const room = startRoomGame(testRoom("everybodyknows"), Date.now() - 21000);
  await seed(page, room, "p1");
  await page.goto(`/room/${room.id}/play`);
  await page.getByRole("button", { name: "由我接管房主" }).click();
  await expect.poll(async () => (await readRoom(page, room.id)).hostPlayerId).toBe("p1");
  await expect(page.getByRole("button", { name: "結束並結算", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "由我接管房主" })).toHaveCount(0);
  await expect.poll(async () => (await readRoom(page, room.id)).gameState.phase).toBe("reveal");
});
