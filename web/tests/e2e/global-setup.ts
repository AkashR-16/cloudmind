import { chromium } from "@playwright/test";
import path from "path";

export const AUTH_FILE = path.join(__dirname, ".auth.json");

export default async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill("test@cloudmind.io");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);

  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
