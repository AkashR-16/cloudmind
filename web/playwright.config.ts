import { defineConfig, devices } from "@playwright/test";
import path from "path";

const externalBase =
  process.env.PLAYWRIGHT_BASE_URL &&
  !process.env.PLAYWRIGHT_BASE_URL.startsWith("http://localhost");

export const AUTH_FILE = path.join(__dirname, "tests/e2e/.auth.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Unauthenticated project — no storage state (fresh cookies)
    {
      name: "chromium-anon",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/chat.spec.ts",
      grep: /Auth guard/,
    },
    // Authenticated project — session cookie pre-loaded
    {
      name: "chromium-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      testMatch: "**/chat.spec.ts",
      grep: /Chat tab|How It Works|Infrastructure|Settings/,
    },
  ],
  ...(externalBase
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
        },
      }),
});
