import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";

test("local server protects requests, imports metadata, saves edits and blocks unauthorised uploads", async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), "clipdock-http-"));
  const port = 35000 + Math.floor(Math.random() * 20000),
    base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ["src/server.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      CLIPDOCK_STATE_DIR: path.join(temp, "state"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (proc.exitCode === null) {
      const exited = new Promise((resolve) => proc.once("exit", resolve));
      proc.kill();
      await exited;
    }
    await rm(temp, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error("Server startup timed out. Run npm run build first.")),
      15000,
    );
    proc.stdout.on("data", (data) => {
      if (String(data).includes("ClipDock ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.stderr.on("data", (data) => {
      clearTimeout(timeout);
      reject(new Error(String(data)));
    });
    proc.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited ${code}`));
    });
  });
  const token = (await fetch(base + "/api/session").then((r) => r.json())).csrf;
  const headers = {
    "Content-Type": "application/json",
    "X-Clipdock-Session": token,
  };
  const post = (url, body, extra = {}) =>
    fetch(base + url, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(base + "/api/status")).status, 403);
  assert.equal(
    (await post("/api/import", {}, { Origin: "https://example.com" })).status,
    403,
  );
  const rebindingStatus = await new Promise((resolve, reject) =>
    http
      .get(
        base + "/api/session",
        { headers: { Host: "attacker.invalid" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on("error", reject),
  );
  assert.equal(rebindingStatus, 403);
  await writeFile(path.join(temp, "final-video-captioned.mp4"), "fixture");
  await writeFile(
    path.join(temp, "UPLOAD_LOG.md"),
    "## Title\n\nDemo tip\n\n## Tags\n\nhome, demo\n",
  );
  assert.equal((await post("/api/import", { folder: temp })).status, 200);
  const state = await fetch(base + "/api/status", { headers }).then((r) =>
    r.json(),
  );
  assert.equal(state.episodes.length, 1);
  assert.equal(state.connected, false);
  const episode = state.episodes[0];
  assert.equal(episode.metadata.title, "Demo tip");
  const edited = await post("/api/episodes/" + episode.id, {
    ...episode.metadata,
    title: "Edited demo",
  });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).metadata.title, "Edited demo");
  assert.equal(
    (await post("/api/queue", { ids: [episode.id], confirmPrivate: true }))
      .status,
    400,
  );
  assert.equal((await fetch(base + "/media/" + episode.id)).status, 403);
});
