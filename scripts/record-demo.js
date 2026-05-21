/**
 * Playwright script — records a demo video of CloudMind with 4 queries.
 *
 * Prerequisites:
 *   1. The full local stack must be running (backend + frontend):
 *        bash dev.sh
 *   2. Claude CLI must be on PATH (used by the backend in local mode).
 *
 * Run:
 *   node scripts/record-demo.js
 *
 * Output:
 *   web/public/demo.webm  (ready to serve — commit it or host it)
 */

const { chromium } = require("@playwright/test");
const path         = require("path");
const fs           = require("fs");

const BASE_URL  = "http://localhost:3000";
const OUT_DIR   = path.join(__dirname, "../web/public/__demo_tmp__");
const FINAL_OUT = path.join(__dirname, "../web/public/demo.webm");
const WIDTH     = 1280;
const HEIGHT    = 720;

// The 4 scripted queries — keep them short enough to finish in ~10-15s each
const QUERIES = [
  "How many EC2 instances do I have?",
  "Are any of my S3 buckets publicly accessible?",
  "List my IAM roles and their trust principals",
  "Which security groups allow SSH from anywhere?",
];

// Typing speed (ms per character) and wait after each answer
const TYPE_DELAY     = 55;   // ms per char
const ANSWER_WAIT_MS = 18000; // 18s — enough for the LLM to finish streaming

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  // Ensure temp dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,          // non-headless so the recording looks real
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      "--start-maximized",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: {
      dir:  OUT_DIR,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  const page = await context.newPage();

  // ── Navigate to the chat page ──────────────────────────────────────────
  console.log("Navigating to chat…");
  await page.goto(`${BASE_URL}/dashboard/chat`, { waitUntil: "networkidle", timeout: 30_000 });
  await sleep(2500);  // let the empty state render

  // ── Run each query ─────────────────────────────────────────────────────
  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i];
    console.log(`\nQuery ${i + 1}/${QUERIES.length}: ${q}`);

    // Focus the input
    const input = page.locator('textarea[aria-label="Chat input"]');
    await input.click();
    await sleep(400);

    // Type slowly so it looks natural on screen
    await page.keyboard.type(q, { delay: TYPE_DELAY });
    await sleep(600);

    // Send
    await page.keyboard.press("Enter");
    console.log("  → sent, waiting for response…");

    // Wait for the streaming response to complete.
    // We watch for the loading indicator to disappear.
    await page
      .locator('[aria-label="Loading"]')
      .waitFor({ state: "hidden", timeout: 60_000 })
      .catch(() => {
        // If there's no explicit loader, just wait the fixed time
      });

    // Extra buffer so the last few streamed tokens appear on screen
    await sleep(ANSWER_WAIT_MS);

    // Brief pause between queries
    if (i < QUERIES.length - 1) await sleep(2000);
  }

  // ── Hold on the final state for 3 s ───────────────────────────────────
  console.log("\nAll queries done — holding 3 s then closing…");
  await sleep(3000);

  // Close — this finalises the webm recording
  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    fs.renameSync(videoPath, FINAL_OUT);
    console.log(`\n✅  Demo saved to: ${FINAL_OUT}`);
    console.log(
      "    Commit web/public/demo.webm or upload it to your CDN.\n"
    );
  } else {
    console.error("❌  Could not find recorded video. Check Playwright output.");
    process.exit(1);
  }

  // Clean up temp dir
  try { fs.rmdirSync(OUT_DIR); } catch {}
})();
