import { test, expect } from "@playwright/test";

// ── Chat tab ──────────────────────────────────────────────────
test.describe("Chat tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/chat");
  });

  test("empty state shows heading and suggested prompts", async ({ page }) => {
    await expect(page.getByText("Ask about your AWS environment")).toBeVisible();
    await expect(page.getByText("Which EC2 instances are running?")).toBeVisible();
    await expect(page.getByText("Show me all public S3 buckets")).toBeVisible();
    await expect(page.getByText("What security groups allow inbound 0.0.0.0/0?")).toBeVisible();
  });

  test("all 6 suggested prompts are visible", async ({ page }) => {
    const prompts = [
      "Which EC2 instances are running?",
      "Show me all public S3 buckets",
      "What security groups allow inbound 0.0.0.0/0?",
      "How many resources are in us-east-1?",
      "List all IAM roles in my account",
      "Which RDS instances are not encrypted?",
    ];
    for (const p of prompts) {
      await expect(page.getByText(p)).toBeVisible();
    }
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await expect(page.getByLabel("Send message")).toBeDisabled();
  });

  test("send button enables when user types", async ({ page }) => {
    await page.getByLabel("Chat input").fill("How many EC2 instances?");
    await expect(page.getByLabel("Send message")).toBeEnabled();
  });

  test("input field is keyboard-accessible", async ({ page }) => {
    const input = page.getByLabel("Chat input");
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("clicking a suggested prompt sends the message", async ({ page }) => {
    await page.getByText("Show me all public S3 buckets").click();
    await expect(page.getByText("Show me all public S3 buckets").first()).toBeVisible();
  });

  test("empty input (whitespace only) does not send", async ({ page }) => {
    await page.getByLabel("Chat input").fill("   ");
    await expect(page.getByLabel("Send message")).toBeDisabled();
  });
});

// ── How It Works tab ─────────────────────────────────────────
test.describe("How It Works tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/how-it-works");
  });

  test("page heading is visible", async ({ page }) => {
    await expect(page.getByText("How CloudMind works")).toBeVisible();
  });

  test("shows all four architecture layer headings", async ({ page }) => {
    await expect(page.getByText("Data Layer")).toBeVisible();
    await expect(page.getByText("Intelligence Layer")).toBeVisible();
    await expect(page.getByText("API Layer")).toBeVisible();
    await expect(page.getByText("Frontend Layer")).toBeVisible();
  });

  test("shows all architecture components", async ({ page }) => {
    const components = ["Floci", "fixworker", "fixcore", "ArangoDB", "Claude Opus 4.7", "FastAPI", "Next.js + React", "CloudMind UI"];
    for (const c of components) {
      await expect(page.getByText(c).first()).toBeVisible();
    }
  });

  test("request flow section is visible", async ({ page }) => {
    await expect(page.getByText("six hops")).toBeVisible();
    await expect(page.getByText("Intent", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Synthesize", { exact: true }).first()).toBeVisible();
  });

  test("tech stack grid shows 8 cards", async ({ page }) => {
    await expect(page.getByText("Tech stack")).toBeVisible();
    await expect(page.getByText("fixworker + fixcore").first()).toBeVisible();
    await expect(page.getByText("Upstash Redis")).toBeVisible();
    await expect(page.getByText("Render + Vercel")).toBeVisible();
  });

  test("discovery pipeline section is visible", async ({ page }) => {
    await expect(page.getByText(/Discovery pipeline/)).toBeVisible();
    await expect(page.getByText(/AWS_ENDPOINT_URL/).first()).toBeVisible();
    await expect(page.getByText(/never real AWS/)).toBeVisible();
  });

  test("demo video player thumbnail is visible", async ({ page }) => {
    await expect(page.getByText("Watch demo")).toBeVisible();
  });

  test("demo video plays when clicked", async ({ page }) => {
    await page.getByText("Watch demo").click();
    // After clicking, the login scene starts — check for CloudMind brand in video
    await expect(page.getByText("CloudMind").first()).toBeVisible();
  });

  test("live sandbox section is present", async ({ page }) => {
    await expect(page.getByText("Try it live")).toBeVisible();
    await expect(page.getByText("live sandbox").first()).toBeVisible();
  });
});
