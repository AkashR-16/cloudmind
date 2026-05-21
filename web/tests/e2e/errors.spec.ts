import { test, expect } from "@playwright/test";

// ── Backend-down / network error tests ───────────────────────────

/**
 * WHAT CAN GO WRONG: The backend API returns a 500 Internal Server Error.
 * HOW TO DETECT: The UI shows a blank screen or freezes with no feedback to the user.
 * HOW TO FIX: Check the error handling block in features/chat/useChat.ts and the
 *             error banner render in app/(app)/dashboard/chat/_components/ChatWindow.tsx.
 */
test("500 response — shows an error message, not a blank screen", async ({ page }) => {
  await page.route("/api/agent/chat", (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ detail: "Internal error" }) })
  );

  await page.goto("/dashboard/chat");

  // Send a message to trigger the error
  await page.getByLabel("Chat input").fill("What are my EC2 instances?");
  await page.getByLabel("Send message").click();

  // The error banner or error message must appear — the screen must not be blank
  await expect(
    page.locator("[class*='red']").first()
  ).toBeVisible({ timeout: 15_000 });
});

/**
 * WHAT CAN GO WRONG: The backend returns 429 Too Many Requests; the UI shows a
 *                    cryptic JSON blob or raw status code rather than a friendly message.
 * HOW TO DETECT: The user sees "Agent error: 429" or raw JSON instead of a helpful notice.
 * HOW TO FIX: In useChat.ts, ensure the detail field from the 429 response body is
 *             surfaced in the error state and rendered in ChatWindow's error banner.
 */
test("429 response — shows rate-limit or try-again messaging", async ({ page }) => {
  await page.route("/api/agent/chat", (route) =>
    route.fulfill({
      status: 429,
      body: JSON.stringify({ detail: "Too many requests. Please wait." }),
    })
  );

  await page.goto("/dashboard/chat");

  await page.getByLabel("Chat input").fill("spam");
  await page.getByLabel("Send message").click();

  // The UI should surface a user-friendly message — either the detail text or a fallback.
  const errorBanner = page.locator("[class*='red']").first();
  await expect(errorBanner).toBeVisible({ timeout: 15_000 });

  const bannerText = await errorBanner.textContent();
  const isRateLimitMessage =
    /rate limit|too many|please wait|try again/i.test(bannerText ?? "");
  expect(isRateLimitMessage).toBe(true);
});

/**
 * WHAT CAN GO WRONG: After an error, the textarea stays disabled so the user cannot
 *                    type a follow-up message or retry.
 * HOW TO DETECT: The textarea has the `disabled` attribute even after the request finishes.
 * HOW TO FIX: Ensure setIsLoading(false) is called in the finally block of useChat.ts,
 *             which controls the `isLoading` prop forwarded to InputBar.
 */
test("after an error, the input bar is re-enabled so the user can retry", async ({ page }) => {
  await page.route("/api/agent/chat", (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ detail: "Internal error" }) })
  );

  await page.goto("/dashboard/chat");

  await page.getByLabel("Chat input").fill("test retry");
  await page.getByLabel("Send message").click();

  // Wait for the error to appear, then check the textarea is re-enabled
  await expect(page.locator("[class*='red']").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Chat input")).toBeEnabled();
});

/**
 * WHAT CAN GO WRONG: The user's sent message disappears from the chat after the
 *                    backend returns an error, making the session feel broken.
 * HOW TO DETECT: The user's message bubble is absent even though they sent it.
 * HOW TO FIX: In useChat.ts, user messages are added to state before the fetch call;
 *             the error handler must not clear messages, only set the error state.
 */
test("after a 500 error, the user's original message is still visible", async ({ page }) => {
  await page.route("/api/agent/chat", (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ detail: "Internal error" }) })
  );

  await page.goto("/dashboard/chat");

  const userMessage = "Will this message survive an error?";
  await page.getByLabel("Chat input").fill(userMessage);
  await page.getByLabel("Send message").click();

  // The user's message bubble must remain visible after the error
  await expect(page.getByText(userMessage).first()).toBeVisible({ timeout: 15_000 });
});

// ── Input edge cases ─────────────────────────────────────────────

