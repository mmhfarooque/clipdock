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
  const connection = await page.evaluate(async () => {
    const session = await fetch("/api/session").then((r) => r.json());
    return fetch("/api/status", {
      headers: { "X-Clipdock-Session": session.csrf },
    }).then((r) => r.json());
  });
  await page.locator(".channel-button").click();
  await page.getByRole("heading", { name: "Connect your channel." }).waitFor();
  assert.equal(
    await page
      .getByRole("button", {
        name: /^(Sign in with Google|Connect a different channel)$/,
      })
      .isDisabled(),
    !connection.configured,
  );
  await page
    .getByText("4. Add the exact callback URL", { exact: true })
    .click();
  await page.getByRole("button", { name: "Copy URL", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Full setup tutorial" }).count(),
    1,
  );
  await page
    .getByText("3. Create a client: Web application", { exact: true })
    .click();
  await page
    .getByText("Use this client for an AI-powered agent", { exact: true })
    .waitFor();
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
