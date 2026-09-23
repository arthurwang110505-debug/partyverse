import { expect, test } from "@playwright/test";

for (const width of [320, 360, 390, 430, 844, 1280]) {
  test(`landing fits ${width}px and navigation has no duplicate destinations`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,p,a,span")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        })
        .map((element) => element.textContent?.trim().slice(0, 80)),
    );
    expect(clipped).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.mouse.wheel(0, 650);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    const nav = page.getByRole("navigation", { name: "主導覽" });
    if (width < 768) await nav.getByRole("button", { name: "開啟選單" }).click();
    await expect(nav.locator('a[href="/games"]:visible')).toHaveCount(1);
    await expect(nav.locator('a[href="/join"]:visible')).toHaveCount(1);
    await nav.getByRole("link", { name: "加入房間", exact: true }).click();
    await expect(page).toHaveURL(/\/join$/);
    await expect(page.getByRole("textbox").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("touch scrolling and menu taps remain responsive under CPU throttling", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Mobile animations intentionally stay enabled (2026-09-22 product decision).
  // Assert the actual interaction below, not the removed animation kill-switch.
  // Wait for native momentum scrolling to finish; otherwise the first tap
  // merely stops the browser's fling instead of activating a control.
  const scrollEnded = page.evaluate(
    () => new Promise<void>((resolve) => document.addEventListener("scrollend", () => resolve(), { once: true })),
  );
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 680 }] });
  for (const y of [620, 540, 460, 380, 300, 220]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await scrollEnded;
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "開啟選單" }).tap();
  await expect(page.getByRole("button", { name: "關閉選單" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation").getByRole("link", { name: "遊戲", exact: true }).tap();
  await expect(page).toHaveURL(/\/games$/);
  await context.close();
});

test("mobile menu closes with Escape and restores focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開啟選單" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "開啟選單" })).toBeFocused();
  await expect(page.locator("#mobile-menu")).toHaveCount(0);
});