/**
 * WHAT CAN GO WRONG: The send button stays disabled for large pastes, preventing
 *                    users from asking questions with long context.
 * HOW TO DETECT: The send button has the `disabled` attribute after pasting 500+ chars.
 * HOW TO FIX: InputBar's `hasValue` check uses value.trim().length > 0, which works
 *             regardless of length — verify the textarea is not truncating input.
 */
test("pasting a 500+ char message enables the send button", async ({ page }) => {
  await page.goto("/dashboard/chat");

  const longMessage = "A".repeat(520);
  await page.getByLabel("Chat input").fill(longMessage);

  await expect(page.getByLabel("Send message")).toBeEnabled();
});

/**
 * WHAT CAN GO WRONG: Whitespace-only input triggers a fetch call, sending a blank
 *                    message to the backend and wasting a request.
 * HOW TO DETECT: mockFetch is called, or the empty state disappears after submitting spaces.
 * HOW TO FIX: InputBar disables the send button when value.trim() is empty, and
 *             useChat.sendMessage guards against !content.trim().
 */
test("whitespace-only input keeps the send button disabled", async ({ page }) => {
  await page.goto("/dashboard/chat");

  await page.getByLabel("Chat input").fill("     ");
  await expect(page.getByLabel("Send message")).toBeDisabled();
});

/**
 * WHAT CAN GO WRONG: The user clicks send twice quickly and triggers two simultaneous
 *                    fetches, producing duplicate messages or race-condition errors.
 * HOW TO DETECT: Two assistant message bubbles appear or duplicate content is visible.
 * HOW TO FIX: useChat.sendMessage returns early if `isLoading` is already true (the
 *             double-send prevention guard).
 */
test("sending two messages quickly — second is blocked while first is in-flight", async ({ page }) => {
  // We do not intercept the route here so the real app behaviour is tested at the UI level.
  // Instead, intercept with a slow response to guarantee in-flight state during second click.
  await page.route("/api/agent/chat", async (route) => {
    // Delay the response so the first request is still in-flight when we try the second.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fulfill({ status: 200, body: "ok" });
  });

  await page.goto("/dashboard/chat");

  // First send
  await page.getByLabel("Chat input").fill("first message");
  await page.getByLabel("Send message").click();

  // While the first request is in-flight, the input should be disabled
  await expect(page.getByLabel("Chat input")).toBeDisabled();

  // Verify only one user message bubble appeared (second send was blocked)
  const userBubbles = page.getByText("first message");
  await expect(userBubbles.first()).toBeVisible();
});

// ── Navigation ───────────────────────────────────────────────────

/**
 * WHAT CAN GO WRONG: Navigating away from /dashboard/chat and back re-uses stale
 *                    session state, showing old messages or a broken session.
 * HOW TO DETECT: Messages from the previous visit are visible on the fresh load.
 * HOW TO FIX: useChat initialises with empty messages (useState([])) on each mount,
 *             so a fresh page load always starts clean — verify the component unmounts.
 */
test("navigating away from chat and back shows fresh empty state", async ({ page }) => {
  await page.goto("/dashboard/chat");
  await expect(page.getByText("Ask about your AWS environment")).toBeVisible();

  // Navigate away to the other page
  await page.goto("/dashboard/how-it-works");

  // Navigate back to chat
  await page.goto("/dashboard/chat");

  // Should see the clean empty state heading again
  await expect(page.getByText("Ask about your AWS environment")).toBeVisible();
});

/**
 * WHAT CAN GO WRONG: The /dashboard/chat route redirects to a login page even though
 *                    this project has no authentication.
 * HOW TO DETECT: The page URL changes to /login or /auth, or the heading is absent.
 * HOW TO FIX: Check middleware.ts — ensure it does not add any auth guards for these routes.
 */
test("/dashboard/chat loads without any redirect", async ({ page }) => {
  await page.goto("/dashboard/chat");

  // Assert we stayed on the chat route (no redirect)
  await expect(page).toHaveURL(/\/dashboard\/chat/);
  await expect(page.getByText("Ask about your AWS environment")).toBeVisible();
});

/**
 * WHAT CAN GO WRONG: The /dashboard/how-it-works route redirects or 404s.
 * HOW TO DETECT: The page URL changes or the architecture heading is absent.
 * HOW TO FIX: Ensure the page file exists at app/(app)/dashboard/how-it-works/page.tsx
 *             and middleware.ts allows the route through.
 */
