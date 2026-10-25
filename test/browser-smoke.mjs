// Run against an existing ClipDock server. No Google sign-in or uploads.
// Example: CHROMIUM_PATH=/usr/bin/chromium node test/browser-smoke.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.CLIPDOCK_URL || "http://127.0.0.1:3210");
  await page
    .getByRole("heading", { name: "Your next upload starts here." })
    .waitFor();
  await page.getByRole("button", { name: "Connect YouTube" }).click();
  await page.getByRole("heading", { name: "Connect your channel." }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Sign in with Google", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Bring your videos aboard." })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser smoke passed: React renders, settings/import dialogs work, mobile layout fits, no page errors.",
  );
} finally {
  await browser.close();
}
