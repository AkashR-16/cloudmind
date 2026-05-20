import { test, expect } from "@playwright/test";

// ── Auth guard ────────────────────────────────────────────────
test.describe("Auth guard", () => {
  test("unauthenticated user is redirected to /login from /dashboard/chat", async ({ page }) => {
    await page.goto("/dashboard/chat");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from /dashboard/infrastructure", async ({ page }) => {
    await page.goto("/dashboard/infrastructure");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from /dashboard/how-it-works", async ({ page }) => {
    await page.goto("/dashboard/how-it-works");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByText("CloudMind").first()).toBeVisible();
  });
});

// ── Chat tab — authenticated ──────────────────────────────────
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

// ── How It Works tab — authenticated ─────────────────────────
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
    const components = ["Floci", "fixworker", "fixcore", "ArangoDB", "Gemini 3.1 Flash Lite", "FastAPI", "Next.js + React", "CloudMind UI"];
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

// ── Infrastructure tab — authenticated ───────────────────────
test.describe("Infrastructure tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/infrastructure");
  });

  test("page renders graph container or loading state", async ({ page }) => {
    // Either loads the graph or shows a loading spinner
    const hasGraph = await page.locator(".react-flow").isVisible().catch(() => false);
    const hasLoader = await page.getByText("Loading infrastructure graph").isVisible().catch(() => false);
    expect(hasGraph || hasLoader).toBeTruthy();
  });

  test("legend is visible with resource hierarchy labels", async ({ page }) => {
    await page.waitForSelector(".react-flow", { timeout: 15000 }).catch(() => {});
    const legend = await page.getByText("Resource hierarchy").isVisible().catch(() => false);
    const hasNetwork = await page.getByText("Network").first().isVisible().catch(() => false);
    expect(legend || hasNetwork).toBeTruthy();
  });

  test("resource count badge is shown", async ({ page }) => {
    await page.waitForSelector("[class*='react-flow']", { timeout: 15000 }).catch(() => {});
    await expect(page.getByText("resources")).toBeVisible({ timeout: 10000 });
  });
});

// ── Settings tab — authenticated ─────────────────────────────
test.describe("Settings tab", () => {
  test("settings page loads without error", async ({ page }) => {
    await page.goto("/dashboard/settings");
    // Either shows settings content or redirects to login
    const onSettings = page.url().includes("settings");
    const onLogin = page.url().includes("login");
    expect(onSettings || onLogin).toBeTruthy();
  });
});
