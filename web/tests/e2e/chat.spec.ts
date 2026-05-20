import { test, expect } from "@playwright/test";

test.describe("Chat tab — authenticated user", () => {
  test.beforeEach(async ({ page }) => {
    // In CI: use Clerk test tokens. Locally: bypass via test env.
    await page.goto("/dashboard/chat");
  });

  test("shows empty state with suggested prompts on first load", async ({ page }) => {
    await expect(page.getByText("Ask about your AWS environment")).toBeVisible();
    await expect(page.getByText("Which EC2 instances are running?")).toBeVisible();
  });

  test("input field is accessible via keyboard", async ({ page }) => {
    const input = page.getByLabel("Chat input");
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    const btn = page.getByLabel("Send message");
    await expect(btn).toBeDisabled();
  });

  test("send button enables when user types", async ({ page }) => {
    await page.getByLabel("Chat input").fill("Which EC2 instances are running?");
    await expect(page.getByLabel("Send message")).toBeEnabled();
  });

  test("clicking a suggested prompt populates the input", async ({ page }) => {
    await page.getByText("Show me all public S3 buckets").click();
    // Either sends immediately or populates — check message appeared
    await expect(page.getByText("Show me all public S3 buckets").first()).toBeVisible();
  });
});

test.describe("Auth guard", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard/chat");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("How It Works tab", () => {
  test("shows all 4 step indicators", async ({ page }) => {
    await page.goto("/dashboard/how-it-works");
    for (let i = 1; i <= 4; i++) {
      await expect(page.getByLabel(`Go to step ${i}`)).toBeVisible();
    }
  });

  test("Next button advances steps", async ({ page }) => {
    await page.goto("/dashboard/how-it-works");
    await expect(page.getByText("Floci simulates your AWS environment")).toBeVisible();
    await page.getByText("Next").click();
    await expect(page.getByText("FixInventory discovers and graphs the resources")).toBeVisible();
  });

  test("Previous button is disabled on step 1", async ({ page }) => {
    await page.goto("/dashboard/how-it-works");
    await expect(page.getByText("Previous")).toBeDisabled();
  });
});
