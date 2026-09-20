import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        }
      : {},
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --hostname 0.0.0.0",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: { NEXT_PUBLIC_FIREBASE_API_KEY: "", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "" },
      },
});
