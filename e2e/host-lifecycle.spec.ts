import { expect, test } from "@playwright/test";

/**
 * Host device lifecycle: create a room → close it → create another one, all on
 * the same device.
 *
 * Reported bug: the second room *was* created, but the host screen immediately
 * fell through to the join view (`/join/<code>`). `/create` and `/room` are
 * different route segments, so creating a room unmounts one `RoomProvider` and
 * mounts another one; the new provider had no room for a round trip and the room
 * gate read that as "this device is not in this room".
 *
 * This covers the user-visible flow end to end. The decision table itself
 * ("wait while a room is being opened" vs "bounce a settled non-member") is unit
 * tested in `src/lib/roomEntry.test.ts`, and the resumed-room handoff in
 * `src/lib/roomSession.test.ts`.
 */
test("a host can create a room again after closing the first one", async ({ page }) => {
  const createRoom = async () => {
    await page.goto("/games/everybodyknows");
    await page.getByRole("link", { name: "建立房間", exact: true }).click();
    await page.waitForURL(/\/create\/everybodyknows$/);
    await page.getByLabel("房主暱稱（顯示在電視上）").fill("客廳電視");
    await page.getByRole("button", { name: "建立房間", exact: true }).click();
    await page.waitForURL(/\/room\/[^/]+\/host$/);
    const code = page.url().split("/").at(-2)!;
    await expect(page.getByRole("heading", { name: "遊戲大廳" })).toBeVisible();
    await expect(page.getByRole("img", { name: `加入房間 ${code} 的 QR code` })).toBeVisible();
    return code;
  };

  const first = await createRoom();

  // Close it the way the TV does.
  await page.getByRole("button", { name: "結束房間", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "結束房間" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const second = await createRoom();
  expect(second).not.toBe(first);

  // The regression: no fall-through to the join screen for our own room.
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe(`/room/${second}/host`);
  await expect(page.getByRole("heading", { name: "遊戲大廳" })).toBeVisible();
  await expect(page.getByText(second, { exact: true })).toBeVisible();

  // A refresh has to come back to the same room too, not to the join form.
  await page.reload();
  await expect(page.getByRole("heading", { name: "遊戲大廳" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/room/${second}/host`);
  await expect(page.getByText(second, { exact: true })).toBeVisible();
});