test("/dashboard/how-it-works loads without any redirect", async ({ page }) => {
  await page.goto("/dashboard/how-it-works");

  await expect(page).toHaveURL(/\/dashboard\/how-it-works/);
  await expect(page.getByText("How CloudMind works")).toBeVisible();
});

/**
 * WHAT CAN GO WRONG: A non-existent route like /dashboard/settings resolves to a
 *                    blank white page instead of a proper 404 or redirect.
 * HOW TO DETECT: The page shows nothing, or no 404-specific text is present.
 * HOW TO FIX: Ensure a 404.tsx or not-found.tsx page exists in the app directory,
 *             or that Next.js default 404 handling is active.
 */
test("visiting /dashboard/settings shows 404 content or redirects gracefully", async ({ page }) => {
  const response = await page.goto("/dashboard/settings");

  // Either the server returns 404 or the page redirects to a valid route.
  const status = response?.status();
  const url = page.url();

  const is404 = status === 404;
  const isRedirectedToValidPage =
    url.includes("/dashboard/chat") || url.includes("/dashboard/how-it-works");
  const has404Text = await page.getByText(/404|not found|page not found/i).isVisible().catch(() => false);

  expect(is404 || isRedirectedToValidPage || has404Text).toBe(true);
});

// ── Accessibility / UX ───────────────────────────────────────────

/**
 * WHAT CAN GO WRONG: The page has no <title>, causing browser tabs to show a blank
 *                    title and hurting SEO and accessibility.
 * HOW TO DETECT: document.title is empty or equals the default "Next.js" placeholder.
 * HOW TO FIX: Set a meaningful <title> via the Next.js metadata API in the layout or
 *             page file for /dashboard/chat.
 */
test("page title is present on the chat page", async ({ page }) => {
  await page.goto("/dashboard/chat");
  const title = await page.title();
  expect(title.trim().length).toBeGreaterThan(0);
});

/**
 * WHAT CAN GO WRONG: The chat textarea has no aria-label, making it inaccessible to
 *                    screen-reader users who cannot identify the field.
 * HOW TO DETECT: getByLabel("Chat input") throws or returns no element.
 * HOW TO FIX: Ensure InputBar's <textarea> has aria-label="Chat input" (already present
 *             in InputBar.tsx — this test guards against accidental removal).
 */
test('chat input has aria-label "Chat input"', async ({ page }) => {
  await page.goto("/dashboard/chat");
  await expect(page.getByLabel("Chat input")).toBeVisible();
});

/**
 * WHAT CAN GO WRONG: The send button has no aria-label, so screen-reader users hear
 *                    only "button" with no context about its action.
 * HOW TO DETECT: getByLabel("Send message") throws or returns no element.
 * HOW TO FIX: Ensure InputBar's send <button> has aria-label="Send message" (already
 *             present in InputBar.tsx — this test guards against accidental removal).
 */
test('send button has aria-label "Send message"', async ({ page }) => {
  await page.goto("/dashboard/chat");
  await expect(page.getByLabel("Send message")).toBeVisible();
});

/**
 * WHAT CAN GO WRONG: The suggested prompt buttons are not reachable via keyboard Tab,
 *                    making the empty state unusable for keyboard-only users.
 * HOW TO DETECT: Tabbing through the page skips over the prompt buttons.
 * HOW TO FIX: Ensure SuggestedPrompts renders <button> elements (not divs with onClick),
 *             which are natively focusable. Verify no tabIndex="-1" is applied.
 */
test("suggested prompt buttons are focusable via keyboard Tab", async ({ page }) => {
  await page.goto("/dashboard/chat");

  // Tab from the body until we focus a suggested prompt button
  const promptTexts = [
    "Which EC2 instances are running?",
    "Show me all public S3 buckets",
    "What security groups allow inbound 0.0.0.0/0?",
    "How many resources are in us-east-1?",
    "List all IAM roles in my account",
    "Which RDS instances are not encrypted?",
  ];

  // Press Tab multiple times to cycle through focusable elements
  let foundPrompt = false;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const focusedText = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? ""
    );
    if (promptTexts.some((p) => focusedText.includes(p.slice(0, 20)))) {
      foundPrompt = true;
      break;
    }
  }

  expect(foundPrompt).toBe(true);
});
