// Browser checks for the flows unit tests can't see: history and share links, and a designer answer
// that arrives after the customer has edited the design. Run with `npm run test:e2e`.
//
// By default it starts `next dev` on E2E_PORT (3310), with orders in a temporary directory, and
// stops it afterwards. Set E2E_BASE_URL to test a server that is already running instead.
// Chromium: PLAYWRIGHT_CHROMIUM_PATH, else /opt/pw-browsers/chromium when present, else Playwright's own.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const PORT = Number(process.env.E2E_PORT || 3310);
const LOCAL_CHROMIUM = "/opt/pw-browsers/chromium";

/** A buildable GMT design, as a share link carries it. */
const SHARED_SPEC = {
  name: "Shared GMT",
  movementId: "mv-nh34a",
  caseId: "case-gmt-40",
  dialId: "dial-gmt-black",
  handsId: "hands-gmt-mercedes-red",
  crystalId: "crystal-sapphire-flat-305",
  bezelInsertId: "insert-gmt-pepsi-alu",
  strapId: "strap-bracelet-5link-20",
  personalization: { dialText: "", casebackEngraving: "" },
};

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The server at ${url} didn't answer within ${timeoutMs / 1000} s`);
}

async function startServer() {
  if (process.env.E2E_BASE_URL) return { base: process.env.E2E_BASE_URL.replace(/\/$/, ""), stop: async () => {} };
  const ordersDir = await mkdtemp(path.join(tmpdir(), "atelier-e2e-orders-"));
  const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    env: { ...process.env, ORDERS_DIR: ordersDir, WORKSHOP_TOKEN: "", ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  const base = `http://localhost:${PORT}`;
  const stop = async () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
    await rm(ordersDir, { recursive: true, force: true });
  };
  try {
    await waitForServer(`${base}/how-it-works`);
  } catch (error) {
    await stop();
    throw new Error(`${error.message}\n${log}`);
  }
  return { base, stop };
}

function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  return existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;
}

/** The design name once it reads `expected` (a saved design is restored after hydration), or what it reads after 10 s. */
async function designNameBecomes(page, expected) {
  const input = page.getByLabel("Your design");
  const deadline = Date.now() + 10_000;
  let value = await input.inputValue();
  while (value !== expected && Date.now() < deadline) {
    await page.waitForTimeout(200);
    value = await input.inputValue();
  }
  return value;
}

/** A page that records uncaught errors and console errors, so a flow fails on them too. */
async function openPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return { page, errors, close: () => context.close() };
}

const tests = [
  {
    name: "a share link opens the design, and Back after leaving returns to it with the customer's edits",
    async run(browser, base) {
      const { page, errors, close } = await openPage(browser, { width: 1440, height: 1000 });
      const encoded = Buffer.from(JSON.stringify(SHARED_SPEC)).toString("base64url");
      await page.goto(`${base}/?d=${encoded}`);
      await page.waitForFunction(() => !location.search.includes("d="), null, { timeout: 15_000 });
      const name = page.getByLabel("Your design");
      assert.equal(await name.inputValue(), "Shared GMT");

      await name.fill("Edited after arrival");
      await page.getByRole("link", { name: "How it works" }).first().click();
      await page.waitForURL(/how-it-works/);
      await page.goBack();
      await page.getByRole("heading", { name: "Design your watch" }).waitFor();
      assert.equal(new URL(page.url()).search, "", "the share parameter stays gone");
      assert.equal(await designNameBecomes(page, "Edited after arrival"), "Edited after arrival");

      await page.reload();
      await page.getByRole("heading", { name: "Design your watch" }).waitFor();
      assert.equal(await designNameBecomes(page, "Edited after arrival"), "Edited after arrival");
      assert.deepEqual(errors, []);
      await close();
    },
  },
  {
    name: "a proposal that arrives after an edit waits for the customer, and Undo brings the edit back",
    async run(browser, base) {
      const { page, errors, close } = await openPage(browser, { width: 390, height: 844 });
      await page.route("**/api/design", async (route) => {
        if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 2500));
        await route.continue();
      });
      await page.goto(base);
      const name = page.getByLabel("Your design");
      await name.waitFor();
      await page.getByRole("button", { name: "A 38mm green field watch on leather" }).click();
      await page.waitForTimeout(300);
      await name.fill("Edited while waiting");

      const apply = page.getByRole("button", { name: "Apply this proposal" });
      await apply.waitFor({ timeout: 20_000 });
      assert.equal(await name.inputValue(), "Edited while waiting", "the late proposal didn't overwrite the edit");

      await apply.click();
      assert.notEqual(await name.inputValue(), "Edited while waiting");
      await page.getByRole("button", { name: "Undo this proposal" }).click();
      assert.equal(await name.inputValue(), "Edited while waiting");
      assert.deepEqual(errors, []);
      await close();
    },
  },
];

async function main() {
  const { base, stop } = await startServer();
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  let failed = 0;
  try {
    for (const test of tests) {
      try {
        await test.run(browser, base);
        console.log(`  ok  ${test.name}`);
      } catch (error) {
        failed++;
        console.log(`  FAIL  ${test.name}\n        ${String(error?.stack ?? error).replaceAll("\n", "\n        ")}`);
      }
    }
  } finally {
    await browser.close();
    await stop();
  }
  console.log(`\n${tests.length - failed} of ${tests.length} passed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
