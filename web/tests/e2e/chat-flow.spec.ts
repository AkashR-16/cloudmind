/**
 * Real end-to-end smoke test for the chat flow.
 *
 * Closes GAP-1 from docs/TEST-COVERAGE-AUDIT.md.
 *
 * Strategy: intercept /api/agent/chat at the route layer with a real streaming
 * response so the test exercises the actual fetch → ReadableStream → TextDecoder
 * → UI append code path. This catches wiring bugs (e.g., a regression that
 * silently drops tokens or fails to handle empty chunks) that component-level
 * tests never see.
 *
 * Also covers session persistence across page reloads (the bug fixed earlier
 * this session: messages were lost on tab navigation).
 */
import { test, expect } from "@playwright/test";

const ANSWER = "Found 3 running EC2 instances: web-server-01, api-server-01, worker-node-1.";

async function mockChatStream(page: import("@playwright/test").Page) {
  // Build a real streaming response chunked at multi-token boundaries so the
  // frontend's TextDecoder + appendToken loop runs more than once.
  await page.route("**/api/agent/chat", async (route) => {
    const enc = new TextEncoder();
    const chunks = [
      enc.encode("Found 3 running "),
      enc.encode("EC2 instances: "),
      enc.encode("web-server-01, api-server-01, worker-node-1."),
    ];
    const body = chunks.reduce<Uint8Array>((acc, c) => {
      const next = new Uint8Array(acc.length + c.length);
      next.set(acc);
      next.set(c, acc.length);
      return next;
    }, new Uint8Array(0));
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: Buffer.from(body),
    });
  });
}

test.describe("Chat — end-to-end smoke (GAP-1)", () => {

  test("sends a message and streams the assistant response into the UI", async ({ page }) => {
    await mockChatStream(page);
    await page.goto("/dashboard/chat");

    await page.getByLabel("Chat input").fill("Which EC2 instances are running?");
    await page.getByLabel("Send message").click();

    // The user's message must appear immediately.
    await expect(page.getByText("Which EC2 instances are running?").first()).toBeVisible();

    // The streamed assistant answer must appear, end-to-end.
    await expect(page.getByText(ANSWER)).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a sidebar question sends it and renders an answer", async ({ page }) => {
    await mockChatStream(page);
    await page.goto("/dashboard/chat");

    // Sidebar is hidden below lg breakpoint; set a wide viewport explicitly.
    await page.setViewportSize({ width: 1280, height: 800 });

    // Click the sidebar button (use a question that's unique to the sidebar).
    await page.getByRole("button", { name: /List all Lambda functions/ }).click();

    await expect(page.getByText(ANSWER)).toBeVisible({ timeout: 10_000 });
  });

  test("conversation history survives a full page reload", async ({ page }) => {
    await mockChatStream(page);
    await page.goto("/dashboard/chat");

    await page.getByLabel("Chat input").fill("Which EC2 instances are running?");
    await page.getByLabel("Send message").click();
    await expect(page.getByText(ANSWER)).toBeVisible({ timeout: 10_000 });

    // Reload — the persisted-to-localStorage state must hydrate the conversation back.
    await page.reload();

    await expect(page.getByText("Which EC2 instances are running?").first()).toBeVisible();
    await expect(page.getByText(ANSWER)).toBeVisible();
  });

  test("conversation history survives navigation away and back", async ({ page }) => {
    await mockChatStream(page);
    await page.goto("/dashboard/chat");

    await page.getByLabel("Chat input").fill("Which EC2 instances are running?");
    await page.getByLabel("Send message").click();
    await expect(page.getByText(ANSWER)).toBeVisible({ timeout: 10_000 });

    // Navigate to another tab in the dashboard
    await page.goto("/dashboard/architecture");
    await expect(page.getByRole("heading", { name: "Architecture" })).toBeVisible();

    // Come back — messages must still be there
    await page.goto("/dashboard/chat");
    await expect(page.getByText("Which EC2 instances are running?").first()).toBeVisible();
    await expect(page.getByText(ANSWER)).toBeVisible();
  });

  test("Clear conversation wipes the chat after a successful exchange", async ({ page }) => {
    await mockChatStream(page);
    await page.goto("/dashboard/chat");

    await page.getByLabel("Chat input").fill("Which EC2 instances are running?");
    await page.getByLabel("Send message").click();
    await expect(page.getByText(ANSWER)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Clear conversation/ }).click();

    // Empty-state heading should be back
    await expect(page.getByText("Ask about your AWS environment")).toBeVisible();
    // The previous answer should be gone
    await expect(page.getByText(ANSWER)).toHaveCount(0);
  });
});
